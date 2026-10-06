// The Melee behaviour oracle (#53): scripted situations for every fighter,
// played through the frame executor from controller rows, compared with
// values cited from the NTSC 1.02 decompilation and the retail reference
// corpus. `bun wisp oracle` prints the table; meleeOracle.tests.ts keeps CI
// to the known mismatches below.
//
// Citations: melee: is ~/code/resources/melee at 0296f009f32f710495979d30772d8332af2d411a.
// Fighter data is recorded in smashcraft:docs/smash-melee-reference/physics-parameters.json
// and retail-action-lengths.json. Common values marked "PlCo" were read from the
// owner's GALE01 revision 2 PlCo.dat (SHA-1 c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41);
// the retail files stay private, only the cited numbers appear here.
import { Action, has } from "../src/game/input/actions";
import { type InputRow, emptyInput } from "../src/game/input/inputRow";
import { type ParticipantInputs, participantInputs } from "../src/game/input/participants";
import { type FrameControls, createFrameControls } from "../src/game/match/controls";
import { type MatchFrameInput, captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { type PacingAndPresentation, createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { type MatchState, Phase, createMatchState, setHumanMask } from "../src/game/match/rules";
import { AttackStyle, Character, ContactKind, DownState, LedgeState, SurfaceContact } from "../src/game/sim/codes";
import { isIntangible } from "../src/game/sim/conditions";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "../src/game/sim/contacts";
import { type Fighter, createFighter } from "../src/game/sim/fighter";
import { attackLandingLag } from "../src/game/sim/moves";
import { type Roster, createRoster, fighterAt } from "../src/game/sim/roster";
import { SOLID_DECK_TEST_STAGE, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../src/game/sim/tuning";

// ------------------------------------------------------------------ harness

interface Scene {
  readonly world: Roster;
  readonly game: MatchState;
  readonly controls: FrameControls;
  readonly runtime: PacingAndPresentation;
  readonly row: MatchFrameInput;
  readonly source: ParticipantInputs;
  readonly previous: number[];
}

interface Placement {
  readonly character: Character;
  readonly x: number;
  readonly facing: number;
}

/** A match on `stage` with the given fighters in slots 0.., every slot a human playing from controller rows. */
function scene(stage: number, placements: readonly Placement[]): Scene {
  const mask = (1 << placements.length) - 1;
  const world = createRoster(mask, placements.map(({ character, x, facing }) => createFighter(character, x, facing)));
  const game = createMatchState();
  setHumanMask(game, mask);
  game.phase = Phase.match;
  game.timeLimitMinutes = 0;
  game.stageChoice = stage;
  return {
    world, game, controls: createFrameControls(), runtime: createPacingAndPresentation(), row: createMatchFrameInput(),
    source: participantInputs(), previous: placements.map(() => 0),
  };
}

/** One fighter in slot 0 and an idle Rifleman across the stage, since a match with one fighter left is over. */
const solo = (stage: number, character: Character, x = 0.0, facing = 1): Scene =>
  scene(stage, [{ character, x, facing }, { character: Character.rifleman, x: x < 0 ? 450.0 : -450.0, facing: -1 }]);

const fighter = (s: Scene, slot = 0): Fighter => fighterAt(s.world, slot);

const maskOf = (actions: readonly Action[]): number => actions.reduce<number>((mask, action) => mask | (1 << action), 0);

const axis = (held: number, negative: Action, positive: Action): number => (has(held, positive) ? 127 : 0) - (has(held, negative) ? 127 : 0);

/** A controller row holding `actions`; presses and releases come from the slot's previous row, as a pad reports them. */
function padRow(target: InputRow, held: number, previous: number): void {
  const pressed = held & ~previous;
  Object.assign(target, emptyInput());
  target.held = held;
  target.pressed = pressed;
  target.released = previous & ~held;
  target.axisX = axis(held, Action.moveLeft, Action.moveRight);
  target.axisZ = axis(held, Action.moveDown, Action.moveUp);
  const sign = (value: number) => (value > 0 ? 1 : value < 0 ? -1 : 0);
  if (has(pressed, Action.leftTrigger) || has(pressed, Action.rightTrigger)) {
    target.dodgeX = sign(target.axisX);
    target.dodgeZ = sign(target.axisZ);
  }
  if (has(pressed, Action.special)) {
    target.specialX = sign(target.axisX);
    target.specialZ = sign(target.axisZ);
  }
  target.ledgeVertical = has(pressed, Action.moveUp) ? 1 : has(pressed, Action.moveDown) ? -1 : 0;
}

/** Runs one frame with each slot holding its listed actions. */
function frame(s: Scene, ...held: (readonly Action[])[]): void {
  s.source.forEach((row, slot) => {
    if (slot >= s.previous.length) return;
    const mask = maskOf(held[slot] ?? []);
    padRow(row, mask, s.previous[slot] ?? 0);
    s.previous[slot] = mask;
  });
  const next = s.runtime.simulationFrame + 1;
  if (!captureNetworkFrame(s.row, next, s.source, s.world, s.world.mask)) throw new Error(`frame ${next} not captured`);
  if (!executeMatchFrame(s.row, s.game, s.world, s.controls, s.runtime, next)) throw new Error(`frame ${next} not executed`);
}

/** Frames run until `done`, or undefined after `limit` frames; the frame that satisfied it counts. */
function framesUntil(s: Scene, done: () => boolean, limit: number, held: (frame: number) => readonly Action[] = () => []): number | undefined {
  for (let n = 1; n <= limit; n++) {
    frame(s, held(n));
    if (done()) return n;
  }
  return undefined;
}

function airborne(f: Fighter, x: number, z: number): void {
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.x = x;
  f.motion.z = z;
  f.motion.vx = 0.0;
  f.motion.vz = 0.0;
}

/** Tumbling in hitstun, so a shield press techs instead of air dodging. */
function tumbling(f: Fighter, x: number, z: number): void {
  airborne(f, x, z);
  f.down.state = DownState.tumble;
  f.launch.hitstun = 400;
}

const melee = (world: number): number => world / WORLD_UNITS_PER_MELEE_UNIT;

// ------------------------------------------------------------------ reference data

/** Melee fighter data borrowed by a Smashcraft fighter, from PlFx.dat / PlFc.dat via physics-parameters.json. */
interface ReferenceFighter {
  readonly jumpSquat: number;
  readonly jumpVelocity: number;
  readonly hopVelocity: number;
  readonly aerialJumpMultiplier: number;
  readonly gravity: number;
  readonly fastFallVelocity: number;
  readonly dashInitialVelocity: number;
  readonly runVelocity: number;
  readonly walkVelocity: number;
}

const FOX: ReferenceFighter = {
  jumpSquat: 3, jumpVelocity: 3.680000066757202, hopVelocity: 2.0999999046325684,
  aerialJumpMultiplier: 1.2000000476837158, gravity: 0.23000000417232513, fastFallVelocity: 3.4000000953674316,
  dashInitialVelocity: 1.899999976158142, runVelocity: 2.200000047683716, walkVelocity: 1.600000023841858,
};
const FALCO: ReferenceFighter = {
  jumpSquat: 5, jumpVelocity: 4.099999904632568, hopVelocity: 1.899999976158142,
  aerialJumpMultiplier: 0.9399999976158142, gravity: 0.17000000178813934, fastFallVelocity: 3.5,
  dashInitialVelocity: 1.899999976158142, runVelocity: 1.5, walkVelocity: 1.399999976158142,
};

/** Archer and Rifleman borrow Fox's and Falco's movement data; Illidan's is authored. */
function referenceFighter(character: Character): ReferenceFighter | undefined {
  return character === Character.archer ? FOX : character === Character.rifleman ? FALCO : undefined;
}

/** Ledge snap data, ftData x44 +0x10/+0x14/+0x18 (Melee units): Archer = Fox, Rifleman = Falco, Illidan = Captain Falcon. */
function ledgeSnap(character: Character): { readonly x: number; readonly y: number; readonly height: number } {
  return character === Character.demonHunter ? { x: 9.0, y: 17.0, height: 11.0 } : { x: 11.0, y: 13.0, height: 9.0 };
}
/** mpColl_LoadECB_JObj never makes the airborne collision box narrower than this half-width. */
const LEDGE_BODY_HALF_WIDTH = 2.0;

const f32 = Math.fround;

/** Apex of a ground jump: the takeoff frame moves by the launch velocity, later frames subtract gravity first. */
function groundJumpApex(velocity: number, gravity: number): number {
  let v = f32(velocity);
  let z = v;
  for (;;) {
    v = f32(v - f32(gravity));
    if (v <= 0) return z;
    z = f32(z + v);
  }
}

/** Apex of an aerial jump, which applies gravity on its first frame. */
function aerialJumpApex(velocity: number, gravity: number): number {
  let v = f32(velocity);
  let z = 0.0;
  for (;;) {
    v = f32(v - f32(gravity));
    if (v <= 0) return z;
    z = f32(z + v);
  }
}

/**
 * Ordinary knockback, melee:src/melee/ft/ftcoll.c with PlCo +0x0F4/+0x0F8
 * (weight 0.01, 2), +0x110/+0x114 (0.1, 0.05), +0x11C/+0x120 (1.4, 18) and
 * the +0x108 cap 2500. `percent` is after the hit, `power` the integer damage.
 */
function meleeKnockback(percent: number, power: number, weight: number, growth: number, base: number): number {
  const p = f32(percent);
  const contribution = f32(f32(0.10000000149011612 * p) + f32(f32(p * power) * 0.05000000074505806));
  const w = f32(weight * 0.009999999776482582);
  const weightFactor = f32(2.0 - f32(f32(w * 2.0) / f32(w + 1.0)));
  const scaled = f32(f32(1.399999976158142 * f32(contribution * weightFactor)) + 18.0);
  return Math.min(2500.0, f32(f32(f32(growth * 0.009999999776482582) * scaled) + base));
}

// ------------------------------------------------------------------ rows

type Outcome = "pass" | "mismatch" | "n/a";

interface OracleRow {
  readonly area: string;
  readonly scenario: string;
  readonly fighter: string;
  readonly expected: string;
  readonly actual: string;
  readonly outcome: Outcome;
  readonly cite: string;
}

interface Check {
  readonly expected: string | number | boolean;
  readonly actual: string | number | boolean;
  /** Numbers compare within this; strings and booleans compare exactly. */
  readonly tolerance?: number;
}

interface Scenario {
  readonly area: string;
  readonly name: string;
  readonly cite: string;
  /** The check for one fighter; undefined where the fighter has no Melee reference for this value. */
  readonly run: (character: Character) => Check | undefined;
}

const FIGHTERS = [
  { character: Character.archer, name: "Archer" },
  { character: Character.rifleman, name: "Rifleman" },
  { character: Character.demonHunter, name: "Illidan" },
] as const;

const show = (value: string | number | boolean): string =>
  typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "")) : String(value);

function rowFor(scenario: Scenario, character: Character, name: string): OracleRow {
  const base = { area: scenario.area, scenario: scenario.name, fighter: name, cite: scenario.cite };
  const check = scenario.run(character);
  if (check === undefined) return { ...base, expected: "-", actual: "-", outcome: "n/a" };
  const { expected, actual, tolerance = 0.0 } = check;
  const pass = typeof expected === "number" && typeof actual === "number" ? Math.abs(expected - actual) <= tolerance : expected === actual;
  return { ...base, expected: show(expected), actual: show(actual), outcome: pass ? "pass" : "mismatch" };
}

/** Character-data checks: Illidan has no Melee movement profile. */
function forReference(character: Character, check: (reference: ReferenceFighter) => Check): Check | undefined {
  const reference = referenceFighter(character);
  return reference === undefined ? undefined : check(reference);
}

// ------------------------------------------------------------------ jumps

/** Frames on the ground from the jump press, including it, before takeoff. */
function jumpSquatFrames(character: Character): number {
  const s = solo(0, character);
  const f = fighter(s);
  return (framesUntil(s, () => !f.motion.grounded, 30, () => [Action.jump]) ?? 99) - 1;
}

/** Highest rise in Melee units above the fighter's position, once it has left the ground and started down. */
function apex(s: Scene, held: (frame: number) => readonly Action[]): number {
  const f = fighter(s);
  const start = f.motion.z;
  let top = start;
  for (let n = 1; n <= 120; n++) {
    frame(s, held(n));
    if (!f.motion.grounded && f.motion.z < top) break;
    top = Math.max(top, f.motion.z);
  }
  return melee(top - start);
}

function doubleJumpApex(character: Character): number {
  const s = solo(0, character);
  const f = fighter(s);
  airborne(f, 0.0, 400.0);
  f.jump.remaining = 1;
  return apex(s, (n) => (n === 1 ? [Action.jump] : []));
}

const JUMP_DATA = "ftData attributes (physics-parameters.json, Fox/Falco)";

const JUMPS: readonly Scenario[] = [
  {
    area: "jump", name: "jump squat: grounded frames from the press",
    cite: `${JUMP_DATA} +0x038 jump_startup_time 3/5; melee:src/melee/ft/kinds/ftCommon/ftCo_KneeBend.c; slippi-ntsc-falco-jump.json`,
    run: (c) => forReference(c, (r) => ({ expected: r.jumpSquat, actual: jumpSquatFrames(c) })),
  },
  {
    area: "jump", name: "full hop apex (Melee units)",
    cite: `${JUMP_DATA} +0x040 jump_v 3.68/4.1, +0x05C gravity 0.23/0.17; takeoff frame moves by v, then v -= g: ftCo_Jump.c`,
    run: (c) => forReference(c, (r) => ({ expected: groundJumpApex(r.jumpVelocity, r.gravity), actual: apex(solo(0, c), () => [Action.jump]), tolerance: 0.01 })),
  },
  {
    area: "jump", name: "short hop apex (released in squat)",
    cite: `${JUMP_DATA} +0x04C hop_v 2.1/1.9; release during KneeBend selects it: ftCo_KneeBend.c`,
    run: (c) => forReference(c, (r) => ({ expected: groundJumpApex(r.hopVelocity, r.gravity), actual: apex(solo(0, c), (n) => (n === 1 ? [Action.jump] : [])), tolerance: 0.01 })),
  },
  {
    area: "jump", name: "double jump rise (Melee units)",
    cite: `${JUMP_DATA} +0x050 air_jump_v_multiplier 1.2/0.94 x +0x040; gravity from the first frame: ftCo_JumpAerial.c`,
    run: (c) => forReference(c, (r) => ({ expected: aerialJumpApex(f32(f32(r.jumpVelocity) * f32(r.aerialJumpMultiplier)), r.gravity), actual: doubleJumpApex(c), tolerance: 0.01 })),
  },
];

// ------------------------------------------------------------------ ground speeds

function dashVelocity(character: Character): number {
  const s = solo(0, character);
  frame(s, [Action.moveRight]);
  return melee(fighter(s).motion.vx);
}

/** Running from the left edge, then sliding 0.4 Melee units/frame over the run maximum. */
function runSettles(character: Character, maximum: number): number {
  const s = solo(0, character, -560.0);
  const f = fighter(s);
  for (let n = 1; n <= 20; n++) frame(s, [Action.moveRight]);
  f.motion.vx = (maximum + 0.4) * WORLD_UNITS_PER_MELEE_UNIT;
  for (let n = 1; n <= 20; n++) frame(s, [Action.moveRight]);
  return melee(f.motion.vx);
}

/** Walking while sliding 0.4 Melee units/frame over the walk maximum. */
function walkSettles(character: Character, maximum: number): number {
  const s = solo(0, character, -560.0);
  const f = fighter(s);
  f.motion.vx = (maximum + 0.4) * WORLD_UNITS_PER_MELEE_UNIT;
  for (let n = 1; n <= 20; n++) frame(s, [Action.moveRight, Action.walk]);
  return melee(f.motion.vx);
}

const SETTLES = "over the target, ftCommon_CalcGroundAccel_DashRun applies friction down to it (melee:src/melee/ft/ftcommon.c); acceleration below it is Smashcraft's authored tuning";

const GROUND: readonly Scenario[] = [
  {
    area: "ground", name: "initial dash velocity after the first frame",
    cite: `${JUMP_DATA} +0x01C dash_initial_velocity 1.9; melee:src/melee/ft/kinds/ftCommon/ftCo_Dash.c; retail-ground-movement-events.json`,
    run: (c) => forReference(c, (r) => ({ expected: r.dashInitialVelocity, actual: dashVelocity(c), tolerance: 0.00001 })),
  },
  {
    area: "ground", name: "running: velocity settles at the run maximum",
    cite: `${JUMP_DATA} +0x028 dash_max_velocity (run) 2.2/1.5, the target of melee:src/melee/ft/kinds/ftCommon/ftCo_Run.c; ${SETTLES}`,
    run: (c) => forReference(c, (r) => ({ expected: r.runVelocity, actual: runSettles(c, r.runVelocity), tolerance: 0.00001 })),
  },
  {
    area: "ground", name: "walking: velocity settles at the walk maximum",
    cite: `${JUMP_DATA} +0x008 walk_max_vel 1.6/1.4, the target of melee:src/melee/ft/ftwalkcommon.c ftWalkCommon_800E0060; ${SETTLES}`,
    run: (c) => forReference(c, (r) => ({ expected: r.walkVelocity, actual: walkSettles(c, r.walkVelocity), tolerance: 0.00001 })),
  },
];

// ------------------------------------------------------------------ fast fall

function fastFallVelocity(character: Character): number {
  const s = solo(0, character);
  const f = fighter(s);
  airborne(f, 0.0, 400.0);
  frame(s, []);
  frame(s, [Action.moveDown]);
  return -melee(f.motion.vz);
}

/** Holds a full hop and presses down `early` frames before the first frame that starts descending. */
function fastFallsWhenPressedEarly(character: Character, early: number): boolean {
  const base = solo(0, character);
  const probe = fighter(base);
  let descending: number | undefined;
  for (let n = 1; n <= 120 && descending === undefined; n++) {
    if (!probe.motion.grounded && probe.motion.vz < 0) descending = n;
    frame(base, [Action.jump]);
  }
  if (descending === undefined) throw new Error("no descent");
  const s = solo(0, character);
  const f = fighter(s);
  for (let n = 1; n <= descending + 3; n++) frame(s, n >= descending - early ? [Action.jump, Action.moveDown] : [Action.jump]);
  return f.motion.fastFalling;
}

const FAST_FALL: readonly Scenario[] = [
  {
    area: "fast-fall", name: "fast-fall velocity",
    cite: `${JUMP_DATA} +0x074 fast_fall_velocity 3.4/3.5; melee:src/melee/ft/ftcommon.c ftCommon_CheckFallFast`,
    run: (c) => forReference(c, (r) => ({ expected: r.fastFallVelocity, actual: fastFallVelocity(c), tolerance: 0.00001 })),
  },
  {
    area: "fast-fall", name: "down held from 3 frames before descent",
    cite: "PlCo +0x08C = 4: stick-down age < 4 and self_vel.y < 0; melee:src/melee/ft/ftcommon.c:513 ftCommon_CheckFallFast",
    run: (c) => ({ expected: true, actual: fastFallsWhenPressedEarly(c, 3) }),
  },
  {
    area: "fast-fall", name: "down held from 4 frames before descent",
    cite: "PlCo +0x08C = 4: stick-down age < 4 and self_vel.y < 0; melee:src/melee/ft/ftcommon.c:513 ftCommon_CheckFallFast",
    run: (c) => ({ expected: false, actual: fastFallsWhenPressedEarly(c, 4) }),
  },
];

// ------------------------------------------------------------------ landing and L-cancel

/** The least wait in 1..40 that `accepted` holds for, given it holds for every later wait too; 99 for none. */
function firstAccepted(accepted: (wait: number) => boolean): number {
  let low = 1;
  let high = 41;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (accepted(middle)) high = middle;
    else low = middle + 1;
  }
  return low > 40 ? 99 : low;
}

interface Landing {
  /** First grounded frame. */
  readonly landing: number | undefined;
  /** Whether the jump pressed on `jumpAt` started. */
  readonly jumped: boolean;
  readonly cancelled: boolean;
}

interface Fall {
  /** Places the fighter before frame 1. */
  readonly setup: (f: Fighter) => void;
  readonly held: (frame: number) => readonly Action[];
  /** Frozen frames of the fighter's own hitlag, starting on `freezeAt`. */
  readonly freezeAt?: number;
  readonly frozen?: number;
}

/** Plays a fall until it lands and, when asked, until a jump pressed on `jumpAt` was or wasn't accepted. */
function playFall(character: Character, { setup, held, freezeAt, frozen = 0 }: Fall, jumpAt?: number): Landing {
  const s = solo(0, character);
  const f = fighter(s);
  setup(f);
  let landing: number | undefined;
  let jumped = false;
  for (let n = 1; n <= 120; n++) {
    if (n === freezeAt) f.launch.hitlag = frozen + 1;
    frame(s, n === jumpAt ? [...held(n), Action.jump] : held(n));
    if (landing === undefined && f.motion.grounded) landing = n;
    if (n === jumpAt) jumped = f.jump.squat > 0;
    if (landing !== undefined && n >= (jumpAt ?? landing)) break;
  }
  return { landing, jumped, cancelled: f.landing.lCancelSerial > 0 };
}

function landingFrame(character: Character, fall: Fall): number {
  const { landing } = playFall(character, fall);
  if (landing === undefined) throw new Error("the fall never landed");
  return landing;
}

/** Frames after the landing frame until a jump is accepted. */
function landingLag(character: Character, fall: Fall): number {
  const landing = landingFrame(character, fall);
  return firstAccepted((wait) => playFall(character, fall, landing + wait).jumped);
}

const emptyFall: Fall = { setup: (f) => airborne(f, 0.0, 120.0), held: () => [] };

/** A neutral aerial started on frame 1 from 200 units up, with L pressed on `lAt`. */
function aerialFall(lAt?: number, freezeAt?: number, frozen?: number): Fall {
  const held = (n: number): readonly Action[] => [...(n === 1 ? [Action.attack] : []), ...(n === lAt ? [Action.leftTrigger] : [])];
  return { setup: (f) => airborne(f, 0.0, 200.0), held, ...(freezeAt === undefined ? {} : { freezeAt }), ...(frozen === undefined ? {} : { frozen }) };
}

function aerialLandingLag(character: Character, lEarly: number | undefined): number {
  return landingLag(character, aerialFall(lEarly === undefined ? undefined : landingFrame(character, aerialFall()) - lEarly));
}

function lCancels(character: Character, early: number): boolean {
  return playFall(character, aerialFall(landingFrame(character, aerialFall()) - early)).cancelled;
}

/** L pressed `early` frames before landing, counted on the clock, with `frozen` frames of own hitlag in between. */
function lCancelsAcrossHitlag(character: Character, early: number, frozen: number): boolean {
  const freezeAt = landingFrame(character, aerialFall()) - frozen;
  const landing = landingFrame(character, aerialFall(undefined, freezeAt, frozen));
  return playFall(character, aerialFall(landing - early, freezeAt, frozen)).cancelled;
}

const L_CANCEL = "PlCo +0x0E4 = 7: L/R press age (x67F, fighter.c Fighter_procInput) < 7 at landing; PlCo +0x0E8 = 2: lag = max(1, (int)(lag / 2)); melee:src/melee/ft/kinds/ftCommon/ftCo_LandingAir.c";
const NAIR_LAG = attackLandingLag(AttackStyle.neutralAir);

const LANDING: readonly Scenario[] = [
  {
    area: "landing", name: "empty landing lag (frames to act)",
    cite: `${JUMP_DATA} +0x0E4 normal_landing_lag 4; melee:src/melee/ft/kinds/ftCommon/ftCo_Landing.c`,
    run: (c) => forReference(c, () => ({ expected: 4, actual: landingLag(c, emptyFall) })),
  },
  {
    area: "landing", name: `neutral aerial landing lag, no L (authored ${NAIR_LAG})`,
    cite: "LandingAir lasts the lag (anim rate (frames + 0.1) / lag): melee:src/melee/ft/kinds/ftCommon/ftCo_LandingAir.c",
    run: (c) => ({ expected: NAIR_LAG, actual: aerialLandingLag(c, undefined) }),
  },
  {
    area: "landing", name: "neutral aerial landing lag, L on the landing frame",
    cite: L_CANCEL,
    run: (c) => ({ expected: Math.max(1, Math.trunc(NAIR_LAG / 2)), actual: aerialLandingLag(c, 0) }),
  },
  { area: "landing", name: "L 6 frames before landing cancels", cite: L_CANCEL, run: (c) => ({ expected: true, actual: lCancels(c, 6) }) },
  { area: "landing", name: "L 7 frames before landing cancels", cite: L_CANCEL, run: (c) => ({ expected: false, actual: lCancels(c, 7) }) },
  {
    area: "landing", name: "L 7 frames before landing, 3 of them in own hitlag, cancels",
    cite: `${L_CANCEL}; input ages count hitlag frames (Fighter_procInput has no hitlag gate; melee-tech-input.md)`,
    run: (c) => ({ expected: false, actual: lCancelsAcrossHitlag(c, 7, 3) }),
  },
];

// ------------------------------------------------------------------ floor techs

function downName(f: Fighter): string {
  switch (f.down.state) {
    case DownState.tech: return "tech";
    case DownState.techRoll: return "tech roll";
    case DownState.bound: return "knockdown";
    case DownState.none: return f.motion.grounded ? "standing" : "airborne";
    default: return `down state ${f.down.state}`;
  }
}

/** A tumbler falling from `z`; returns the landing frame and what it became, pressing tech on `presses`. */
function tumbleLanding(character: Character, z: number, presses: readonly number[], stick: readonly Action[] = []): { landing: number; result: string } {
  const s = solo(0, character);
  const f = fighter(s);
  tumbling(f, 0.0, z);
  for (let n = 1; n <= 200; n++) {
    frame(s, presses.includes(n) ? [Action.leftTrigger, ...stick] : stick);
    if (f.motion.grounded) return { landing: n, result: downName(f) };
  }
  throw new Error("the tumble never landed");
}

function techBeforeLanding(character: Character, early: number | undefined, stick: readonly Action[] = []): string {
  const { landing } = tumbleLanding(character, 600.0, []);
  return tumbleLanding(character, 600.0, early === undefined ? [] : [landing - early], stick).result;
}

/** Two presses `gap` frames apart, the second on the frame before landing. */
function techAfterRepeat(character: Character, gap: number): string {
  const { landing } = tumbleLanding(character, 740.0, []);
  return tumbleLanding(character, 740.0, [landing - 1 - gap, landing - 1]).result;
}

const TECH_GATE = "PlCo +0x250 = 20: L/R press age (x680) < 20 and previous press interval (x684) >= PlCo +0x01C = 40; melee:src/melee/ft/kinds/ftCommon/ftCo_DownAttack.c:90 (gate 0x800986B0, retail-tech-input-driver.json)";

const TECHS: readonly Scenario[] = [
  { area: "tech", name: "no tech press", cite: "missed tech enters DownBound: melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c", run: (c) => ({ expected: "knockdown", actual: techBeforeLanding(c, undefined) }) },
  { area: "tech", name: "tech 19 frames before landing", cite: TECH_GATE, run: (c) => ({ expected: "tech", actual: techBeforeLanding(c, 19) }) },
  { area: "tech", name: "tech 20 frames before landing", cite: TECH_GATE, run: (c) => ({ expected: "knockdown", actual: techBeforeLanding(c, 20) }) },
  {
    area: "tech", name: "tech with the stick held sideways",
    cite: "PlCo +0x254 = 0.2 stick x picks PassiveStandF/B: melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveStand.c:26",
    run: (c) => ({ expected: "tech roll", actual: techBeforeLanding(c, 5, [Action.moveRight]) }),
  },
  { area: "tech", name: "second press 40 frames after the first", cite: TECH_GATE, run: (c) => ({ expected: "knockdown", actual: techAfterRepeat(c, 40) }) },
  { area: "tech", name: "second press 41 frames after the first", cite: TECH_GATE, run: (c) => ({ expected: "tech", actual: techAfterRepeat(c, 41) }) },
];

// ------------------------------------------------------------------ getting up

interface Knockdown {
  /** Frames spent in each down state, in order of entry. */
  readonly states: { readonly state: DownState; frames: number }[];
}

/** A tumble landing on the main deck, then `frames` frames of `held(frame after landing)`. */
function knockdown(character: Character, frames: number, held: (afterLanding: number) => readonly Action[]): Knockdown {
  const s = solo(0, character);
  const f = fighter(s);
  tumbling(f, 0.0, 30.0);
  const states: { state: DownState; frames: number }[] = [];
  let landed: number | undefined;
  for (let n = 1; n <= frames; n++) {
    frame(s, landed === undefined ? held(0) : held(n - landed));
    if (landed === undefined && f.motion.grounded) landed = n;
    if (landed === undefined) continue;
    const last = states[states.length - 1];
    if (last !== undefined && last.state === f.down.state) last.frames++;
    else states.push({ state: f.down.state, frames: 1 });
  }
  return { states };
}

const stateAfter = (k: Knockdown, state: DownState): DownState | undefined => k.states[k.states.findIndex((entry) => entry.state === state) + 1]?.state;
const framesIn = (k: Knockdown, state: DownState): number => k.states.find((entry) => entry.state === state)?.frames ?? 0;

const DOWN_NAMES: Record<number, string> = {
  [DownState.none]: "none", [DownState.bound]: "bound", [DownState.wait]: "wait", [DownState.stand]: "stand",
  [DownState.roll]: "roll", [DownState.attack]: "get-up attack", [DownState.damage]: "jab reset",
};
const downStateName = (state: DownState | undefined): string => (state === undefined ? "-" : DOWN_NAMES[state] ?? `state ${state}`);

/** Frames in a get-up option chosen from the down wait by `choose`. */
function getupFrames(character: Character, option: DownState, choose: readonly Action[]): number {
  return framesIn(knockdown(character, 120, (after) => (after === 40 ? choose : [])), option);
}

const GETUP_ORDER = "DownBound ends into get-up attack (A/B pressed within PlCo +0x24C = 60 frames), then held stick roll (|x| >= PlCo +0x248 0.2), else DownWait: melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c ftCo_DownBound_Anim, ftCo_Down.c";
const DOWN_ANIMATIONS = "Fox/Falco animation frames (retail-action-lengths.json)";

const GETUPS: readonly Scenario[] = [
  {
    area: "getup", name: "frames in down-bound before a held roll",
    cite: `${DOWN_ANIMATIONS} DownBoundU 26, entered without an extra animation step: ftCo_DownBound.c ftCo_8009794C`,
    run: (c) => forReference(c, () => ({ expected: 26, actual: framesIn(knockdown(c, 80, () => [Action.moveRight]), DownState.bound) })),
  },
  {
    area: "getup", name: "stick held sideways through the bound: rolls at its end",
    cite: GETUP_ORDER,
    run: (c) => ({ expected: "roll", actual: downStateName(stateAfter(knockdown(c, 80, () => [Action.moveRight]), DownState.bound)) }),
  },
  {
    area: "getup", name: "attack pressed during the bound: get-up attack at its end",
    cite: GETUP_ORDER,
    run: (c) => ({ expected: "get-up attack", actual: downStateName(stateAfter(knockdown(c, 80, (after) => (after === 5 ? [Action.attack] : [])), DownState.bound)) }),
  },
  {
    area: "getup", name: "no input: frames in down-wait before standing",
    cite: "PlCo +0x424 = 220: ftCo_DownWait_Anim counts mv.co.downwait.x0 down and stands at 0; melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c:301",
    run: (c) => ({ expected: 220, actual: framesIn(knockdown(c, 270, () => []), DownState.wait) }),
  },
  {
    area: "getup", name: "get-up stand frames",
    cite: `${DOWN_ANIMATIONS} DownStandU 30, entered without an extra step: ftCo_DownStand.c ftCo_80098160`,
    run: (c) => forReference(c, () => ({ expected: 30, actual: getupFrames(c, DownState.stand, [Action.moveUp]) })),
  },
  {
    area: "getup", name: "get-up roll frames",
    cite: `${DOWN_ANIMATIONS} DownFowardU 36, entered with ftAnim_8006EBA4: ftCo_Down.c ftCo_80098324`,
    run: (c) => forReference(c, () => ({ expected: 35, actual: getupFrames(c, DownState.roll, [Action.moveRight]) })),
  },
  {
    area: "getup", name: "get-up attack frames",
    cite: `${DOWN_ANIMATIONS} DownAttackU 50, entered with ftAnim_8006EBA4: ftCo_DownAttack.c:47`,
    run: (c) => forReference(c, () => ({ expected: 49, actual: getupFrames(c, DownState.attack, [Action.attack]) })),
  },
];

// ------------------------------------------------------------------ knockback and tumble

const TEST_HIT = { damage: 10.0, growth: 100.0, base: 21.0, launchX: 0.7071067690849304, launchZ: 0.7071067690849304, electric: false };

/** The test hit on a standing fighter at `percent`, resolved by the production contact batch. */
function launchOutcome(character: Character, percent: number): string {
  const s = scene(0, [{ character, x: 0.0, facing: 1 }, { character: Character.rifleman, x: -60.0, facing: 1 }]);
  const target = fighter(s, 0);
  target.status.damage = percent;
  beginDamageContacts();
  collectDamageContact(s.world, 1, 0, TEST_HIT, 1, ContactKind.launch, false, undefined, false);
  finishDamageContacts(s.world);
  return `${percent}%: ${target.down.state === DownState.tumble ? "tumble" : "no tumble"}, ${target.launch.hitstun} hitstun`;
}

function expectedLaunch(weight: number, percent: number): { tumble: boolean; text: string } {
  const knockback = meleeKnockback(Math.trunc(percent) + TEST_HIT.damage, TEST_HIT.damage, weight, TEST_HIT.growth, TEST_HIT.base);
  const scaled = f32(f32(knockback) * 0.4000000059604645);
  const tumble = scaled >= 32.0;
  return { tumble, text: `${percent}%: ${tumble ? "tumble" : "no tumble"}, ${Math.max(1, Math.trunc(scaled))} hitstun` };
}

/** The lowest whole percent at which the test hit tumbles this fighter. */
function tumblePercent(character: Character): number {
  const weight = createFighter(character, 0.0, 1).tuning.physics.weight;
  for (let percent = 0; percent <= 300; percent++) if (expectedLaunch(weight, percent).tumble) return percent;
  throw new Error("no tumble threshold");
}

function launchCheck(character: Character, offset: number): Check {
  const weight = createFighter(character, 0.0, 1).tuning.physics.weight;
  const percent = tumblePercent(character) + offset;
  return { expected: expectedLaunch(weight, percent).text, actual: launchOutcome(character, percent) };
}

const KNOCKBACK_RULE = "knockback: melee:src/melee/ft/ftcoll.c with PlCo +0x0F4..+0x120 (fighter's own weight); hitstun (int)(K x +0x154 0.4), tumble when K x 0.4 >= +0x160 32: melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c:285";

const KNOCKBACK: readonly Scenario[] = [
  { area: "knockback", name: "10-damage hit (growth 100, base 21) 1% below the tumble threshold", cite: KNOCKBACK_RULE, run: (c) => launchCheck(c, -1) },
  { area: "knockback", name: "10-damage hit (growth 100, base 21) at the tumble threshold", cite: KNOCKBACK_RULE, run: (c) => launchCheck(c, 0) },
];

// ------------------------------------------------------------------ pass-through platforms

function standing(f: Fighter): string {
  if (!f.motion.grounded) return "airborne";
  return f.motion.surface === 1 ? "raised deck" : f.motion.surface === 0 ? "main deck" : `surface ${String(f.motion.surface)}`;
}

/** Stage 1's left raised deck spans x -420..-110 at z 170. */
const UNDER_DECK_X = -265.0;

function fullHopUnderDeck(character: Character): string {
  const s = solo(1, character, UNDER_DECK_X);
  for (let n = 1; n <= 150; n++) frame(s, [Action.jump]);
  return standing(fighter(s));
}

function downOnDeck(character: Character): string {
  const s = solo(1, character, UNDER_DECK_X);
  const f = fighter(s);
  f.motion.z = surfaceZ(1, 1);
  f.motion.surface = 1;
  for (let n = 1; n <= 90; n++) frame(s, [Action.moveDown]);
  return standing(f);
}

/** Falls onto the deck holding down from high above it; the stick is long past a fresh press on landing. */
function landHoldingDown(character: Character, after: number): string {
  const s = solo(1, character, UNDER_DECK_X);
  const f = fighter(s);
  airborne(f, UNDER_DECK_X, 330.0);
  const landed = framesUntil(s, () => f.motion.grounded || f.motion.z < 100.0, 120, () => [Action.moveDown]);
  if (landed === undefined) return "airborne";
  for (let n = 1; n <= after; n++) frame(s, [Action.moveDown]);
  return standing(f);
}

const PLATFORM_LINES = "platforms are floor lines flagged LINE_FLAG_PLATFORM: mpCheckFloor hits them only while descending, mpCheckCeiling ignores them (melee:src/melee/mp/mplib.c, forward.h)";
const PLATFORM_PASS = "Pass needs stick y <= -PlCo +0x464 (0.66) reached under PlCo +0x468 = 6 frames ago on a platform: melee:src/melee/ft/kinds/ftCommon/ftCo_Pass.c:26 ftCo_80099F1C; mpColl skips that platform";

const PLATFORMS: readonly Scenario[] = [
  { area: "platform", name: "full hop from under a raised deck", cite: PLATFORM_LINES, run: (c) => ({ expected: "raised deck", actual: fullHopUnderDeck(c) }) },
  { area: "platform", name: "down pressed on a raised deck", cite: PLATFORM_PASS, run: (c) => ({ expected: "main deck", actual: downOnDeck(c) }) },
  { area: "platform", name: "falling onto a raised deck holding down: landing", cite: `${PLATFORM_LINES}; airborne collision has no stick test (melee:src/melee/ft/ft_081B.c)`, run: (c) => ({ expected: "raised deck", actual: landHoldingDown(c, 0) }) },
  { area: "platform", name: "still holding down 30 frames after that landing", cite: PLATFORM_PASS, run: (c) => ({ expected: "raised deck", actual: landHoldingDown(c, 30) }) },
];

// ------------------------------------------------------------------ wall and ceiling techs

interface SurfaceRun {
  readonly contact: number | undefined;
  readonly result: string;
}

/**
 * A tumbler presses tech on frame 2, is then held `frozen` frames in hitlag
 * and flies into the solid test deck's left wall, or up into the main deck's
 * underside. Tech ages count hitlag frames in both games.
 */
function surfaceRun(character: Character, wall: boolean, press: boolean, frozen: number): SurfaceRun {
  const stage = wall ? SOLID_DECK_TEST_STAGE : 0;
  const s = solo(stage, character, wall ? -480.0 : 0.0);
  const f = fighter(s);
  tumbling(f, wall ? -480.0 : 0.0, wall ? 400.0 : -100.0);
  for (let n = 1; n <= 60; n++) {
    if (n === 3) {
      tumbling(f, wall ? -450.0 : 0.0, wall ? 160.0 : -84.0);
      f.launch.knockbackX = wall ? 18.0 : 0.0;
      f.launch.knockbackZ = wall ? 0.0 : 18.0;
      f.launch.hitlag = frozen > 0 ? frozen + 1 : 0;
    }
    frame(s, press && n === 2 ? [Action.leftTrigger] : []);
    const state = f.surfaceRecovery.state;
    if (f.surfaceRecovery.contactSerial > 0 || state !== SurfaceContact.none) {
      return { contact: n, result: state === SurfaceContact.techWall || state === SurfaceContact.techCeiling ? "tech" : "no tech" };
    }
  }
  return { contact: undefined, result: "no contact" };
}

/** Tech pressed `early` frames before the contact. */
function surfaceTech(character: Character, wall: boolean, early: number): string {
  const contact = surfaceRun(character, wall, false, 0).contact;
  if (contact === undefined) return "no contact";
  const frozen = early + 2 - contact;
  if (frozen < 0) return "setup too slow";
  return surfaceRun(character, wall, true, frozen).result;
}

const SURFACE_GATE = "wall and ceiling techs use the floor's gate 0x800986B0 (PlCo +0x250 = 20, +0x01C = 40): melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c ftCo_800C1D38, ftCo_PassiveCeil.c";

const SURFACES: readonly Scenario[] = [
  { area: "wall/ceiling", name: "wall tech 19 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "tech", actual: surfaceTech(c, true, 19) }) },
  { area: "wall/ceiling", name: "wall tech 20 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "no tech", actual: surfaceTech(c, true, 20) }) },
  { area: "wall/ceiling", name: "ceiling tech 19 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "tech", actual: surfaceTech(c, false, 19) }) },
  { area: "wall/ceiling", name: "ceiling tech 20 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "no tech", actual: surfaceTech(c, false, 20) }) },
];

// ------------------------------------------------------------------ shield and dodges

/** Frames after the shield's release frame until an attack starts on its press frame. */
function shieldReleaseLag(character: Character): number {
  const released = 21;
  const run = (attackAt: number): boolean => {
    const s = solo(0, character);
    const f = fighter(s);
    for (let n = 1; n <= attackAt; n++) frame(s, n < released ? [Action.rightTrigger] : n === attackAt ? [Action.attack] : []);
    return f.attack.serial > 0;
  };
  return firstAccepted((wait) => run(released + wait));
}

/** Frame ranges, as "a-b, c-d", of the frames that satisfy `flags`. */
function ranges(flags: readonly boolean[]): string {
  const parts: string[] = [];
  let start: number | undefined;
  flags.forEach((flag, index) => {
    if (flag && start === undefined) start = index + 1;
    if (!flag && start !== undefined) { parts.push(`${start}-${index}`); start = undefined; }
  });
  if (start !== undefined) parts.push(`${start}-${flags.length}`);
  return parts.length === 0 ? "none" : parts.join(", ");
}

/** A spot dodge (down) or forward roll (right) out of shield: its frames and its intangible frames. */
function groundDodge(character: Character, direction: Action): { frames: number; intangible: string } {
  const s = solo(0, character);
  const f = fighter(s);
  for (let n = 1; n <= 5; n++) frame(s, [Action.rightTrigger]);
  const intangible: boolean[] = [];
  frame(s, [Action.rightTrigger, direction]);
  while (f.dodge.groundFrame > 0 && intangible.length < 60) {
    intangible.push(isIntangible(f));
    frame(s, [Action.rightTrigger]);
  }
  return { frames: intangible.length, intangible: ranges(intangible) };
}

function airDodgeIntangible(character: Character): string {
  const s = solo(0, character);
  const f = fighter(s);
  airborne(f, 0.0, 600.0);
  const intangible: boolean[] = [];
  for (let n = 1; n <= 45; n++) {
    frame(s, n === 1 ? [Action.leftTrigger] : []);
    intangible.push(isIntangible(f));
  }
  return ranges(intangible);
}

function airDodgeFirstTravel(character: Character): number {
  const s = solo(0, character);
  const f = fighter(s);
  airborne(f, 0.0, 300.0);
  frame(s, [Action.moveUp, Action.leftTrigger]);
  return melee(f.motion.deltaZ);
}

/** A straight-down air dodge just above the main deck. */
const wavelandFall: Fall = { setup: (f) => airborne(f, 0.0, 6.0), held: (n) => (n === 1 ? [Action.moveDown, Action.leftTrigger] : []) };

const DODGE_DATA = "Fox/Falco animation frames (retail-action-lengths.json, private PlFxAJ/PlFcAJ read)";
const DODGE_INTANGIBLE = "Fox/Falco intangibility, melee-frame-data.json (meleeframedata.com extractor data)";

const SHIELD_AND_DODGES: readonly Scenario[] = [
  {
    area: "shield/dodge", name: "shield release: frames until an attack starts",
    cite: `${DODGE_DATA} GuardOff 15, entered without an extra step: melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c:587 ftCo_80092C54`,
    run: (c) => forReference(c, () => ({ expected: 15, actual: shieldReleaseLag(c) })),
  },
  {
    area: "shield/dodge", name: "spot dodge frames",
    cite: `${DODGE_DATA} EscapeN 23, entered with ftAnim_8006EBA4: ftCo_Escape.c:245`,
    run: (c) => forReference(c, () => ({ expected: 22, actual: groundDodge(c, Action.moveDown).frames })),
  },
  { area: "shield/dodge", name: "spot dodge intangible frames", cite: DODGE_INTANGIBLE, run: (c) => forReference(c, () => ({ expected: "2-15", actual: groundDodge(c, Action.moveDown).intangible })) },
  {
    area: "shield/dodge", name: "forward roll frames",
    cite: `${DODGE_DATA} EscapeF 32, entered with ftAnim_8006EBA4: ftCo_Escape.c:100`,
    run: (c) => forReference(c, () => ({ expected: 31, actual: groundDodge(c, Action.moveRight).frames })),
  },
  { area: "shield/dodge", name: "forward roll intangible frames", cite: DODGE_INTANGIBLE, run: (c) => forReference(c, () => ({ expected: "4-19", actual: groundDodge(c, Action.moveRight).intangible })) },
  { area: "shield/dodge", name: "air dodge intangible frames", cite: `${DODGE_INTANGIBLE}; EscapeAir 50 frames (retail-escapeair-events.json)`, run: (c) => forReference(c, () => ({ expected: "4-29", actual: airDodgeIntangible(c) })) },
  {
    area: "shield/dodge", name: "air dodge first-frame travel (Melee units)",
    cite: "PlCo +0x338 = 3.1 force x +0x33C = 0.9 decay before the first move: melee:src/melee/ft/kinds/ftCommon/ftCo_EscapeAir.c",
    run: (c) => ({ expected: f32(3.0999999046325684 * 0.8999999761581421), actual: airDodgeFirstTravel(c), tolerance: 0.0001 }),
  },
  {
    area: "shield/dodge", name: "waveland landing lag (frames to act)",
    cite: "PlCo +0x344 = 10 LandingFallSpecial lag: melee:src/melee/ft/kinds/ftCommon/ftCo_EscapeAir.c:116",
    run: (c) => ({ expected: 10, actual: landingLag(c, wavelandFall) }),
  },
];

// ------------------------------------------------------------------ ledges

function ledgeBox(character: Character): { reach: number; highest: number } {
  const snap = ledgeSnap(character);
  return { reach: 6.0 * (LEDGE_BODY_HALF_WIDTH + snap.x), highest: 6.0 * (snap.y + snap.height / 2.0) };
}

/** Falls from `below` under the right ledge, `outside` beyond it, facing the stage, until a catch or well past the ledge. */
function catchesLedge(character: Character, outside: number, below: number): boolean {
  const s = solo(0, character);
  const f = fighter(s);
  airborne(f, surfaceRight(0, 0) + outside, surfaceZ(0, 0) - below);
  f.facing = -1;
  f.jump.remaining = 1;
  for (let n = 1; n <= 120; n++) {
    frame(s, []);
    if (f.ledge.state !== LedgeState.none) return true;
    if (surfaceZ(0, 0) - f.motion.z > below + 250.0) break;
  }
  return false;
}

const LEDGE_BOX = "ledge snap ftData x44 +0x10/+0x14/+0x18: Fox/Falco 11/13/9, Captain Falcon 9/17/11 (Illidan), reach adds the 2-unit minimum ECB half-width; melee:src/melee/ft/ftcliffcommon.c, melee:src/melee/mp/mpcoll.c mpColl_80044164 (#47)";

const LEDGES: readonly Scenario[] = [
  { area: "ledge", name: "fall from ledge height 60 units out", cite: LEDGE_BOX, run: (c) => ({ expected: true, actual: catchesLedge(c, 60.0, 0.0) }) },
  { area: "ledge", name: "fall from ledge height, reach - 1 out (77; Illidan 65)", cite: LEDGE_BOX, run: (c) => ({ expected: true, actual: catchesLedge(c, ledgeBox(c).reach - 1.0, 0.0) }) },
  { area: "ledge", name: "fall from ledge height, reach + 1 out (79; Illidan 67)", cite: LEDGE_BOX, run: (c) => ({ expected: false, actual: catchesLedge(c, ledgeBox(c).reach + 1.0, 0.0) }) },
  { area: "ledge", name: "fall from 1 unit inside the box top (104; Illidan 134 below)", cite: LEDGE_BOX, run: (c) => ({ expected: true, actual: catchesLedge(c, 30.0, ledgeBox(c).highest - 1.0) }) },
  { area: "ledge", name: "fall from 1 unit above the box top (106; Illidan 136 below)", cite: LEDGE_BOX, run: (c) => ({ expected: false, actual: catchesLedge(c, 30.0, ledgeBox(c).highest + 1.0) }) },
];

// ------------------------------------------------------------------ table

const SCENARIOS: readonly Scenario[] = [
  ...JUMPS, ...GROUND, ...FAST_FALL, ...LANDING, ...TECHS, ...GETUPS, ...KNOCKBACK, ...PLATFORMS, ...SURFACES, ...SHIELD_AND_DODGES, ...LEDGES,
];

const rowKey = (row: Pick<OracleRow, "area" | "scenario" | "fighter">): string => `${row.area} | ${row.scenario} | ${row.fighter}`;

export function runOracle(): OracleRow[] {
  return SCENARIOS.flatMap((scenario) => FIGHTERS.map(({ character, name }) => rowFor(scenario, character, name)));
}

/**
 * Rows that may mismatch until their owning issue lands, keyed by rowKey, each
 * with that issue; CI fails on any other mismatch and on a listed row that passes.
 */
const knownFor = (area: string, scenario: string, reason: string): [string, string][] =>
  FIGHTERS.map(({ name }) => [rowKey({ area, scenario, fighter: name }), reason]);

const KNOWN_MISMATCHES: ReadonlyMap<string, string> = new Map([
  ...knownFor("landing", "L 7 frames before landing, 3 of them in own hitlag, cancels",
    "the L-cancel window pauses during hitlag instead of aging (lCancelWindow, smashcraft:ts/src/game/sim/step.ts)"),
  ...knownFor("platform", "still holding down 30 frames after that landing",
    "held Down drops through a platform without a fresh press (platform drop, smashcraft:ts/src/game/sim/step.ts)"),
]);

/** Mismatches that aren't known, known mismatches that now pass, and known rows the table no longer has. */
export function oracleProblems(rows: readonly OracleRow[]): string[] {
  const keys = new Set(rows.map(rowKey));
  return [
    ...rows.filter((row) => row.outcome === "mismatch" && !KNOWN_MISMATCHES.has(rowKey(row)))
      .map((row) => `new mismatch: ${rowKey(row)}: expected ${row.expected}, got ${row.actual}`),
    ...rows.filter((row) => row.outcome !== "mismatch" && KNOWN_MISMATCHES.has(rowKey(row)))
      .map((row) => `known mismatch now ${row.outcome}: ${rowKey(row)}; remove it from KNOWN_MISMATCHES`),
    ...[...KNOWN_MISMATCHES.keys()].filter((key) => !keys.has(key)).map((key) => `known mismatch has no row: ${key}`),
  ];
}

const pad = (text: string, width: number): string => text.padEnd(width);

/** The table grouped by scenario with its citation, then counts per area and every mismatch with its owner. */
export function formatOracle(rows: readonly OracleRow[]): string {
  const lines: string[] = [];
  let previous = "";
  for (const row of rows) {
    const heading = `${row.area}: ${row.scenario}`;
    if (heading !== previous) {
      lines.push("", heading, `    ${row.cite}`);
      previous = heading;
    }
    const mark = row.outcome === "mismatch" ? (KNOWN_MISMATCHES.has(rowKey(row)) ? "MISMATCH (known)" : "MISMATCH") : row.outcome;
    lines.push(`    ${pad(row.fighter, 9)} expected ${pad(row.expected, 28)} actual ${pad(row.actual, 28)} ${mark}`);
  }
  lines.push("", `${pad("area", 13)} ${pad("pass", 5)} ${pad("mismatch", 9)} n/a`);
  for (const area of [...new Set(rows.map((row) => row.area))]) {
    const count = (outcome: Outcome) => rows.filter((row) => row.area === area && row.outcome === outcome).length;
    lines.push(`${pad(area, 13)} ${pad(String(count("pass")), 5)} ${pad(String(count("mismatch")), 9)} ${count("n/a")}`);
  }
  const total = (outcome: Outcome) => rows.filter((row) => row.outcome === outcome).length;
  lines.push(`${pad("all", 13)} ${pad(String(total("pass")), 5)} ${pad(String(total("mismatch")), 9)} ${total("n/a")}`);
  const mismatches = rows.filter((row) => row.outcome === "mismatch");
  if (mismatches.length > 0) {
    lines.push("", "mismatches:");
    for (const row of mismatches) lines.push(`  ${rowKey(row)}: expected ${row.expected}, got ${row.actual} - ${KNOWN_MISMATCHES.get(rowKey(row)) ?? "not known"}`);
  }
  return lines.join("\n");
}
