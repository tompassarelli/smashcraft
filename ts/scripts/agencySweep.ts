










import { Action, bit } from "../src/game/input/actions";
import { ATTACK_BUFFER_FRAMES } from "../src/game/input/attackBuffer";
import { type InputRow, emptyInput, inputRow } from "../src/game/input/inputRow";
import { createFrameControls } from "../src/game/match/controls";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { Phase, createMatchState, setHumanMask } from "../src/game/match/rules";
import type { ReplayState } from "../src/game/replay/snapshot";
import { beginFighterAttack, resolveAttacks } from "../src/game/sim/attacks";
import { AttackStyle, Character, DownState, GrabAction } from "../src/game/sim/codes";
import { canAttack } from "../src/game/sim/conditions";
import { type Fighter, createFighter } from "../src/game/sim/fighter";
import { attackStartupFrames } from "../src/game/sim/moves";
import { createRoster, fighterAt } from "../src/game/sim/roster";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { type AgencyReport, ESCAPE_FRAMES, type Loop, TIGHT_ESCAPE, agencyLetters, analyzeAgency, runFrame, sameGameplay, snapshotOf } from "./agency";
import { exportComparisons } from "./moveComparisons";

interface Entry {
  readonly name: string;
  readonly character: Character;
}


export const FIGHTERS: readonly Entry[] = SELECTABLE_CHARACTERS.map((character) => ({ name: fighterName(character), character }));
const nameOf = (character: number) => FIGHTERS.find((entry) => entry.character === character)?.name ?? "fighter";

const PERCENTS = Array.from({ length: 16 }, (_, index) => index * 10);







export const REPORTED_FRAMES = 20;


const WINDOW = 720;

const LATE_FOLLOW_UP = 25;
const ATTACKER = 0;
const VICTIM = 1;

const SETTLE = 2;


function pad(buttons: number, x = 0, z = 0): InputRow {
  const held = buttons | (x < 0 ? bit(Action.moveLeft) : 0) | (x > 0 ? bit(Action.moveRight) : 0) | (z < 0 ? bit(Action.moveDown) : 0) | (z > 0 ? bit(Action.moveUp) : 0);
  const special = (buttons & bit(Action.special)) !== 0;
  const row = inputRow({ held, pressed: held, axisX: x * 127, axisZ: z * 127, specialX: special ? x : 0, specialZ: special ? z : 0 });
  if (row === undefined) throw new Error(`no controller sends ${buttons} with stick ${x},${z}`);
  return row;
}


interface Starter {
  readonly name: string;
  readonly buttons: number;
  readonly aim: "toward" | "up" | "down" | "neutral";
  readonly throw?: "forward" | "back" | "up" | "down";
}

const ATTACK = bit(Action.attack);
const WALK = bit(Action.walk);
const SPECIAL = bit(Action.special);
const GRAB = bit(Action.grab);

const STARTERS: readonly Starter[] = [
  { name: "jab", buttons: ATTACK, aim: "neutral" },
  { name: "forward tilt", buttons: ATTACK | WALK, aim: "toward" },
  { name: "up tilt", buttons: ATTACK | WALK, aim: "up" },
  { name: "down tilt", buttons: ATTACK | WALK, aim: "down" },
  { name: "forward smash", buttons: ATTACK, aim: "toward" },
  { name: "up smash", buttons: ATTACK, aim: "up" },
  { name: "down smash", buttons: ATTACK, aim: "down" },
  { name: "neutral special", buttons: SPECIAL, aim: "neutral" },
  { name: "side special", buttons: SPECIAL, aim: "toward" },
  { name: "up special", buttons: SPECIAL, aim: "up" },
  { name: "down special", buttons: SPECIAL, aim: "down" },
  { name: "forward throw", buttons: GRAB, aim: "neutral", throw: "forward" },
  { name: "back throw", buttons: GRAB, aim: "neutral", throw: "back" },
  { name: "up throw", buttons: GRAB, aim: "neutral", throw: "up" },
  { name: "down throw", buttons: GRAB, aim: "neutral", throw: "down" },
];

const toward = (attacker: Readonly<Fighter>, victim: Readonly<Fighter>) => (victim.motion.x >= attacker.motion.x ? 1 : -1);

function aimed(starter: Starter, attacker: Readonly<Fighter>, victim: Readonly<Fighter>): InputRow {
  const x = starter.aim === "toward" ? toward(attacker, victim) : 0;
  const z = starter.aim === "up" ? 1 : starter.aim === "down" ? -1 : 0;
  return pad(starter.buttons, x, z);
}







interface Plan {
  readonly starter: Starter;
  readonly first: number;
  readonly repeat: number | undefined;
  readonly approach: boolean;
}

function attackerRow(plan: Plan, state: Readonly<ReplayState>, frame: number): InputRow {
  const attacker = fighterAt(state.world, ATTACKER);
  const victim = fighterAt(state.world, VICTIM);
  const { starter } = plan;
  if (attacker.grab.target !== undefined && attacker.grab.action === GrabAction.hold) {
    const direction = starter.throw ?? "forward";
    return direction === "up" ? pad(0, 0, 1) : direction === "down" ? pad(0, 0, -1) : pad(0, direction === "forward" ? attacker.facing : -attacker.facing, 0);
  }
  if (frame === plan.first) return aimed(starter, attacker, victim);

  if (plan.repeat === undefined || frame < plan.first || !canAttack(attacker) || victim.status.out) return emptyInput();
  if (Math.abs(victim.motion.x - attacker.motion.x) <= plan.repeat) return frame % 2 === 0 ? aimed(starter, attacker, victim) : emptyInput();
  return plan.approach ? pad(0, toward(attacker, victim), 0) : emptyInput();
}

function match(world: ReplayState["world"], percent: number): ReplayState {
  const state = createMatchState();
  setHumanMask(state, 3);
  state.phase = Phase.match;
  state.timeLimitMinutes = 0;
  state.stageChoice = 0;
  const controls = createFrameControls();
  for (const commands of controls.commands) commands.graceFrames = ATTACK_BUFFER_FRAMES;
  fighterAt(world, VICTIM).status.damage = percent;
  return { world, match: state, controls, runtime: createPacingAndPresentation() };
}


export function standingMatch(attacker: Character, victim: Character, percent: number, gap: number): ReplayState {
  const state = match(createRoster(3, [createFighter(attacker, -gap / 2, 1), createFighter(victim, gap / 2, -1)]), percent);
  for (let frame = 0; frame < SETTLE; frame++) runFrame(state, () => emptyInput());
  return state;
}


function lyingMatch(attacker: Character, victim: Character, percent: number, gap: number): ReplayState {
  const state = standingMatch(attacker, victim, percent, gap);
  const lying = fighterAt(state.world, VICTIM);

  lying.motion.grounded = false;
  lying.motion.surface = undefined;
  lying.motion.z = 2.0;
  lying.down.state = DownState.tumble;
  lying.launch.hitstun = 400;
  const lyingDown = () => fighterAt(state.world, VICTIM).down.state === DownState.wait;
  for (let frame = 0; frame < 60 && !lyingDown(); frame++) runFrame(state, () => emptyInput());
  if (!lyingDown()) throw new Error("the victim did not come to lie on the deck");
  return state;
}


interface Catches {
  hits: number;
  grabbed: boolean;
  frozenFrames: number;
}


function caught(f: Readonly<Fighter>, seen: Catches): boolean {
  const grabbed = f.grab.owner !== undefined;
  const fresh = f.visuals.hit !== seen.hits || (grabbed && !seen.grabbed) || f.status.frozenFrames > seen.frozenFrames;
  seen.hits = f.visuals.hit;
  seen.grabbed = grabbed;
  seen.frozenFrames = f.status.frozenFrames;
  return fresh;
}

const catchesOf = (f: Readonly<Fighter>): Catches => ({ hits: f.visuals.hit, grabbed: f.grab.owner !== undefined, frozenFrames: f.status.frozenFrames });


function play(start: Readonly<ReplayState>, plan: Plan, frames: number): { readonly catchFrames: readonly number[]; readonly afterFirst: ReplayState | undefined; readonly end: ReplayState } {
  const state = snapshotOf(start);
  const seen = catchesOf(fighterAt(state.world, VICTIM));
  const catchFrames: number[] = [];
  let afterFirst: ReplayState | undefined;
  for (let index = 0; index < frames; index++) {
    const frame = state.runtime.simulationFrame + 1;
    runFrame(state, (slot) => (slot === ATTACKER ? attackerRow(plan, state, frame) : emptyInput()));
    const victim = fighterAt(state.world, VICTIM);
    if (caught(victim, seen)) {
      catchFrames.push(frame);
      afterFirst ??= snapshotOf(state);
    }
    if (victim.status.out) break;
  }
  return { catchFrames, afterFirst, end: state };
}


const neutral = () => emptyInput();


function holding(caughtState: Readonly<ReplayState>, x: number, z: number): (frame: number) => InputRow {
  const first = caughtState.runtime.simulationFrame + 1;
  const pressed = pad(0, x, z);
  const held = inputRow({ ...pressed, pressed: 0, throwX: 0, throwZ: 0 });
  if (held === undefined) throw new Error(`no controller holds the stick at ${x},${z}`);
  return (frame) => (frame === first ? pressed : held);
}

function stretchAfter(caughtState: Readonly<ReplayState>, attacker: (state: Readonly<ReplayState>, frame: number) => InputRow, victimRow: (frame: number) => InputRow, untilFree: number): AgencyReport {
  return analyzeAgency({
    start: caughtState, victim: VICTIM, frames: WINDOW, horizon: 30, untilFree,
    row: (slot, frame, state) => (slot === ATTACKER ? attacker(state, frame) : victimRow(frame)),
  });
}

const DI = [["up", 0, 1], ["up-right", 1, 1], ["right", 1, 0], ["down-right", 1, -1], ["down", 0, -1], ["down-left", -1, -1], ["left", -1, 0], ["up-left", -1, 1]] as const;


interface StretchResult {
  readonly length: number;
  readonly diFrames: number;
  readonly letters: string;
  readonly loop: Loop | undefined;
  readonly endPercent: number;
  readonly knockedOut: boolean;

  readonly underDi: readonly { readonly direction: string; readonly length: number; readonly loopEscapeFrames: number | undefined; readonly plan: string }[];
}

function summarize(report: AgencyReport, caughtState: Readonly<ReplayState>, underDi: StretchResult["underDi"] = []): StretchResult {
  const first = report.stretches[0];
  const length = first === undefined || first.from !== caughtState.runtime.simulationFrame + 1 ? 0 : first.length;
  const last = report.states[length];
  const victim = last === undefined ? undefined : fighterAt(last.world, VICTIM);
  return {
    length, diFrames: length === 0 ? 0 : first?.diFrames ?? 0, letters: agencyLetters(report.frames), loop: report.loop,
    endPercent: victim?.status.damage ?? 0, knockedOut: victim !== undefined && (victim.status.out || victim.status.stocks < fighterAt(caughtState.world, VICTIM).status.stocks),
    underDi,
  };
}







function loopUnderDi(caughtState: Readonly<ReplayState>, plans: readonly Plan[]): StretchResult["underDi"] {
  return DI.map(([direction, x, z]) => {
    let best: { readonly length: number; readonly loopEscapeFrames: number | undefined; readonly plan: string } | undefined;
    for (const plan of plans) {
      const report = stretchAfter(caughtState, (state, frame) => attackerRow(plan, state, frame), holding(caughtState, x, z), ESCAPE_FRAMES + 1);
      const escape = report.loop?.escapeFrames;
      if (best !== undefined && (escape === undefined || (best.loopEscapeFrames !== undefined && best.loopEscapeFrames <= escape))) continue;
      best = { length: report.stretches[0]?.length ?? 0, loopEscapeFrames: escape, plan: describePlan(plan) };
      if (escape === 0) break;
    }
    return { direction, length: best?.length ?? 0, loopEscapeFrames: best?.loopEscapeFrames, plan: best?.plan ?? "" };
  });
}

const describePlan = ({ starter, repeat, approach }: Plan) => `${starter.name} again ${approach ? "approaching, " : ""}within ${repeat ?? 0} units`;


export interface StarterResult {
  readonly attacker: string;
  readonly victim: string;
  readonly starter: string;
  readonly percent: number;
  readonly alone: StretchResult;
  readonly followUp: (StretchResult & { readonly plan: string; readonly catches: number }) | undefined;
}


const REACHES = [25, 40, 60, 80, 110, 150];


const rank = ({ loop, length }: StretchResult) => (loop === undefined ? 0 : 1_000_000 - loop.escapeFrames * 1000) + length;


function sweepStarter(start: Readonly<ReplayState>, attacker: string, victim: string, starter: Starter, percent: number): StarterResult | undefined {
  const firstFrame = start.runtime.simulationFrame + 1;
  const once: Plan = { starter, first: firstFrame, repeat: undefined, approach: false };
  const opened = play(start, once, 120);
  const caughtState = opened.afterFirst;
  if (caughtState === undefined) return undefined;
  const caughtFrame = caughtState.runtime.simulationFrame;
  const alone = summarize(stretchAfter(caughtState, (state, frame) => attackerRow(once, state, frame), neutral, 1), caughtState);
  const latest = caughtFrame + alone.length + 1 + LATE_FOLLOW_UP;
  const ownCatches = play(start, once, latest - start.runtime.simulationFrame).catchFrames.length;
  const plans = REACHES.flatMap((repeat) => [false, true].map((approach): Plan => ({ starter, first: firstFrame, repeat, approach })));
  let best: { readonly result: StretchResult; readonly plan: Plan } | undefined;

  const tried: ReplayState[] = [];
  for (const plan of plans) {
    const trial = play(start, plan, latest - start.runtime.simulationFrame);

    if (trial.catchFrames.length <= ownCatches || tried.some((end) => sameGameplay(end, trial.end))) continue;
    tried.push(trial.end);
    const result = summarize(stretchAfter(caughtState, (state, frame) => attackerRow(plan, state, frame), neutral, ESCAPE_FRAMES + 1), caughtState);

    if (result.length <= alone.length && result.loop === undefined) continue;
    if (best === undefined || rank(result) > rank(best.result)) best = { result, plan };
  }
  if (best === undefined) return { attacker, victim, starter: starter.name, percent, alone, followUp: undefined };
  const { result, plan } = best;
  const lastFrame = Math.max(caughtFrame + result.length, result.loop?.to ?? 0);
  const catches = play(start, plan, lastFrame - start.runtime.simulationFrame).catchFrames.length;

  const underDi = result.loop !== undefined && result.loop.escapeFrames <= TIGHT_ESCAPE ? loopUnderDi(caughtState, [plan, ...plans.filter((other) => other !== plan)]) : [];
  return { attacker, victim, starter: starter.name, percent, alone, followUp: { ...result, underDi, plan: describePlan(plan), catches } };
}







export function sweepStarters(attackers: readonly Entry[] = FIGHTERS, only?: readonly string[]): StarterResult[] {
  const results: StarterResult[] = [];
  const reset: Starter = { name: "jab reset", buttons: ATTACK, aim: "neutral" };
  const starters = STARTERS.filter(({ name }) => only === undefined || only.includes(name));
  const resets = only === undefined || only.includes(reset.name);
  for (const attacker of attackers) {
    for (const victim of FIGHTERS) {
      for (const percent of PERCENTS) {
        const coarse = percent % 50 === 0;
        for (const starter of starters) {
          if (starter.throw === undefined && !coarse) continue;
          const result = sweepStarter(standingMatch(attacker.character, victim.character, percent, 40), attacker.name, victim.name, starter, percent);
          if (result !== undefined) results.push(result);
        }
        if (!resets) continue;
        const lying = sweepStarter(lyingMatch(attacker.character, victim.character, percent, 40), attacker.name, victim.name, reset, percent);
        if (lying !== undefined) results.push(lying);
      }
    }
  }
  return results;
}


export interface LinkResult {
  readonly name: string;

  readonly comparisonContact: number;
  readonly contact: number | undefined;
  readonly stretch: StretchResult;

  readonly holdsUnderDi: readonly { readonly direction: string; readonly holds: boolean }[];
}

interface ComparisonRow {
  readonly kind: string;
  readonly verdict?: string;
  readonly character: number;
  readonly category: string;
  readonly spacing: number;
  readonly percent: number;
  readonly candidateStyle: number;
  readonly delay: number;
  readonly approach: boolean;
  readonly scheduledStart: number;
  readonly firstContact: number;
  readonly opponentReady: number;
}

const isComparisonRow = (value: unknown): value is ComparisonRow => typeof value === "object" && value !== null && "kind" in value && "verdict" in value;


function comparisonContact(row: ComparisonRow): ReplayState {
  const character = FIGHTERS.find((entry) => entry.character === row.character)?.character;
  if (character === undefined) throw new Error(`the comparisons name fighter ${row.character}, which isn't shipped`);
  const attacker = createFighter(character, 0, 1);
  const defender = createFighter(Character.rifleman, row.spacing, -1);
  const state = match(createRoster(3, [attacker, defender]), row.percent);
  const style = row.category === "smash" ? AttackStyle.forwardSmash : row.category === "normal" ? AttackStyle.forwardTilt : AttackStyle.neutralAir;
  const aerial = style === AttackStyle.neutralAir;
  attacker.motion.grounded = !aerial;
  attacker.motion.surface = aerial ? undefined : 0;
  attacker.motion.z = aerial ? 20 : 0;
  attacker.motion.vz = aerial ? -2 : 0;
  defender.motion.surface = 0;
  beginFighterAttack(state.world, ATTACKER, style, false);
  const contact = aerial ? 20 : attackStartupFrames(style);
  attacker.attack.frame = contact;
  attacker.attack.cooldown = attacker.attack.duration - contact;
  resolveAttacks(state.world);
  return state;
}


export function sweepComparisonLinks(): LinkResult[] {
  const links = exportComparisons().map((line): unknown => JSON.parse(line)).filter(isComparisonRow).filter((row) => row.verdict === "bounded-true-link");
  return links.map((row) => {
    const contactState = comparisonContact(row);
    const tilt = row.candidateStyle === AttackStyle.forwardTilt;

    const ready = row.scheduledStart - row.delay;
    const attacker = (state: Readonly<ReplayState>, frame: number): InputRow => {
      const tick = frame - contactState.runtime.simulationFrame;
      const self = fighterAt(state.world, ATTACKER);
      const side = toward(self, fighterAt(state.world, VICTIM));
      if (tick === row.scheduledStart) return tilt ? pad(ATTACK | WALK, side, 0) : pad(ATTACK);
      return row.approach && tick >= ready && tick < row.scheduledStart ? pad(0, side, 0) : emptyInput();
    };
    const report = stretchAfter(contactState, attacker, neutral, 1);
    const seen = catchesOf(fighterAt(contactState.world, VICTIM));
    const contact = report.states.findIndex((state, index) => index > 0 && caught(fighterAt(state.world, VICTIM), seen));
    const stretch = summarize(report, contactState);
    const holdsUnderDi = DI.map(([direction, x, z]) => {
      const held = stretchAfter(contactState, attacker, holding(contactState, x, z), 1);
      const heldSeen = catchesOf(fighterAt(contactState.world, VICTIM));
      const heldContact = held.states.findIndex((state, index) => index > 0 && caught(fighterAt(state.world, VICTIM), heldSeen));
      return { direction, holds: heldContact > 0 && heldContact <= (held.stretches[0]?.length ?? 0) };
    });
    const name = `${nameOf(row.character)} ${row.category === "late-aerial" ? "late neutral air" : row.category === "smash" ? "forward smash" : "forward tilt"}`
      + ` into ${tilt ? "forward tilt" : "jab"} on Rifleman at ${row.percent}%, ${row.spacing} apart, delay ${row.delay}${row.approach ? " approaching" : ""}`;
    return { name, comparisonContact: row.firstContact, contact: contact > 0 ? contact : undefined, stretch, holdsUnderDi };
  });
}


export const STARTER_NAMES: readonly string[] = [...STARTERS.map(({ name }) => name), "jab reset"];


export function attackerPlan(name: string, first: number, repeat?: number, approach = false): (state: Readonly<ReplayState>, frame: number) => InputRow {
  const starter = STARTERS.find((candidate) => candidate.name === name);
  if (starter === undefined) throw new Error(`no starter named ${name}`);
  const plan: Plan = { starter, first, repeat, approach };
  return (state, frame) => attackerRow(plan, state, frame);
}
