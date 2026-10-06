// Victim agency (#68, smashcraft:docs/gameplay-design.md "No false agency").
// From a match state, the next frames run once as the players play them,
// then again for each frame with the victim's input on that frame changed by
// each input class: the stick moved in eight directions or to neutral
// (directional influence, and drift), smash DI pulses, the buttons alone
// (none, a trigger for shield or tech in place, jump, and the buttons a
// player mashes), and a trigger with the stick left, right, up or down (tech
// rolls, air dodges). A class matters on a frame when its replay's fighters
// move, act or take damage differently from the played frames before the
// window ends. A frame where no class matters has no agency; one where only
// classes that move the stick matter is DI only; one where the buttons alone
// matter lets the victim act. Every replay runs through the frame executor
// the match runs, from copies of replay state.
import { Action, bit } from "../src/game/input/actions";
import { type InputRow, copyInput, emptyInput, inputRow, sameInput } from "../src/game/input/inputRow";
import { PARTICIPANT_SLOTS, participantInputs } from "../src/game/input/participants";
import { captureNetworkFrame, createMatchFrameInput, executeMatchFrame, resetMatchFrameInput } from "../src/game/match/frameInput";
import { computerActive } from "../src/game/match/rules";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../src/game/replay/snapshot";
import { TECH_REPEAT_MINIMUM_AGE_FRAMES } from "../src/game/physics/techInput";
import { DownState, ShieldBreak } from "../src/game/sim/codes";
import { grabHoldFrames } from "../src/game/sim/moves";
import type { Fighter } from "../src/game/sim/fighter";
import { fighterAt, isActive } from "../src/game/sim/roster";

/**
 * One way to change the victim's input on a frame, made from the row it
 * played: the stick alone (the buttons as played), the buttons alone (the
 * stick as played), or both.
 */
export interface InputClass {
  readonly name: string;
  readonly changes: "stick" | "buttons" | "both";
  readonly row: (played: Readonly<InputRow>) => InputRow;
}

const FULL = 127;
const DIRECTIONS = [
  ["up", 0, 1], ["up-right", 1, 1], ["right", 1, 0], ["down-right", 1, -1],
  ["down", 0, -1], ["down-left", -1, -1], ["left", -1, 0], ["up-left", -1, 1],
] as const;
const STICK_BITS = bit(Action.moveLeft) | bit(Action.moveRight) | bit(Action.moveDown) | bit(Action.moveUp);
const TRIGGER = bit(Action.leftTrigger);
const TRIGGERS = bit(Action.leftTrigger) | bit(Action.rightTrigger);
const sign = (value: number) => (value > 0 ? 1 : value < 0 ? -1 : 0);

function stickBits(x: number, z: number): number {
  return (x < 0 ? bit(Action.moveLeft) : 0) | (x > 0 ? bit(Action.moveRight) : 0) | (z < 0 ? bit(Action.moveDown) : 0) | (z > 0 ? bit(Action.moveUp) : 0);
}

interface Hand {
  /** Held and newly pressed buttons other than the stick's directions. */
  readonly held: number;
  readonly pressed: number;
  readonly triggerLeft: number;
  readonly triggerRight: number;
}

interface Stick {
  readonly x: number;
  readonly z: number;
  readonly held: number;
  readonly pressed: number;
  readonly sdi: boolean;
  readonly sdiX: number;
  readonly sdiZ: number;
}

const handOf = (row: Readonly<InputRow>): Hand => ({
  held: row.held & ~STICK_BITS, pressed: row.pressed & ~STICK_BITS, triggerLeft: row.triggerLeft, triggerRight: row.triggerRight,
});
const stickOf = (row: Readonly<InputRow>): Stick => ({
  x: row.axisX, z: row.axisZ, held: row.held & STICK_BITS, pressed: row.pressed & STICK_BITS, sdi: row.sdi, sdiX: row.sdiX, sdiZ: row.sdiZ,
});

/** The stick moved to (x, z), whole directions, on this frame; an SDI pulse with it when `sdi`. */
const flick = (x: number, z: number, sdi = false): Stick => ({
  x: x * FULL, z: z * FULL, held: stickBits(x, z), pressed: stickBits(x, z), sdi, sdiX: sdi ? x : 0, sdiZ: sdi ? z : 0,
});

/** `buttons` pressed on this frame. */
const pressing = (buttons: number): Hand => ({
  held: buttons, pressed: buttons, triggerLeft: (buttons & TRIGGER) !== 0 ? 255 : 0, triggerRight: 0,
});

/** A controller row of a hand and a stick; press vectors follow the stick. */
function combine(hand: Hand, stick: Stick): InputRow {
  const triggerPressed = (hand.pressed & TRIGGERS) !== 0;
  const specialPressed = (hand.pressed & bit(Action.special)) !== 0;
  const row = inputRow({
    held: hand.held | stick.held, pressed: hand.pressed | stick.pressed, axisX: stick.x, axisZ: stick.z,
    triggerLeft: hand.triggerLeft, triggerRight: hand.triggerRight,
    dodgeX: triggerPressed ? sign(stick.x) : 0, dodgeZ: triggerPressed ? sign(stick.z) : 0,
    specialX: specialPressed ? sign(stick.x) : 0, specialZ: specialPressed ? sign(stick.z) : 0,
    sdi: stick.sdi, sdiX: stick.sdiX, sdiZ: stick.sdiZ,
  });
  if (row === undefined) throw new Error(`no controller sends buttons ${hand.held}/${hand.pressed} with stick ${stick.x},${stick.z}`);
  return row;
}

const stickClass = (name: string, stick: Stick): InputClass => ({ name, changes: "stick", row: (played) => combine(handOf(played), stick) });
const buttonClass = (name: string, buttons: number): InputClass => ({ name, changes: "buttons", row: (played) => combine(pressing(buttons), stickOf(played)) });
const bothClass = (name: string, buttons: number, x: number, z: number): InputClass => ({ name, changes: "both", row: () => combine(pressing(buttons), flick(x, z)) });

/** Every input class the detector tries. */
export const INPUT_CLASSES: readonly InputClass[] = [
  stickClass("stick neutral", flick(0, 0)),
  ...DIRECTIONS.map(([name, x, z]) => stickClass(`DI ${name}`, flick(x, z))),
  ...DIRECTIONS.map(([name, x, z]) => stickClass(`SDI ${name}`, flick(x, z, true))),
  buttonClass("no buttons", 0),
  buttonClass("shield or tech in place", TRIGGER),
  buttonClass("jump", bit(Action.jump)),
  buttonClass("attack (mash)", bit(Action.attack)),
  buttonClass("special (mash)", bit(Action.special)),
  buttonClass("grab (mash)", bit(Action.grab)),
  bothClass("tech or roll left", TRIGGER, -1, 0),
  bothClass("tech or roll right", TRIGGER, 1, 0),
  bothClass("air dodge up", TRIGGER, 0, 1),
  bothClass("air dodge down", TRIGGER, 0, -1),
  bothClass("up special", bit(Action.special), 0, 1),
  bothClass("down special", bit(Action.special), 0, -1),
  bothClass("side special left", bit(Action.special), -1, 0),
  bothClass("side special right", bit(Action.special), 1, 0),
];

/** The stick-only class with the same stick as a class that changes both: if it matters too, the stick may be all that did. */
const stickPart = new Map(INPUT_CLASSES.filter(({ changes }) => changes === "both").map((both) => {
  const probe = both.row(emptyInput());
  const same = INPUT_CLASSES.find((other) => other.changes === "stick" && !other.name.startsWith("SDI")
    && sameInput(other.row(emptyInput()), combine(pressing(0), flick(Math.sign(probe.axisX), Math.sign(probe.axisZ)))));
  if (same === undefined) throw new Error(`no stick class moves the stick as ${both.name} does`);
  return [both, same] as const;
}));

/** What the victim's input can do on a frame. */
type Agency = "none" | "di" | "act";

/** A situation to analyse: the match after the frame before the first analysed one. */
interface Situation {
  readonly start: Readonly<ReplayState>;
  readonly victim: number;
  /** Frames to analyse, from the one after the start. */
  readonly frames: number;
  /**
   * Played frames after those, through which a replay may still show a
   * difference: mashing shortens a hold that ends later, and a press can be
   * buffered. A replay still different only in input memories at the end
   * counts as changing nothing.
   */
  readonly horizon?: number;
  /**
   * Stop once the victim could act on this many frames in a row (1: at the
   * first) or a loop came round, and list only enough classes on a frame it
   * could act on to show it: all that is wanted is how long it stays under
   * control.
   */
  readonly untilFree?: number;
  /**
   * The row a human slot plays `frame` with, given the match before it; a
   * computer slot chooses its own. The victim's are the played rows the
   * classes replace.
   */
  readonly row: (slot: number, frame: number, state: Readonly<ReplayState>) => Readonly<InputRow>;
}

interface FrameAgency {
  readonly frame: number;
  readonly agency: Agency;
  /** The classes that change what happens. */
  readonly classes: readonly string[];
}

/** Consecutive frames on which the victim can't act: input changes nothing, or only the stick does. */
interface Stretch {
  readonly from: number;
  readonly to: number;
  readonly length: number;
  /** Frames within it where only the stick changes what happens. */
  readonly diFrames: number;
}

/** The match coming back to an equivalent state, with what the victim could do in between. */
export interface Loop {
  readonly from: number;
  readonly to: number;
  readonly fromPercent: number;
  readonly toPercent: number;
  /** Frames within the cycle where only the stick changes what happens. */
  readonly diFrames: number;
  /** Frames of the cycle on which the victim could act: its escapes, 0 for none. */
  readonly escapeFrames: number;
}

/**
 * Consecutive frames on which the victim can act that end a loop's search:
 * about a visual reaction, the time a player needs to notice the chance.
 * Shorter windows are counted in the loop instead, as escapes it allows.
 */
export const ESCAPE_FRAMES = 20;

/** An escape window this short is a frame-tight input, not a choice a player can see coming: a loop that leaves no more is reported as one with no escape worth the name. */
export const TIGHT_ESCAPE = 3;

export interface AgencyReport {
  readonly frames: readonly FrameAgency[];
  readonly stretches: readonly Stretch[];
  readonly loop: Loop | undefined;
  /** The played frames' states: index 0 is the start, i the match after the start's frame + i. */
  readonly states: readonly ReplayState[];
}

const scratch = { row: createMatchFrameInput(), inputs: participantInputs() };

/** Runs one frame of `state` with every active slot's row from `rows`; a computer slot chooses its own. */
export function runFrame(state: ReplayState, rows: (slot: number) => Readonly<InputRow>): void {
  const frame = state.runtime.simulationFrame + 1;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(state.world, slot)) copyInput(scratch.inputs[slot], rows(slot));
  resetMatchFrameInput(scratch.row);
  if (!captureNetworkFrame(scratch.row, frame, scratch.inputs, state.world, state.world.mask)
    || !executeMatchFrame(scratch.row, state.match, state.world, state.controls, state.runtime, frame)) {
    throw new Error(`frame ${frame} did not run`);
  }
}

export function snapshotOf(state: Readonly<ReplayState>): ReplayState {
  const copy = createReplaySnapshot();
  copyReplayState(copy, state);
  return copy;
}

/** Plain data equal field by field; tuning records are shared, so most compare by reference. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number") return typeof b === "number" && a !== a && b !== b;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let index = 0; index < a.length; index++) if (!sameData(a[index], b[index])) return false;
    return true;
  }
  return sameRecord(a, b, undefined);
}

/** Records of one shape, every field but `skip` equal. */
function sameRecord(a: object, b: object, skip: string | undefined): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) if (key !== skip && !sameData(Reflect.get(a, key), Reflect.get(b, key))) return false;
  return true;
}

/** Tech press ages at or past the repeat lockout all mean the same (techInputEligible). */
const techAge = (age: number) => Math.min(age, TECH_REPEAT_MINIMUM_AGE_FRAMES);

function sameFighter(a: Readonly<Fighter>, b: Readonly<Fighter>): boolean {
  if (!sameRecord(a, b, "tech")) return false;
  const { tech } = a;
  return tech.window === b.tech.window && tech.accumulatedPress === b.tech.accumulatedPress
    && techAge(tech.pressAge) === techAge(b.tech.pressAge) && techAge(tech.previousPressAge) === techAge(b.tech.previousPressAge);
}

/**
 * The gameplay state firstStateDifference compares, with tech press ages past
 * the lockout taken as equal: once two runs reach equal states, their futures
 * are equal.
 */
export function sameGameplay(a: Readonly<ReplayState>, b: Readonly<ReplayState>): boolean {
  if (a.world.mask !== b.world.mask || a.runtime.simulationFrame !== b.runtime.simulationFrame) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(a.world, slot)) continue;
    if (!sameFighter(fighterAt(a.world, slot), fighterAt(b.world, slot)) || !sameData(a.controls.commands[slot], b.controls.commands[slot])) return false;
    if (a.runtime.botAttackDelays[slot] !== b.runtime.botAttackDelays[slot]) return false;
  }
  return sameData(a.match, b.match);
}

/**
 * What a frame shows of each fighter: where it is and how it moves, what it
 * is doing and for how long, its damage, shield and stocks, and its
 * projectiles and summons. Input memories (stick and press ages, mash
 * direction, buffered commands, the hold timer) are left out: they matter
 * only once they change one of these.
 */
function outcome(state: Readonly<ReplayState>, out: number[]): number[] {
  out.length = 0;
  const flag = (value: boolean) => (value ? 1 : 0);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(state.world, slot)) continue;
    const f = fighterAt(state.world, slot);
    const { motion, launch, attack, special, grab, down, dodge, shield, jump, ledge, status, ground } = f;
    out.push(
      f.facing, motion.x, motion.z, motion.vx, motion.vz, flag(motion.grounded), motion.surface ?? -1, flag(motion.crouching), flag(motion.fastFalling),
      f.platform.move, f.platform.frame, ground.action, ground.dashFrame, launch.knockbackX, launch.knockbackZ, launch.groundKnockbackX, launch.hitstun, launch.hitlag,
      attack.style ?? -1, attack.frame, attack.serial, attack.cooldown, flag(attack.smashCharging), special.action, special.frame, flag(special.fall),
      grab.action, grab.frame, grab.owner ?? -1, grab.target ?? -1, down.state, down.frame, down.direction, flag(dodge.airDodging), dodge.airFrame,
      dodge.groundFrame, dodge.groundDirection, flag(shield.raised), shield.energy, shield.stun, shield.breakState, jump.remaining, jump.squat, jump.serial,
      ledge.state, ledge.frame, f.landing.lag, f.surfaceRecovery.state, status.damage, status.stocks, flag(status.out), status.respawn, status.invincible,
      status.frozenFrames, status.freezeImmunityFrames, f.bear.life, f.bear.x, f.bear.z, f.hippogryph.life, f.hippogryph.x, f.hippogryph.z, f.freezeTrap.life, f.freezeTrap.x,
    );
    for (const projectile of f.projectiles) if (projectile.life > 0) out.push(projectile.life, projectile.x, projectile.z);
  }
  return out;
}

function sameOutcome(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index] && !(a[index] !== a[index] && b[index] !== b[index])) return false;
  return true;
}

const rounded = (value: number, step: number) => Math.round(value / step);

/**
 * The match as the victim experiences it, up to a mirror and a shift along
 * the deck: what each fighter is doing and for how long, where the others
 * are relative to the victim, how everyone moves, and heights. Damage is left
 * out, so a loop that adds percent each time round still repeats.
 */
export function situationKey(state: Readonly<ReplayState>, victim: number): string {
  const v = fighterAt(state.world, victim);
  const mirror = v.facing < 0 ? -1 : 1;
  const parts: (number | string)[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(state.world, slot)) continue;
    const f = fighterAt(state.world, slot);
    const { motion, launch, attack, special, grab, down, dodge, shield, jump, ledge, status } = f;
    parts.push(
      slot === victim ? "v" : "o", f.character, f.facing * mirror, rounded((motion.x - v.motion.x) * mirror, 0.5), rounded(motion.z, 0.5),
      rounded(motion.vx * mirror, 0.05), rounded(motion.vz, 0.05), motion.grounded ? 1 : 0, motion.surface ?? -1,
      rounded(launch.knockbackX * mirror, 0.05), rounded(launch.knockbackZ, 0.05), launch.hitstun, launch.hitlag,
      attack.style ?? -1, attack.frame, attack.cooldown, special.action, special.frame, grab.action, grab.frame,
      grab.owner === undefined ? -1 : grab.owner === victim ? 0 : 1, grab.target === undefined ? -1 : grab.target === victim ? 0 : 1,
      down.state, down.frame, down.waitRemaining, dodge.airDodging ? dodge.airFrame : -1, dodge.groundFrame, shield.raised ? 1 : 0, shield.stun,
      shield.breakState, jump.remaining, jump.squat, ledge.state, ledge.frame, f.landing.lag, status.frozenFrames, status.freezeImmunityFrames, status.invincible, status.out ? 1 : 0,
      // Clocks that run on while a fighter is held or waits: a hold that ran down is no loop. A hold is counted
      // from its start, since its length grows with damage, which is left out.
      grab.grabbedFrames > 0 ? grabHoldFrames(status.damage) - grab.grabbedFrames : -1,
      status.respawn, rounded(shield.energy, 1), f.freezeTrap.life, f.freezeTrap.arming, f.freezeTrap.cooldown, f.bear.life, f.hippogryph.life,
      special.cooldowns.join(" "), f.projectiles.map(({ life }) => life).join(" "),
    );
  }
  return parts.join(",");
}

/**
 * The frames as played, extended on demand: states[i] is the match after the
 * start's frame + i, outcomes[i] what it shows, played[i] the victim's row for
 * the frame that made states[i + 1] (undefined for a computer victim).
 */
class PlayedRun {
  readonly states: ReplayState[];
  readonly outcomes: number[][];
  readonly played: (Readonly<InputRow> | undefined)[] = [];
  private readonly state: ReplayState;

  constructor(readonly situation: Situation, readonly limit: number) {
    this.states = [snapshotOf(situation.start)];
    this.outcomes = [outcome(situation.start, [])];
    this.state = snapshotOf(situation.start);
  }

  /** Plays on until states[index] exists, or the limit; whether it does. */
  reach(index: number): boolean {
    const { situation, state } = this;
    while (this.states.length <= Math.min(index, this.limit)) {
      const frame = state.runtime.simulationFrame + 1;
      const rows = PARTICIPANT_SLOTS.map((slot) => (isActive(state.world, slot) ? situation.row(slot, frame, state) : emptyInput()));
      this.played.push(computerActive(state.match, situation.victim) ? undefined : rows[situation.victim]);
      runFrame(state, (slot) => at(rows, slot));
      this.states.push(snapshotOf(state));
      this.outcomes.push(outcome(state, []));
    }
    return index <= this.limit;
  }
}

/**
 * Replays the frame after `run.states[index]` with the victim holding `row`,
 * then the played inputs, until its fighters differ from the played frames
 * (the class matters), its whole state equals theirs (it doesn't), or the
 * run's limit (it doesn't, within the window).
 */
function classMatters(run: PlayedRun, index: number, row: Readonly<InputRow>, branch: ReplayState, scratchOutcome: number[]): boolean {
  const { situation } = run;
  const { victim } = situation;
  copyReplayState(branch, at(run.states, index));
  // A computer victim plays the class on this frame as a human would, and chooses again after it.
  const computer = computerActive(branch.match, victim);
  if (computer) branch.match.computerMask -= 1 << victim;
  const first = branch.runtime.simulationFrame + 1;
  runFrame(branch, (slot) => (slot === victim ? row : situation.row(slot, first, branch)));
  if (computer) branch.match.computerMask += 1 << victim;
  for (let next = index + 1; ; next++) {
    run.reach(next);
    if (!sameOutcome(outcome(branch, scratchOutcome), at(run.outcomes, next))) return true;
    // Equal states stay equal, so checking every few frames only lets a replay run a little past where it rejoined.
    if (next >= run.limit || ((next - index <= 2 || (next - index) % 4 === 0) && sameGameplay(branch, at(run.states, next)))) return false;
    const frame = branch.runtime.simulationFrame + 1;
    runFrame(branch, (slot) => situation.row(slot, frame, branch));
  }
}

function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`no entry ${index}`);
  return value;
}

/** What the victim's input can change on each frame of the situation, the stretches it can't act in, and the first loop. */
export function analyzeAgency(situation: Situation, classes: readonly InputClass[] = INPUT_CLASSES): AgencyReport {
  const { start, victim, frames } = situation;
  const run = new PlayedRun(situation, frames + (situation.horizon ?? 0));
  // Buttons first: once they matter the frame lets the victim act, which may end the analysis.
  const ordered = [...classes.filter(({ changes }) => changes === "buttons"), ...classes.filter(({ changes }) => changes !== "buttons")];
  const branch = createReplaySnapshot();
  const scratchOutcome: number[] = [];
  const result: FrameAgency[] = [];
  const neutral = emptyInput();
  const search = new LoopSearch(victim, result);
  let loop = search.add(at(run.states, 0));
  let free = 0;
  for (let index = 0; index < frames; index++) {
    run.reach(index + 1);
    // A computer victim's choice isn't a row; its classes change a neutral one.
    const playedRow = run.played[index];
    const mattering: InputClass[] = [];
    for (const inputClass of ordered) {
      if (situation.untilFree !== undefined && mattering.some(({ changes }) => changes === "buttons")) break;
      const changed = inputClass.row(playedRow ?? neutral);
      if ((playedRow === undefined || !sameInput(changed, playedRow)) && classMatters(run, index, changed, branch, scratchOutcome)) mattering.push(inputClass);
    }
    // Buttons act; a button with the stick acts when the stick alone changes nothing (an up special out of a freeze).
    const acts = mattering.some((inputClass) => inputClass.changes === "buttons"
      || (inputClass.changes === "both" && !mattering.includes(stickPart.get(inputClass) ?? inputClass)));
    const agency: Agency = mattering.length === 0 ? "none" : acts ? "act" : "di";
    result.push({ frame: start.runtime.simulationFrame + index + 1, agency, classes: mattering.map(({ name }) => name) });
    free = agency === "act" ? free + 1 : 0;
    loop ??= search.add(at(run.states, index + 1));
    if (situation.untilFree !== undefined && (free >= situation.untilFree || loop !== undefined)) break;
  }
  return { frames: result, stretches: stretchesOf(result), loop, states: run.states };
}

function stretchesOf(frames: readonly FrameAgency[]): Stretch[] {
  const stretches: Stretch[] = [];
  let from: number | undefined;
  let di = 0;
  frames.forEach(({ frame, agency }, index) => {
    if (agency !== "act") {
      from ??= frame;
      if (agency === "di") di++;
    }
    const ends = agency === "act" || index === frames.length - 1;
    if (ends && from !== undefined) {
      const to = agency === "act" ? frame - 1 : frame;
      stretches.push({ from, to, length: to - from + 1, diFrames: di });
      from = undefined;
      di = 0;
    }
  });
  return stretches;
}

/** The frames on which the victim could act: its escapes, 0 for none. */
export const escapeFrames = (frames: readonly FrameAgency[]): number => frames.filter(({ agency }) => agency === "act").length;


/**
 * Looks for a played state equivalent to an earlier one, counting the frames
 * between on which the victim could act: a cycle with none is a loop it can't
 * get out of. Once the victim has had a reaction's worth of frames in a row
 * to act, earlier states no longer count.
 */
class LoopSearch {
  private readonly seen = new Map<string, number>();
  private readonly states: ReplayState[] = [];
  private free = 0;
  private over = false;

  constructor(private readonly victim: number, private readonly frames: readonly FrameAgency[]) {}

  /** The next played state, after the frame frames[states so far - 1]; the loop it closes, if any. */
  add(state: ReplayState): Loop | undefined {
    const index = this.states.length;
    this.states.push(state);
    if (index > 0) {
      this.free = at(this.frames, index - 1).agency === "act" ? this.free + 1 : 0;
      if (this.free > ESCAPE_FRAMES) this.seen.clear();
    }
    if (fighterAt(state.world, this.victim).status.out) this.over = true;
    // Only a situation the victim is under control in can close a loop that holds it: one it is free in is idling.
    if (this.over || !underControl(fighterAt(state.world, this.victim))) return undefined;
    const key = situationKey(state, this.victim);
    const earlier = this.seen.get(key);
    if (earlier === undefined) {
      this.seen.set(key, index);
      return undefined;
    }
    const before = at(this.states, earlier);
    const cycle = this.frames.slice(earlier, index);
    // A cycle the victim was free on throughout is idling, not a loop that holds it.
    if (cycle.every(({ agency }) => agency === "act")) {
      this.seen.set(key, index);
      return undefined;
    }
    return {
      from: before.runtime.simulationFrame, to: state.runtime.simulationFrame,
      fromPercent: fighterAt(before.world, this.victim).status.damage, toPercent: fighterAt(state.world, this.victim).status.damage,
      diFrames: cycle.filter(({ agency }) => agency === "di").length,
      escapeFrames: escapeFrames(cycle),
    };
  }
}

/** A frame's agency as one letter: . none, d DI only, A act. */
export const agencyLetters = (frames: readonly FrameAgency[]) => frames.map(({ agency }) => (agency === "none" ? "." : agency === "di" ? "d" : "A")).join("");

/** Whether the victim is under the other fighters' control: hit, held, knocked down or stunned. */
export function underControl(f: Readonly<Fighter>): boolean {
  const { state } = f.down;
  return f.launch.hitlag > 0 || f.launch.hitstun > 0 || f.grab.owner !== undefined || f.grab.grabbedFrames > 0 || f.shield.stun > 0
    || f.shield.breakState !== ShieldBreak.none || f.status.frozenFrames > 0
    || state === DownState.bound || state === DownState.wait || state === DownState.damage || state === DownState.stand;
}
