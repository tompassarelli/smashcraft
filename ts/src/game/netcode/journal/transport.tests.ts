// The journal transport's contract: rate-capped I5 messages carry every
// admitted frame once, in order, holds included, and two clients running the
// same match on what they receive confirm every edge on its original frame.
import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "waygate/src/runtime/testing";
import { floorMod } from "waygate/src/sim/intMath";
import { ALL_ACTIONS, Action, bit, maskOf } from "../../input/actions";
import { type InputRow, type RowFields, inputRow, sameInput } from "../../input/inputRow";
import { PARTICIPANT_SLOTS, type ParticipantInputs, participantInputs } from "../../input/participants";
import { type InputPacket, MESSAGE_MAX_BYTES, encodeInputMessage, encodePacket, inputPacket } from "../../input/wire";
import { createFrameControls } from "../../match/controls";
import { type MatchFrameInput, captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../../match/frameInput";
import {
  type MatchState, copyMatchState, createMatchState, cycleSlotMode, fighterActive, fighterMask, humanFighterActive,
  requestStageSelect, requestStart, selectCharacter, setParticipants,
} from "../../match/rules";
import { createReplayRuntimeState } from "../../match/runtime";
import { initializeMatchFighters, matchSpawnX } from "../../match/step";
import { stateChecksum } from "../../replay/canonical";
import { type ReplayState, createReplaySnapshot } from "../../replay/snapshot";
import { Character } from "../../sim/codes";
import { createFighter } from "../../sim/fighter";
import { createRoster } from "../../sim/roster";
import { Capture } from "../capture";
import { FUTURE_LIMIT } from "../ledger";
import { ShadowInputSchedule } from "../shadowSchedule";
import { DEFAULT_BATCH, OutgoingInput, decodeTransport } from "./transport";

const row = (fields: RowFields = {}) => assertDefined(inputRow(fields), "row");
const NEUTRAL = row();
const WALK = row({ held: bit(Action.moveRight), pressed: bit(Action.moveRight), axisX: 127 });
const WALKING = row({ held: bit(Action.moveRight), axisX: 127 });
const TAP_WHILE_WALKING = row({ held: bit(Action.moveRight), pressed: bit(Action.attack), released: bit(Action.attack), axisX: 127 });
const TWO_BUTTONS = row({ held: maskOf(Action.moveRight, Action.jump, Action.special), pressed: maskOf(Action.jump, Action.special), axisX: 127 });
const STOP = row({ released: maskOf(Action.moveRight, Action.jump, Action.special) });

/** Every frame of decoded packets, checking that they run consecutively from firstFrame. */
function framesOf(packets: readonly InputPacket[], epoch: number, firstFrame: number): InputRow[] {
  const rows: InputRow[] = [];
  for (const packet of packets) {
    assertEquals(packet.epoch, epoch);
    assertEquals(packet.firstFrame, firstFrame + rows.length);
    for (const each of packet.rows) rows.push(each);
  }
  return rows;
}

test("an I5 message spells only changed frames and restores every frame once, in order", () => {
  // Six neutral frames are one record: "I5", epoch 1, frame 10, six frames, neutral.
  const quiet = encodeInputMessage(1, 10, 15, () => NEUTRAL);
  assertEquals(quiet.wire, "I51A60");
  assertEquals(quiet.lastFrame, 15);
  assertEquals(framesOf(assertDefined(decodeTransport(quiet.wire)), 1, 10).length, 6);
  const source = [NEUTRAL, NEUTRAL, WALK, WALKING, WALKING, TAP_WHILE_WALKING, WALKING, TWO_BUTTONS, STOP, NEUTRAL, NEUTRAL];
  const message = encodeInputMessage(7, 300, 300 + source.length - 1, frame => source[frame - 300] ?? NEUTRAL);
  assertEquals(message.firstFrame, 300);
  assertEquals(message.lastFrame, 300 + source.length - 1);
  const rows = framesOf(assertDefined(decodeTransport(message.wire)), 7, 300);
  assertEquals(rows.length, source.length);
  rows.forEach((each, index) => assertTrue(sameInput(each, source[index] ?? NEUTRAL)));
  // A message ending inside a held walk restores the walk, without its press, to the last frame.
  const walking = framesOf(assertDefined(decodeTransport(encodeInputMessage(7, 302, 304, frame => source[frame - 300] ?? NEUTRAL).wire)), 7, 302);
  assertTrue(sameInput(walking[0] ?? NEUTRAL, WALK) && sameInput(walking[2] ?? NEUTRAL, WALKING));
  // Ten more neutral frames after the release are holds, which cost no bytes.
  const longer = encodeInputMessage(7, 300, 300 + source.length + 9, frame => source[frame - 300] ?? NEUTRAL);
  assertEquals(longer.lastFrame, 300 + source.length + 9);
  assertEquals(longer.wire.length, message.wire.length);
  assertEquals(framesOf(assertDefined(decodeTransport(longer.wire)), 7, 300).length, source.length + 10);
});

test("malformed, non-canonical or old pair messages are refused, and keyboard rollback's lone I4 packet is accepted", () => {
  assertEquals(decodeTransport("I51A2000"), undefined); // the second frame spelled although it holds
  assertEquals(decodeTransport("I51A1000"), undefined); // a record past the frame count
  assertEquals(decodeTransport("I51A00"), undefined); // no frames
  assertEquals(decodeTransport("I51A6"), undefined); // no first record
  assertEquals(decodeTransport("I51A60!"), undefined);
  assertEquals(decodeTransport("I51060"), undefined); // frame 0
  assertEquals(decodeTransport(`I51A60${"0".repeat(MESSAGE_MAX_BYTES)}`), undefined);
  const lone = encodePacket(assertDefined(inputPacket(3, 40, [WALK, WALKING])));
  assertEquals(assertDefined(decodeTransport(lone)).length, 1);
  assertEquals(decodeTransport(`B4${lone}|${encodePacket(assertDefined(inputPacket(3, 42, [WALKING])))}`), undefined);
});

/** The largest row: every group present, all of them different from `other`'s. */
function largestRow(other: boolean): InputRow {
  const sign = other ? -1 : 1;
  return row({
    held: other ? ALL_ACTIONS - 1 : ALL_ACTIONS, pressed: ALL_ACTIONS, released: other ? 1 : 2, axisX: 127 * sign, axisZ: -127 * sign,
    triggerLeft: other ? 254 : 255, triggerRight: 255, specialX: sign, specialZ: sign, dodgeX: sign, dodgeZ: -sign, sdi: true, sdiX: sign,
    sdiZ: sign, ledgeVertical: sign, throwX: 127 * sign, throwZ: -127 * sign,
  });
}

test("one message per batch drains a backlog of the largest rows within the size limit", () => {
  const outgoing = new OutgoingInput();
  outgoing.begin(2147483647, 2000000000);
  assertFalse(outgoing.admit(2000000001, NEUTRAL));
  for (let frame = 2000000000; frame < 2000000040; frame++) assertTrue(outgoing.admit(frame, largestRow(floorMod(frame, 2) === 1)));
  let first = 2000000000;
  let callbacks = 0;
  let messages = 0;
  while (outgoing.pending() > 0) {
    outgoing.tick();
    callbacks++;
    const message = outgoing.ready(DEFAULT_BATCH);
    if (message === undefined) continue;
    assertTrue(message.wire.length <= MESSAGE_MAX_BYTES);
    assertEquals(message.firstFrame, first);
    const rows = framesOf(assertDefined(decodeTransport(message.wire)), 2147483647, first);
    rows.forEach((each, index) => assertTrue(sameInput(each, largestRow(floorMod(first + index, 2) === 1))));
    assertTrue(rows.length >= 8 || outgoing.pending() === rows.length);
    outgoing.sent(message);
    first = message.lastFrame + 1;
    messages++;
  }
  // Forty frames in five messages, the first at once and then one per batch: 8 frames per 6 callbacks outpaces 60 a second.
  assertEquals(messages, 5);
  assertEquals(callbacks, 1 + 4 * DEFAULT_BATCH);
  assertEquals(outgoing.ready(1), undefined);
});

// ---------------------------------------------------------------- two clients

/** Callbacks from a send until every client receives it: the unsaturated echo measured in #26 r8 (about 130 ms). */
const CHANNEL_CALLBACKS = 8;
const WINDOW = 24;
/** The shell's catch-up per callback, for both cursors. */
const CATCH_UP = 6;

/**
 * Dense controller input for one slot, frame by frame: direction reversals
 * every frame, rapid taps, press and release inside one frame, and two
 * buttons at once, each for 30 frames in turn.
 */
function denseScript(slot: number, frames: number): InputRow[] {
  const rows: InputRow[] = [NEUTRAL];
  let held = 0;
  for (let frame = 1; frame <= frames; frame++) {
    const phase = frame + 3 * slot;
    const even = floorMod(phase, 2) === 0;
    let next = 0;
    let taps = 0;
    let axisX = 0;
    let triggerLeft = 0;
    switch (floorMod(frame - 1, 120) - floorMod(frame - 1, 30)) {
      case 0:
        next = even ? bit(Action.moveRight) : bit(Action.moveLeft);
        axisX = even ? 127 : -127;
        break;
      case 30:
        next = even ? bit(Action.attack) : 0;
        break;
      case 60:
        taps = even ? bit(Action.attack) : 0;
        break;
      default:
        next = floorMod(phase, 6) < 3 ? maskOf(Action.jump, Action.special) : bit(Action.leftTrigger);
        triggerLeft = next === bit(Action.leftTrigger) ? 64 + 32 * floorMod(phase, 6) : 0;
    }
    rows.push(row({ held: next, pressed: (next & ~held) | taps, released: (held & ~next) | taps, axisX, triggerLeft }));
    held = next;
  }
  return rows;
}

interface Client {
  readonly slot: number;
  readonly schedule: ShadowInputSchedule;
  readonly outgoing: OutgoingInput;
  /** Preallocated scratch for the speculative and confirmed cursors. */
  readonly predicted: ParticipantInputs;
  readonly inputs: ParticipantInputs;
  readonly row: MatchFrameInput;
  confirmed: ReplayState;
  admitted: number;
  /** "slot frame pressed released" for every edge the confirmed match ran. */
  readonly applied: string[];
  stalls: number;
}

interface Message {
  readonly sender: number;
  readonly due: number;
  readonly wire: string;
}

/** A started two-human match on stage 0 with nine stocks; slot 1's fighter is a computer when asked. */
function match(computerSlotOne: boolean): MatchState {
  const game = createMatchState();
  setParticipants(game, 0b11, 0);
  selectCharacter(game, 0, Character.archer);
  selectCharacter(game, 1, Character.rifleman);
  if (computerSlotOne) assertTrue(cycleSlotMode(game, 1, 1));
  assertTrue(requestStageSelect(game, 0));
  game.stockCount = 9;
  assertTrue(requestStart(game, 0));
  game.timeLimitMinutes = 0;
  return game;
}

function world(source: Readonly<MatchState>): ReplayState {
  const game = createMatchState();
  copyMatchState(game, source);
  const roster = createRoster(fighterMask(game));
  for (const slot of PARTICIPANT_SLOTS) {
    if (fighterActive(game, slot)) roster.fighters[slot] = createFighter(slot === 0 ? Character.archer : Character.rifleman, matchSpawnX(slot), slot === 0 ? 1 : -1);
  }
  initializeMatchFighters(game, roster);
  return { world: roster, match: game, controls: createFrameControls(), runtime: createReplayRuntimeState() };
}

/**
 * Both clients and the ordered synchronized channel between them, callback
 * by callback in the shell's order. The confirmed match runs on accepted rows;
 * the speculative cursor advances without running frames, since prediction
 * and replay are rollback's own contracts.
 */
class TwoClients {
  readonly clients: readonly Client[] = [0, 1].map(slot => ({
    slot, schedule: new ShadowInputSchedule(), outgoing: new OutgoingInput(), predicted: participantInputs(), inputs: participantInputs(),
    row: createMatchFrameInput(), confirmed: createReplaySnapshot(), admitted: 0, applied: [], stalls: 0,
  }));
  /** Callbacks at which each slot sent a message. */
  readonly sends: [number[], number[]] = [[], []];
  private callback = 0;
  private network: Message[] = [];

  constructor(readonly scripts: readonly InputRow[][]) {}

  begin(epoch: number, game: Readonly<MatchState>): void {
    for (const client of this.clients) {
      assertTrue(client.schedule.beginEpoch(epoch, 0, WINDOW, game.humanMask));
      client.outgoing.begin(epoch, 1);
      client.confirmed = world(game);
      client.admitted = 0;
    }
  }

  step(epoch: number, produced: number): void {
    this.callback++;
    for (const client of this.clients) this.service(client, epoch, produced);
    while (this.network.length > 0 && (this.network[0]?.due ?? 0) <= this.callback) {
      const { sender, wire } = assertDefined(this.network.shift());
      const packets = assertDefined(decodeTransport(wire), "decoded message");
      for (const client of this.clients) for (const packet of packets) assertEquals(client.schedule.acceptSynchronized(sender, packet), "accepted");
    }
  }

  private service(client: Client, epoch: number, produced: number): void {
    const { schedule, outgoing, slot, confirmed } = client;
    outgoing.tick();
    // The helper's packets carry two frames, and the shell admits one packet a callback.
    const latest = Math.min(produced, client.admitted + 2, schedule.nextConfirmedFrame() - 1 + FUTURE_LIMIT);
    for (let frame = client.admitted + 1; frame <= latest; frame++) {
      const input = this.scripts[slot]?.[frame] ?? NEUTRAL;
      assertEquals(schedule.captureLocalAt(epoch, frame, input), Capture.captured);
      assertTrue(outgoing.admit(frame, input));
      client.admitted = frame;
    }
    const message = outgoing.ready(DEFAULT_BATCH);
    if (message !== undefined) {
      this.network.push({ sender: slot, due: this.callback + CHANNEL_CALLBACKS, wire: message.wire });
      this.sends[slot === 0 ? 0 : 1].push(this.callback);
      outgoing.sent(message);
    }
    for (let steps = 0; steps < CATCH_UP && schedule.mayAdvanceConfirmed(); steps++) {
      const frame = schedule.nextConfirmedFrame();
      for (const sender of [0, 1]) {
        const ran = assertDefined(schedule.accepted(epoch, sender, frame), "accepted row");
        assertTrue(sameInput(ran, this.scripts[sender]?.[frame] ?? NEUTRAL));
        if (ran.pressed !== 0 || ran.released !== 0) client.applied.push(`${sender} ${frame} ${ran.pressed} ${ran.released}`);
      }
      assertTrue(schedule.readConfirmed(epoch, client.inputs));
      assertTrue(captureNetworkFrame(client.row, frame, client.inputs, confirmed.world, confirmed.match.humanMask));
      assertTrue(executeMatchFrame(client.row, confirmed.match, confirmed.world, confirmed.controls, confirmed.runtime, frame));
      assertTrue(schedule.completeConfirmed(epoch, frame));
    }
    const before = schedule.speculativeFrame();
    for (let steps = 0; steps < CATCH_UP && schedule.mayAdvanceSpeculativeFor(slot); steps++) {
      const frame = schedule.speculativeFrame();
      assertTrue(schedule.resolveSpeculative(epoch, slot, client.predicted) !== undefined);
      assertTrue(schedule.completeSpeculative(epoch, frame));
    }
    // The shell's prediction stall: the frontier waits at the window past K.
    if (schedule.speculativeFrame() === before && before > schedule.knownThrough() + WINDOW) client.stalls++;
  }

  /** Every edge the scripts hold for frames 1 through last, in confirmation order. */
  expectedEdges(last: number): string[] {
    const edges: string[] = [];
    for (let frame = 1; frame <= last; frame++) {
      for (const sender of [0, 1]) {
        const input = this.scripts[sender]?.[frame] ?? NEUTRAL;
        if (input.pressed !== 0 || input.released !== 0) edges.push(`${sender} ${frame} ${input.pressed} ${input.released}`);
      }
    }
    return edges;
  }
}

/** The most messages one slot sent in any 60 consecutive callbacks. */
function busiestSecond(sends: readonly number[]): number {
  let busiest = 0;
  let start = 0;
  for (let end = 0; end < sends.length; end++) {
    while ((sends[end] ?? 0) - (sends[start] ?? 0) >= 60) start++;
    busiest = Math.max(busiest, end - start + 1);
  }
  return busiest;
}

/** One frame arrives per callback, none during a pause after pauseAfter, and the channel drains at the end. */
function playEpoch(clients: TwoClients, epoch: number, game: Readonly<MatchState>, frames: number, pauseAfter: number | undefined): void {
  clients.begin(epoch, game);
  for (let produced = 1; produced <= frames; produced++) {
    clients.step(epoch, produced);
    if (produced !== pauseAfter) continue;
    // Start pause: no frames arrive, and every admitted frame reaches both clients before the resume.
    for (let callback = 0; callback < WINDOW; callback++) clients.step(epoch, produced);
    for (const client of clients.clients) {
      assertEquals(client.outgoing.pending(), 0);
      assertEquals(client.schedule.knownThrough(), produced);
    }
  }
  for (let callback = 0; callback < WINDOW; callback++) clients.step(epoch, frames);
  const expected = clients.expectedEdges(frames).join("\n");
  for (const client of clients.clients) {
    assertEquals(client.schedule.nextConfirmedFrame(), frames + 1);
    assertEquals(client.applied.join("\n"), expected);
    assertEquals(client.stalls, 0);
    client.applied.length = 0;
  }
  const [first, second] = clients.clients;
  assertEquals(stateChecksum(assertDefined(first).confirmed), stateChecksum(assertDefined(second).confirmed));
}

test("two clients under dense input send at most 10 messages a second and confirm every edge once on its own frame", () => {
  const frames = 120;
  const clients = new TwoClients([denseScript(0, frames), denseScript(1, frames)]);
  playEpoch(clients, 1, match(false), frames, 75);
  // The rematch after a slot change: slot 1's human still sends while a computer plays its fighter.
  const rematch = match(true);
  assertFalse(humanFighterActive(rematch, 1));
  playEpoch(clients, 2, rematch, 60, undefined);
  for (const sends of clients.sends) {
    assertEquals(busiestSecond(sends), 10);
    assertGreaterThan(sends.length, 30);
  }
});
