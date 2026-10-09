import { trampoline } from "wisp/src/platform/dispatch";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { type MatchState, humanActive } from "../../game/match/rules";
import {
  AUTO_DELAY, DEFAULT_DELAY, type DelayPolicy, type RttEstimate, agreedDelay, connectionPoor, delayPolicy, expectedRollback, highDelay,
  nextDelay, observeRtt, requestedDelay, rttEstimate, smoothedRttMs,
} from "../../game/netcode/delayPolicy";
import { type FixedDelay, isFixedDelay } from "../../game/netcode/fixedSchedule";
import { PENDING_CAPACITY } from "../../game/netcode/shadowSchedule";
import { createText, gameUi, placeTopLeft } from "../../game/ui/frames";
import { at } from "wisp/src/runtime/lookup";

export const DELAY_PREFIX = "SC_DY";
export const DELAY_RECEIVED = "shell.delayProposal";
const SECOND = 60;

export interface NetDelay {
  readonly policy: DelayPolicy;
  readonly estimate: RttEstimate;
  readonly sentTicks: number[];
  readonly proposals: number[];
  readonly depths: number[];
  ticks: number;
  proposed: number;
  depth: number;
  shownDepth: number;
  indicator: framehandle | undefined;
  shownText: string;
}

export function createNetDelay(window: number): NetDelay {
  return {
    policy: delayPolicy(window), estimate: rttEstimate(), sentTicks: Array.from({ length: PENDING_CAPACITY }, () => -1),
    proposals: [DEFAULT_DELAY, DEFAULT_DELAY, DEFAULT_DELAY, DEFAULT_DELAY], depths: Array.from({ length: window + 2 }, () => 0), ticks: 0, proposed: DEFAULT_DELAY, depth: 0, shownDepth: 0,
    indicator: undefined, shownText: "",
  };
}

function humans(game: Readonly<MatchState>): number {
  let count = 0;
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot)) count++;
  return count;
}

export const isOnline = (game: Readonly<MatchState>): boolean => humans(game) > 1;

export function requestFor(net: Readonly<NetDelay>, game: Readonly<MatchState>, slot: number, choice: number): number {
  return requestedDelay(choice, isOnline(game) ? at(net.proposals, slot) : DEFAULT_DELAY);
}

export function matchDelay(net: Readonly<NetDelay>, game: Readonly<MatchState>, choices: readonly number[]): FixedDelay {
  const requests: number[] = [];
  for (const slot of PARTICIPANT_SLOTS) if (humanActive(game, slot)) requests.push(requestFor(net, game, slot, at(choices, slot)));
  const agreed = agreedDelay(requests);
  return isFixedDelay(agreed) ? agreed : DEFAULT_DELAY;
}

export function lobbyDelayText(net: Readonly<NetDelay>, game: Readonly<MatchState>, choices: readonly number[]): string {
  const parts: string[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!humanActive(game, slot)) continue;
    const choice = at(choices, slot);
    const request = requestFor(net, game, slot, choice);
    parts.push(`P${I2S(slot + 1)} ${choice === AUTO_DELAY ? `Auto (${I2S(request)})` : I2S(request)}`);
  }
  const agreed = matchDelay(net, game, choices);
  const line = `Input delay: ${parts.join(" · ")} → ${I2S(agreed)} frames`;
  return highDelay(agreed) ? `${line}\n|cffff4040Input delay of 8+ frames: this connection will feel sluggish|r` : line;
}

export const recalibratedDelay = (net: Readonly<NetDelay>, game: Readonly<MatchState>, slot: number): number => requestFor(net, game, slot, AUTO_DELAY);

export function recalibrateText(net: Readonly<NetDelay>, game: Readonly<MatchState>, slot: number): string {
  const { estimate } = net;
  const auto = recalibratedDelay(net, game, slot);
  if (estimate.samples === 0) return `Recalibrate: no ping measured yet · Auto ${I2S(auto)} frames`;
  return `Ping ${I2S(smoothedRttMs(estimate))} ms · Auto ${I2S(auto)} frames · expected rollback ${I2S(expectedRollback(estimate, auto))}`;
}

export function noteSent(net: NetDelay, frame: number): void {
  net.sentTicks[floorMod(frame, PENDING_CAPACITY)] = net.ticks;
}

export function noteEcho(net: NetDelay, frame: number): void {
  const index = floorMod(frame, PENDING_CAPACITY);
  const sent = at(net.sentTicks, index);
  if (sent < 0) return;
  net.sentTicks[index] = -1;
  // Warcraft relays each sync message through the host, so a row's echo age is the remote row's age too: the round trip is twice it.
  observeRtt(net.estimate, floorDiv((net.ticks - sent) * 100, 3));
}

export function beginNetEpoch(net: NetDelay): void {
  net.sentTicks.fill(-1);
  net.depths.fill(0);
  net.depth = 0;
}

export function noteDepth(net: NetDelay, depth: number): void {
  net.depth = Math.max(net.depth, depth);
  const bucket = Math.min(depth, net.depths.length - 1);
  net.depths[bucket] = at(net.depths, bucket) + 1;
}

export function serviceNetDelay(net: NetDelay, game: Readonly<MatchState>, local: number, delay: number, inMatch: boolean): void {
  net.ticks++;
  if (floorMod(net.ticks, SECOND) !== 0) return;
  if (net.indicator === undefined) {
    net.indicator = createText("SmashcraftNetIndicator", gameUi(), 0);
    placeTopLeft(net.indicator, f32(0.01), f32(0.03));
    BlzFrameSetSize(net.indicator, f32(0.3), f32(0.016));
    BlzFrameSetVisible(net.indicator, false);
  }
  const online = isOnline(game);
  if (online && humanActive(game, local) && net.estimate.samples > 0) {
    const proposal = nextDelay(net.policy, net.estimate, net.proposed);
    if (proposal !== net.proposed && BlzSendSyncData(DELAY_PREFIX, I2S(proposal))) net.proposed = proposal;
  }
  net.shownDepth = net.depth;
  net.depth = 0;
  const poor = connectionPoor(net.policy, net.estimate, delay);
  const text = !inMatch || !online || !poor ? "" : `|cffff4040Connection poor|r · input delay ${I2S(delay)} · ${I2S(net.shownDepth)} frames behind`;
  if (text === net.shownText) return;
  net.shownText = text;
  BlzFrameSetText(net.indicator, text);
  BlzFrameSetVisible(net.indicator, text !== "");
}

export function receiveDelayProposal(net: NetDelay): void {
  const slot = GetPlayerId(GetTriggerPlayer());
  const value = S2I(BlzGetTriggerSyncData());
  if (slot >= 0 && slot < net.proposals.length && isFixedDelay(value)) net.proposals[slot] = Math.max(DEFAULT_DELAY, value);
}

export function registerDelayProposals(handler: string): void {
  const trigger = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(slot), DELAY_PREFIX, false);
  TriggerAddAction(trigger, trampoline(handler));
}
