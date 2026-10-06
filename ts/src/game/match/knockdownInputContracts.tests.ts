// Knockdown options through a controller's real input path: rows built as
// the companion helper builds them (companion/src/bin/journal.rs), read as
// journal packets, carried in the synchronized input message and adapted by
// the match frame executor, after a low-, medium- and high-percent knockdown.
import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit, has } from "../input/actions";
import { type InputRow, copyInput, inputRow } from "../input/inputRow";
import { participantInputs } from "../input/participants";
import { decodeInputMessage, encodeInputMessage, encodePacket, inputPacket } from "../input/wire";
import { JournalInputSource } from "../netcode/journal/source";
import { Character, DownState } from "../sim/codes";
import { isTumbling } from "../sim/conditions";
import { DOWN_BOUND_FRAMES, DOWN_WAIT_FRAMES } from "../sim/down";
import { type Fighter, createFighter } from "../sim/fighter";
import { captureNetworkFrame, executeMatchFrame } from "./frameInput";
import { type TestMatch, testMatch } from "./testMatch";

const EPOCH = 3;
const RAW = 32767;
/** The helper's digital thresholds on raw axes. */
const STICK_DIGITAL = 7000;
const C_STICK_DIGITAL = 11000;
const TRIGGER_DIGITAL = 4000;

/** A controller's state on one frame: sticks in [-1, 1] with up positive, buttons by role. */
interface Pad {
  readonly x?: number;
  readonly y?: number;
  readonly cx?: number;
  readonly cy?: number;
  readonly attack?: boolean;
  readonly special?: boolean;
  readonly trigger?: boolean;
}

const raw = (value: number | undefined) => Math.trunc((value ?? 0) * RAW);
const axisByte = (rawValue: number) => Math.max(-127, Math.min(127, Math.trunc((rawValue * 127) / RAW)));
const signOf = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0);
const beyond = (rawValue: number) => (Math.abs(rawValue) > STICK_DIGITAL ? signOf(rawValue) : 0);

/** The helper's action mask for a pad (journal.rs action_state); stick up also jumps. */
function heldActions(pad: Pad): number {
  const x = raw(pad.x);
  const up = raw(pad.y);
  let held = 0;
  if (pad.attack === true) held |= bit(Action.attack);
  if (pad.special === true) held |= bit(Action.special);
  if (x < -STICK_DIGITAL) held |= bit(Action.moveLeft);
  if (x > STICK_DIGITAL) held |= bit(Action.moveRight);
  if (up < -STICK_DIGITAL) held |= bit(Action.moveDown);
  if (up > STICK_DIGITAL) held |= bit(Action.moveUp) | bit(Action.jump);
  if (raw(pad.cx) > C_STICK_DIGITAL) held |= bit(Action.smashRight);
  if (raw(pad.cx) < -C_STICK_DIGITAL) held |= bit(Action.smashLeft);
  if (raw(pad.cy) > C_STICK_DIGITAL) held |= bit(Action.smashUp);
  if (pad.trigger === true && RAW > TRIGGER_DIGITAL) held |= bit(Action.leftTrigger);
  return held;
}

/** One frame's row as the helper records the change from previous to pad (journal.rs encode_row and its edges). */
function helperRow(previous: Pad, pad: Pad): InputRow {
  const before = heldActions(previous);
  const held = heldActions(pad);
  const pressed = held & ~before;
  const x = raw(pad.x);
  const up = raw(pad.y);
  const axis = (mask: number, negative: Action, positive: Action) => (has(mask, positive) ? 1 : 0) - (has(mask, negative) ? 1 : 0);
  const afterX = axis(held, Action.moveLeft, Action.moveRight);
  const afterZ = axis(held, Action.moveDown, Action.moveUp);
  const sdi = (afterX !== 0 && afterX !== axis(before, Action.moveLeft, Action.moveRight)) || (afterZ !== 0 && afterZ !== axis(before, Action.moveDown, Action.moveUp));
  return assertDefined(inputRow({
    held, pressed, released: before & ~held,
    axisX: axisByte(x), axisZ: axisByte(up),
    triggerLeft: pad.trigger === true ? 255 : 0,
    specialX: has(pressed, Action.special) ? beyond(x) : 0,
    specialZ: has(pressed, Action.special) ? beyond(up) : 0,
    dodgeX: has(pressed, Action.leftTrigger) ? beyond(x) : 0,
    dodgeZ: has(pressed, Action.leftTrigger) ? beyond(up) : 0,
    ledgeVertical: has(pressed, Action.moveUp) ? 1 : has(pressed, Action.moveDown) ? -1 : 0,
    sdi, sdiX: sdi ? afterX : 0, sdiZ: sdi ? afterZ : 0,
  }), "helper row");
}

interface Run {
  readonly match: TestMatch;
  readonly victim: Fighter;
  readonly journals: readonly [JournalInputSource, JournalInputSource];
  readonly previous: [Pad, Pad];
}

const ATTACKER_X = -560.0;
const VICTIM_X = -460.0;

/** An archer facing a victim of the given character and percent, both reading journals. */
function startRun(victimCharacter: Character, percent: number): Run {
  const match = testMatch(3, Character.archer);
  match.world.fighters[0] = createFighter(Character.archer, ATTACKER_X, 1);
  const victim = createFighter(victimCharacter, VICTIM_X, -1);
  victim.status.damage = percent;
  match.world.fighters[1] = victim;
  const journal = (slot: number) => assertDefined(JournalInputSource.open("knockdown", EPOCH, slot, 0), "journal");
  return { match, victim, journals: [journal(0), journal(1)], previous: [{}, {}] };
}

/** Plays one frame: each pad becomes a helper row, a journal packet and a synchronized message before the match adapts it. */
function playFrame(run: Run, attacker: Pad, victim: Pad): void {
  const { match } = run;
  const frame = match.runtime.simulationFrame + 1;
  const rows = participantInputs();
  const pads = [attacker, victim] as const;
  for (const slot of [0, 1] as const) {
    const row = helperRow(run.previous[slot], pads[slot]);
    run.previous[slot] = pads[slot];
    const journal = run.journals[slot];
    const read = journal.read(encodePacket(assertDefined(inputPacket(EPOCH, frame, [row]), "packet")), frame);
    assertTrue(read.kind === "ready");
    const journaled = read.kind === "ready" ? read.packet.rows[0] : undefined;
    assertTrue(journal.sent());
    const message = encodeInputMessage(EPOCH, frame, frame, () => assertDefined(journaled, "journaled row"));
    const delivered = assertDefined(decodeInputMessage(message.wire), "message")[0]?.rows[0];
    copyInput(rows[slot], assertDefined(delivered, "delivered row"));
  }
  assertTrue(captureNetworkFrame(match.row, frame, rows, match.world, 3));
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, frame));
}

/** Plays the strike, then the victim's pads, until the victim lands out of tumble; returns that frame. */
function knockDown(run: Run, strike: Pad, victimPadAt: (frame: number) => Pad): number {
  for (let frame = 1; frame <= 120; frame++) {
    playFrame(run, frame === 1 ? strike : {}, victimPadAt(frame));
    const { victim } = run;
    if (frame > 1 && victim.motion.grounded && victim.launch.hitlag === 0 && !isTumbling(victim) && victim.down.state !== DownState.none) return frame;
  }
  throw new Error("the victim never landed from tumble");
}

/** Plays neutral strikes and the victim's pads through frame last. */
function playThrough(run: Run, last: number, victimPadAt: (frame: number) => Pad): void {
  for (let frame = run.match.runtime.simulationFrame + 1; frame <= last; frame++) playFrame(run, {}, victimPadAt(frame));
}

interface Knockdown {
  readonly name: string;
  readonly victim: Character;
  readonly percent: number;
  /** The archer's frame-1 strike: a C-stick forward smash, or a jab for the farther high-percent launch. */
  readonly strike: Pad;
}

const KNOCKDOWNS: readonly Knockdown[] = [
  { name: "low", victim: Character.archer, percent: 10.0, strike: { cx: 1.0 } },
  { name: "mid", victim: Character.rifleman, percent: 50.0, strike: { cx: 1.0 } },
  { name: "high", victim: Character.demonHunter, percent: 100.0, strike: { attack: true } },
];

const NEUTRAL = (): Pad => ({});

/** The knockdown's landing frame when the victim presses nothing. */
function missedTechLanding(knockdown: Knockdown): number {
  const run = startRun(knockdown.victim, knockdown.percent);
  const landing = knockDown(run, knockdown.strike, NEUTRAL);
  assertEquals(run.victim.down.state, DownState.bound, knockdown.name);
  return landing;
}

/** The bound's last frame and the frame Melee's DownBound ends, after landing (melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c ftCo_DownBound_Anim). */
const boundEnd = (landing: number) => landing + DOWN_BOUND_FRAMES;

test("a trigger press before a tumble landing techs through the journal path at low, medium and high percent", () => {
  for (const knockdown of KNOCKDOWNS) {
    const landing = missedTechLanding(knockdown);
    const run = startRun(knockdown.victim, knockdown.percent);
    // Inside the 20-frame window after hitlag (common +0x250; ftCo_DownAttack.c ftCo_800986B0), while hitstun blocks an air dodge.
    assertEquals(knockDown(run, knockdown.strike, (frame) => ({ trigger: frame === landing - 5 })), landing, knockdown.name);
    assertEquals(run.victim.down.state, DownState.tech, knockdown.name);
  }
});

test("an attack pressed during the bound starts the get-up attack as Melee's bound ends", () => {
  for (const knockdown of KNOCKDOWNS) {
    const run = startRun(knockdown.victim, knockdown.percent);
    const landing = knockDown(run, knockdown.strike, NEUTRAL);
    const pad = (frame: number): Pad => ({ attack: frame === landing + 5 });
    playThrough(run, boundEnd(landing) - 1, pad);
    assertEquals(run.victim.down.state, DownState.bound, knockdown.name);
    playThrough(run, boundEnd(landing), pad);
    assertEquals(run.victim.down.state, DownState.attack, knockdown.name);
  }
});

test("a stick held sideways rolls forward or back, and held up stands, as Melee's bound ends", () => {
  for (const knockdown of KNOCKDOWNS) {
    for (const [stick, state, direction] of [[{ x: -1.0 }, DownState.roll, -1], [{ x: 1.0 }, DownState.roll, 1], [{ y: 1.0 }, DownState.stand, 0]] as const) {
      const run = startRun(knockdown.victim, knockdown.percent);
      const landing = knockDown(run, knockdown.strike, NEUTRAL);
      const pad = (frame: number): Pad => (frame >= landing + 5 ? stick : {});
      playThrough(run, boundEnd(landing) - 1, pad);
      assertEquals(run.victim.down.state, DownState.bound, knockdown.name);
      playThrough(run, boundEnd(landing), pad);
      assertEquals(run.victim.down.state, state, knockdown.name);
      assertEquals(run.victim.down.direction, direction, knockdown.name);
    }
  }
});

test("the down wait takes Special, takes a trigger press, and stands by itself after Melee's 220 frames", () => {
  // Common +0x424 = 220 (ftCo_DownBound.c ftCo_80097E8C, ftCo_DownWait_Anim); A or B strikes (ftCo_DownAttack.c), L or R stands (ftCo_DownStand.c).
  const [low, mid, high] = [assertDefined(KNOCKDOWNS[0]), assertDefined(KNOCKDOWNS[1]), assertDefined(KNOCKDOWNS[2])];
  for (const [knockdown, pad, state] of [[low, { special: true }, DownState.attack], [mid, { trigger: true }, DownState.stand]] as const) {
    const run = startRun(knockdown.victim, knockdown.percent);
    const landing = knockDown(run, knockdown.strike, NEUTRAL);
    const pressAt = boundEnd(landing) + 20;
    playThrough(run, pressAt - 1, NEUTRAL);
    assertEquals(run.victim.down.state, DownState.wait, knockdown.name);
    playThrough(run, pressAt, (frame) => (frame === pressAt ? pad : {}));
    assertEquals(run.victim.down.state, state, knockdown.name);
  }
  const run = startRun(high.victim, high.percent);
  const landing = knockDown(run, high.strike, NEUTRAL);
  playThrough(run, boundEnd(landing) + DOWN_WAIT_FRAMES - 1, NEUTRAL);
  assertEquals(run.victim.down.state, DownState.wait);
  playThrough(run, boundEnd(landing) + DOWN_WAIT_FRAMES, NEUTRAL);
  assertEquals(run.victim.down.state, DownState.stand);
});

test("a C-stick up flick during the wait starts the get-up attack and a sideways flick rolls that way", () => {
  // melee:src/melee/ft/kinds/ftCommon/ftCo_Down.c ftCo_Down_CheckInput (sideways cstick, ftCo_800DF678) and
  // ftCo_DownAttack.c ftCo_800984D4 (up flick, ftCo_800DF644 against common +0x7F4) read the C-stick edge.
  for (const knockdown of KNOCKDOWNS) {
    for (const [flick, state, direction] of [[{ cy: 1.0 }, DownState.attack, 0], [{ cx: -1.0 }, DownState.roll, -1], [{ cx: 1.0 }, DownState.roll, 1]] as const) {
      const run = startRun(knockdown.victim, knockdown.percent);
      const landing = knockDown(run, knockdown.strike, NEUTRAL);
      const flickAt = boundEnd(landing) + 20;
      const pad = (frame: number): Pad => (frame >= flickAt ? flick : {});
      playThrough(run, flickAt - 1, pad);
      assertEquals(run.victim.down.state, DownState.wait, knockdown.name);
      playThrough(run, flickAt, pad);
      assertEquals(run.victim.down.state, state, knockdown.name);
      assertEquals(run.victim.down.direction, direction, knockdown.name);
    }
  }
});

test("a C-stick flick as Melee's bound ends gets up, and one held through the wait does nothing", () => {
  for (const [flick, state, direction] of [[{ cy: 1.0 }, DownState.attack, 0], [{ cx: 1.0 }, DownState.roll, 1]] as const) {
    const run = startRun(Character.archer, 10.0);
    const landing = knockDown(run, { cx: 1.0 }, NEUTRAL);
    const pad = (frame: number): Pad => (frame === boundEnd(landing) ? flick : {});
    playThrough(run, boundEnd(landing), pad);
    assertEquals(run.victim.down.state, state);
    assertEquals(run.victim.down.direction, direction);
  }
  const run = startRun(Character.archer, 10.0);
  const landing = knockDown(run, { cx: 1.0 }, NEUTRAL);
  const held = (frame: number): Pad => (frame >= landing + 5 ? { cy: 1.0 } : {});
  playThrough(run, boundEnd(landing) + 20, held);
  assertEquals(run.victim.down.state, DownState.wait);
});
