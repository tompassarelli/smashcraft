// The Melee behaviour oracle (#53): scripted situations for every fighter,
// played through the frame executor from controller rows, compared with
// values cited from the NTSC 1.02 decompilation and the retail reference
// corpus. `bun wisp oracle` prints the table; meleeOracle.tests.ts keeps CI
// to the known mismatches below. A row where Smashcraft departs from Melee by
// decision names that decision and still shows Melee's value.
//
// Citations: melee: is ~/code/resources/melee at 0296f009f32f710495979d30772d8332af2d411a.
// Fighter data is recorded in smashcraft:docs/smash-melee-reference/physics-parameters.json
// and retail-action-lengths.json. Common values marked "PlCo" were read from the
// owner's GALE01 revision 2 PlCo.dat (SHA-1 c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41);
// the retail files stay private, only the cited numbers appear here.
import { Action } from "../src/game/input/actions";
import { AttackStyle, Character, ContactKind, DownState, LedgeState, SurfaceContact } from "../src/game/sim/codes";
import { isIntangible } from "../src/game/sim/conditions";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "../src/game/sim/contacts";
import { type Fighter, createFighter } from "../src/game/sim/fighter";
import { uncancelledLandingLag } from "../src/game/sim/moves";
import { DRIFTING_DECK_STAGE, MAIN_DECK_BODY_SURFACES, SOLID_DECK_TEST_STAGE, solidSurfaceAt, mainDeckRight, mainDeckZ, surfaceZ } from "../src/game/sim/stage";
import { bodyTop } from "../src/game/sim/surfaces";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../src/game/sim/tuning";
import { type Scene, airborne, fighter, frame, framesUntil, scene, solo, tumbling } from "./frameScene";

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

type Outcome = "pass" | "mismatch" | "departure" | "n/a";

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
  /** A difference from Melee: its row in smashcraft:docs/gameplay-design.md's deviations table, then the decision, its owner and date. */
  readonly departure?: string;
}

const FIGHTERS = [
  { character: Character.archer, name: "Archer" },
  { character: Character.rifleman, name: "Rifleman" },
  { character: Character.demonHunter, name: "Illidan" },
] as const;

const show = (value: string | number | boolean): string =>
  typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "")) : String(value);

function rowFor(scenario: Scenario, character: Character, name: string): OracleRow {
  const base = { area: scenario.area, scenario: scenario.name, fighter: name, cite: scenario.departure === undefined ? scenario.cite : `${scenario.cite}; departure: ${scenario.departure}` };
  const check = scenario.run(character);
  if (check === undefined) return { ...base, expected: "-", actual: "-", outcome: "n/a" };
  const { expected, actual, tolerance = 0.0 } = check;
  const pass = typeof expected === "number" && typeof actual === "number" ? Math.abs(expected - actual) <= tolerance : expected === actual;
  return { ...base, expected: show(expected), actual: show(actual), outcome: pass ? "pass" : scenario.departure === undefined ? "mismatch" : "departure" };
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

// ------------------------------------------------------------------ landing lag

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

interface Fall {
  /** Places the fighter before frame 1. */
  readonly setup: (f: Fighter) => void;
  readonly held: (frame: number) => readonly Action[];
}

/** Plays a fall until it lands and, when asked, until a jump pressed on `jumpAt` was or wasn't accepted. */
function playFall(character: Character, { setup, held }: Fall, jumpAt?: number): { landing: number | undefined; jumped: boolean } {
  const s = solo(0, character);
  const f = fighter(s);
  setup(f);
  let landing: number | undefined;
  let jumped = false;
  for (let n = 1; n <= 120; n++) {
    frame(s, n === jumpAt ? [...held(n), Action.jump] : held(n));
    if (landing === undefined && f.motion.grounded) landing = n;
    if (n === jumpAt) jumped = f.jump.squat > 0;
    if (landing !== undefined && n >= (jumpAt ?? landing)) break;
  }
  return { landing, jumped };
}

/** Frames after the landing frame until a jump is accepted. */
function landingLag(character: Character, fall: Fall): number {
  const { landing } = playFall(character, fall);
  if (landing === undefined) throw new Error("the fall never landed");
  return firstAccepted((wait) => playFall(character, fall, landing + wait).jumped);
}

const emptyFall: Fall = { setup: (f) => airborne(f, 0.0, 120.0), held: () => [] };
/** A neutral aerial started on frame 1 from 200 units up, with no other button. */
const aerialFall: Fall = { setup: (f) => airborne(f, 0.0, 200.0), held: (n) => (n === 1 ? [Action.attack] : []) };

const L_CANCEL = "an L/R press under PlCo +0x0E4 = 7 frames before landing (x67F, fighter.c Fighter_procInput) divides the lag by PlCo +0x0E8 = 2, at least 1: melee:src/melee/ft/kinds/ftCommon/ftCo_LandingAir.c";
const NAIR_LAG = uncancelledLandingLag(AttackStyle.neutralAir);

const LANDING: readonly Scenario[] = [
  {
    area: "landing", name: "empty landing lag (frames to act)",
    cite: `${JUMP_DATA} +0x0E4 normal_landing_lag 4; melee:src/melee/ft/kinds/ftCommon/ftCo_Landing.c`,
    run: (c) => forReference(c, () => ({ expected: 4, actual: landingLag(c, emptyFall) })),
  },
  {
    area: "landing", name: `neutral aerial landing lag is Melee's L-cancelled lag (authored ${NAIR_LAG})`,
    cite: L_CANCEL,
    run: (c) => ({ expected: Math.max(1, Math.trunc(NAIR_LAG / 2)), actual: landingLag(c, aerialFall) }),
  },
  {
    area: "landing", name: "neutral aerial landing lag with no L press",
    cite: L_CANCEL,
    departure: "L-cancelling: removed, every aerial lands with the cancelled lag (owner decision 2026-10-06, #54)",
    run: (c) => ({ expected: NAIR_LAG, actual: landingLag(c, aerialFall) }),
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
const C_STICK_GETUP = "DownWait IASA: ftCo_800984D4 attacks on a C-stick up crossing PlCo +0x7F4 = 0.6625 (ftCo_800DF644), ftCo_Down_CheckInput rolls on a C-stick sideways crossing +0x248 = 0.2 within +0x020 of horizontal (ftCo_800DF678): melee:src/melee/ft/kinds/ftCommon/ftCo_DownAttack.c, ftCo_Down.c, melee:src/melee/ft/ft_0DF1.c";
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
  {
    area: "getup", name: "C-stick up flick in the down wait: get-up attack",
    cite: C_STICK_GETUP,
    run: (c) => ({ expected: "get-up attack", actual: downStateName(stateAfter(knockdown(c, 120, (after) => (after === 40 ? [Action.smashUp] : [])), DownState.wait)) }),
  },
  {
    area: "getup", name: "C-stick right flick in the down wait: roll",
    cite: C_STICK_GETUP,
    run: (c) => ({ expected: "roll", actual: downStateName(stateAfter(knockdown(c, 120, (after) => (after === 40 ? [Action.smashRight] : [])), DownState.wait)) }),
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

/** The test hit landed `count` times in a row by the same attacker on a target put back to 0% each time; each hit's damage, knockback and hitstun. */
function repeatedHits(character: Character, count: number): string[] {
  const s = scene(0, [{ character, x: 0.0, facing: 1 }, { character: Character.rifleman, x: -60.0, facing: 1 }]);
  const target = fighter(s, 0);
  const hits: string[] = [];
  for (let n = 0; n < count; n++) {
    target.status.damage = 0.0;
    target.launch.hitstun = 0;
    target.launch.hitlag = 0;
    target.down.state = DownState.none;
    beginDamageContacts();
    collectDamageContact(s.world, 1, 0, TEST_HIT, 1, ContactKind.launch, false, undefined, false);
    finishDamageContacts(s.world);
    hits.push(`${target.status.damage} damage, knockback ${target.launch.knockbackX}, ${target.launch.hitstun} hitstun`);
  }
  return hits;
}

const STALE_MOVES = "ft_80089118 scales damage by 1 - the staling table entries (Fighter_804D6548, PlCo data) for each of the last 9 queued instances of the same move id, queued by plStale_UpdateStaleMovesFromFighter (melee:src/melee/pl/plstale.c) and applied by ft_80089228 (melee:src/melee/ft/ft_0881.c:337)";

const KNOCKBACK: readonly Scenario[] = [
  {
    area: "knockback", name: "the same move landing 5 times in a row: hit 5 damage against hit 1",
    cite: STALE_MOVES,
    departure: "Stale moves and freshness bonuses: none (owner decision 2026-10-04, reaffirmed 2026-10-06)",
    run: (c) => {
      const hits = repeatedHits(c, 5);
      return { expected: "hit 5 deals less than hit 1", actual: hits.every((hit) => hit === hits[0]) ? `all 5 hits: ${hits[0]}` : `varies: ${hits.join("; ")}` };
    },
  },
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
  f.motion.z = surfaceZ(1, 1, 0);
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
  { area: "platform", name: "grounded fighter rides a moving floor in hitlag", cite: "Fighter_procUpdate adds mpGetSpeed's floor-line displacement while grounded, before its hitlag return (melee:src/melee/ft/fighter.c)", run: (c) => {
    const s = solo(DRIFTING_DECK_STAGE, c, 0.0);
    const f = fighter(s);
    f.motion.surface = 1;
    f.motion.z = surfaceZ(DRIFTING_DECK_STAGE, 1, 0);
    f.launch.hitlag = 10;
    frame(s, []);
    return { expected: "2.5", actual: String(f.motion.x) };
  } },
  { area: "platform", name: "fresh down on a moving platform", cite: PLATFORM_PASS, run: (c) => {
    const s = solo(DRIFTING_DECK_STAGE, c, 0.0);
    const f = fighter(s);
    f.motion.surface = 1;
    f.motion.z = surfaceZ(DRIFTING_DECK_STAGE, 1, 0);
    frame(s, []);
    for (let n = 1; n <= 90; n++) frame(s, [Action.moveDown]);
    return { expected: "main deck", actual: standing(f) };
  } },
  { area: "platform", name: "full hop from under a raised deck", cite: PLATFORM_LINES, run: (c) => ({ expected: "raised deck", actual: fullHopUnderDeck(c) }) },
  { area: "platform", name: "down pressed on a raised deck", cite: PLATFORM_PASS, run: (c) => ({ expected: "main deck", actual: downOnDeck(c) }) },
  { area: "platform", name: "falling onto a raised deck holding down: landing", cite: `${PLATFORM_LINES}; airborne collision has no stick test (melee:src/melee/ft/ft_081B.c)`, run: (c) => ({ expected: "raised deck", actual: landHoldingDown(c, 0) }) },
  { area: "platform", name: "still holding down 30 frames after that landing", cite: PLATFORM_PASS, run: (c) => ({ expected: "raised deck", actual: landHoldingDown(c, 30) }) },
];

// ------------------------------------------------------------------ the main deck's walls and underside

/**
 * Final Destination's right side below its ledge vertex, in Melee units: the
 * owner's GALE01 revision 2 GrNLa.dat (SHA-1 fa607d7bb7dd4072d2d3968e1e31fd458bc397f8,
 * grGroundParam scale 1), coll_data rightWall lines 9, 10, 7, 8, 6 and
 * ceiling line 5 (melee:src/melee/mp/types.h MapCollData, MapLine).
 */
const REFERENCE_LEDGE_X = 85.5656967163086;
const REFERENCE_RIGHT_SIDE: readonly (readonly [number, number])[] = [
  [85.5656967163086, 0.0], [85.5656967163086, -10.5], [65.79930114746094, -20.453800201416016], [65.83740234375, -31.34429931640625],
  [61.419498443603516, -47.36629867553711], [53.77360153198242, -54.258399963378906], [47.45600128173828, -55.38819885253906],
];
/** Its level underside, ceiling line 4, from -47.456 to 47.456. */
const REFERENCE_UNDERSIDE_Y = -55.38819885253906;
const STAGE_COLLISION = "Final Destination's coll_data (GrNLa.dat, GALE01 rev 2): rightWall lines 9, 10, 7, 8, 6, ceiling lines 5, 4; each side kept as far from its ledge, the underside spanning the wider deck";

const RIGHT_LEDGE = mainDeckRight(0);

/** The reference side's x, from its ledge vertex, `depth` Melee units below the ledge. */
function referenceSideX(depth: number): number | undefined {
  for (let i = 0; i + 1 < REFERENCE_RIGHT_SIDE.length; i++) {
    const [x0, y0] = REFERENCE_RIGHT_SIDE[i] ?? [0, 0];
    const [x1, y1] = REFERENCE_RIGHT_SIDE[i + 1] ?? [0, 0];
    if (-depth > y0 || -depth < y1) continue;
    return (y0 === y1 ? x0 : x0 + ((x1 - x0) * (-depth - y0)) / (y1 - y0)) - REFERENCE_LEDGE_X;
  }
  return undefined;
}

interface WallMeeting {
  /** Where the fighter's flank met the side, from the ledge vertex and below it (Melee units). */
  readonly x: number;
  readonly depth: number;
  /** Where the fighter stopped, from the ledge vertex. */
  readonly stop: number;
}

/** A tumbler launched left into the main deck's right side about `depth` Melee units below its ledge. */
function meetSide(character: Character, depth: number): WallMeeting | undefined {
  const s = solo(0, character);
  const f = fighter(s);
  const flank = (referenceSideX(depth) ?? 0.0) + LEDGE_BODY_HALF_WIDTH;
  tumbling(f, RIGHT_LEDGE + (flank + 2.0) * WORLD_UNITS_PER_MELEE_UNIT, -depth * WORLD_UNITS_PER_MELEE_UNIT);
  f.launch.knockbackX = -18.0;
  for (let n = 1; n <= 10; n++) {
    frame(s, []);
    const { contactSerial, contactX, contactZ } = f.surfaceRecovery;
    if (contactSerial > 0) return { x: melee(contactX - RIGHT_LEDGE), depth: melee(-contactZ), stop: melee(f.motion.x - RIGHT_LEDGE) };
  }
  return undefined;
}

/** Where the side met the fighter beside the reference side at the depth it met it. */
function sideCheck(character: Character, depth: number): Check {
  const meeting = meetSide(character, depth);
  if (meeting === undefined) return { expected: "wall", actual: "no contact" };
  return { expected: referenceSideX(meeting.depth) ?? Number.NaN, actual: meeting.x, tolerance: 0.001 };
}

/** How far under the floor a tumbler launched up beneath the deck's middle meets its underside (Melee units). */
/**
 * Each fighter's Melee ECB top in the air, Melee units: the highest of its
 * six ECB bones (ftData x44) in its model's bind pose (PlFxNr.dat, PlFcNr.dat,
 * PlCaNr.dat) times its model_scaling (+0x8C), with no pad, as falls and
 * jumps load it (melee:src/melee/mp/mpcoll.c mpColl_LoadECB_JObj): Fox 11.625
 * x 0.96, Falco 12.5 x 1.1, Captain Falcon (Illidan) 19.3585 x 0.97.
 */
function referenceEcbTop(character: Character): number {
  if (character === Character.archer) return 11.15999984741211;
  if (character === Character.rifleman) return 13.75;
  return 18.777746200561523;
}

interface CeilingMeeting {
  /** Where the fighter met the ceiling, and how far below it the fighter then stood (Melee units). */
  readonly contactZ: number;
  readonly below: number;
}

/** A tumbler launched up from `gap` world units under `ceiling` (its top that far below it) until it meets it. */
function meetCeiling(stage: number, character: Character, x: number, ceiling: number, gap: number): CeilingMeeting | undefined {
  const s = solo(stage, character, x);
  const f = fighter(s);
  tumbling(f, x, ceiling - bodyTop(character) * WORLD_UNITS_PER_MELEE_UNIT - gap);
  f.launch.knockbackZ = 18.0;
  const contact = framesUntil(s, () => f.surfaceRecovery.contactSerial > 0, 10);
  return contact === undefined ? undefined : { contactZ: melee(f.surfaceRecovery.contactZ), below: melee(f.surfaceRecovery.contactZ - f.motion.z) };
}

/** Beneath the main deck's middle, its top 3 under the underside: the bottom blast zone leaves Fox and Falco that much room. */
const meetUnderside = (character: Character) => meetCeiling(0, character, 0.0, REFERENCE_UNDERSIDE_Y * WORLD_UNITS_PER_MELEE_UNIT, 3.0);

/** The solid-deck test stage's left raised deck's underside, which stands high enough above the floor for every fighter's top. */
const RAISED_UNDERSIDE_Z = solidSurfaceAt(SOLID_DECK_TEST_STAGE, MAIN_DECK_BODY_SURFACES + 2).startZ;
const meetRaisedUnderside = (character: Character) => meetCeiling(SOLID_DECK_TEST_STAGE, character, -265.0, RAISED_UNDERSIDE_Z, 10.0);

interface SurfaceRun {
  readonly contact: number | undefined;
  readonly result: string;
}

/**
 * A tumbler presses tech on frame 2, is then held `frozen` frames in hitlag
 * and flies left into the main deck's right side below the ledge, or up into
 * its underside. Tech ages count hitlag frames in both games.
 */
function surfaceRun(character: Character, wall: boolean, press: boolean, frozen: number): SurfaceRun {
  const s = solo(wall ? 0 : SOLID_DECK_TEST_STAGE, character, wall ? 0.0 : -265.0);
  const f = fighter(s);
  // Under the raised deck, the fighter's top starts 30 under its underside.
  const below = RAISED_UNDERSIDE_Z - bodyTop(character) * WORLD_UNITS_PER_MELEE_UNIT - 30.0;
  tumbling(f, wall ? RIGHT_LEDGE + 200.0 : 0.0, 400.0);
  for (let n = 1; n <= 60; n++) {
    if (n === 3) {
      tumbling(f, wall ? RIGHT_LEDGE + 30.0 : -265.0, wall ? -30.0 : below);
      f.launch.knockbackX = wall ? -18.0 : 0.0;
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

/**
 * Wall data, Melee units a frame: ftCo_DatAttrs +0x100 passivewall_vel_x and
 * +0x104/+0x108 wall jump launch from the retail PlFx/PlFc/PlCa.dat
 * (physics-parameters.json). Archer = Fox, Rifleman = Falco, Illidan =
 * Captain Falcon; all three set can_walljump.
 */
function referenceWall(character: Character): { readonly pushOff: number; readonly jumpX: number; readonly jumpZ: number } {
  if (character === Character.archer) return { pushOff: 0.5, jumpX: 1.399999976158142, jumpZ: 3.299999952316284 };
  if (character === Character.rifleman) return { pushOff: 0.5, jumpX: 1.2999999523162842, jumpZ: 3.5999999046325684 };
  return { pushOff: 0.5, jumpX: 1.399999976158142, jumpZ: 3.0999999046325684 };
}

/** The fighter's own air friction and gravity in Melee units: Fox's and Falco's for Archer and Rifleman, Illidan's authored ones. */
function airDrag(character: Character): { readonly friction: number; readonly gravity: number } {
  const { airFriction, gravity } = createFighter(character, 0.0, 1).tuning.physics;
  return { friction: f32(melee(airFriction)), gravity: f32(melee(gravity)) };
}

interface WallLeave {
  /** Frames from the wall recovery's first frame until the fighter moves off the wall. */
  readonly hang: number;
  /** Its speed away from the wall on that frame, and how far it then rose (Melee units). */
  readonly speed: number;
  readonly rise: number;
}

/** Plays a wall recovery that began this frame until the fighter leaves the wall and stops rising. */
function leaveWall(s: Scene): WallLeave | undefined {
  const f = fighter(s);
  if (f.surfaceRecovery.state !== SurfaceContact.techWall) return undefined;
  const hang = framesUntil(s, () => f.motion.deltaX !== 0.0 || f.motion.deltaZ !== 0.0, 10);
  if (hang === undefined) return undefined;
  const speed = melee(f.motion.deltaX);
  const wallZ = f.motion.z - f.motion.deltaZ;
  let top = Math.max(wallZ, f.motion.z);
  for (let n = 1; n <= 120 && f.motion.deltaZ > 0; n++) {
    frame(s, []);
    top = Math.max(top, f.motion.z);
  }
  return { hang, speed, rise: melee(top - wallZ) };
}

/** A tumbler that pressed tech, launched left into the main deck's right side 5 units below its ledge; `up` holds the stick up. */
function wallTechLeave(character: Character, up: boolean): WallLeave | undefined {
  const s = solo(0, character);
  const f = fighter(s);
  tumbling(f, RIGHT_LEDGE + 30.0, -30.0);
  f.launch.knockbackX = -18.0;
  const held = (n: number): readonly Action[] => [...(n === 1 ? [Action.leftTrigger] : []), ...(up ? [Action.moveUp] : [])];
  if (framesUntil(s, () => f.surfaceRecovery.contactSerial > 0, 10, held) === undefined) return undefined;
  return leaveWall(s);
}

/**
 * Drifts left at `speed` (world units a frame) from `outside` world units
 * beyond the main deck's right side, just below its ledge and facing away,
 * holding left until it meets the side, then flicks the stick right.
 */
function wallJumpLeave(character: Character, outside: number, speed: number): WallLeave | undefined {
  const s = solo(0, character);
  const f = fighter(s);
  airborne(f, RIGHT_LEDGE + LEDGE_BODY_HALF_WIDTH * WORLD_UNITS_PER_MELEE_UNIT + outside, -10.0);
  f.facing = 1;
  f.motion.vx = -speed;
  if (framesUntil(s, () => f.surfaceRecovery.contactSerial > 0, 20, () => [Action.moveLeft]) === undefined) return undefined;
  frame(s, [Action.moveRight]);
  return leaveWall(s);
}

const fastWallJump = (character: Character): WallLeave | undefined => wallJumpLeave(character, 30.0, createFighter(character, 0.0, 1).tuning.physics.airSpeed);

function leaveCheck(leave: WallLeave | undefined, check: (leave: WallLeave) => Check): Check {
  return leave === undefined ? { expected: "leaves the wall", actual: "no wall recovery" } : check(leave);
}

const WALL_HANG = "PlCo +0x760 = 5 (wall tech) and +0x774 = 5 (wall jump) frames held on the wall: melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c ftCo_800C1E64, ftCo_PassiveWall_Anim";
const WALL_LAUNCH = "ftCo_DatAttrs +0x100 push-off 0.5, +0x104/+0x108 wall jump 1.4/3.3 (Fox), 1.3/3.6 (Falco), 1.4/3.1 (Captain Falcon) from the retail DATs (physics-parameters.json), set when the hang ends, then a frame of aerial friction and gravity: ftCo_PassiveWall_Anim, ftCo_PassiveWall_Phys";
const WALL_JUMP = "can_walljump (ftFx/ftFc/ftCa_Init_OnLoad); met faster than +0x148 = 0.5 a frame, then the stick at least PlCo +0x76C = 0.8 away within +0x770 = 3 frames of leaving the deadzone and +0x768 = 130 frames of meeting the wall: melee:src/melee/ft/ftwalljump.c ftWallJump_8008169C";

/**
 * Ceiling tech data: ftCo_DatAttrs +0x10C passiveceil_vel_x (Melee units a
 * frame) from the retail DATs and the animation's impulse event frame
 * (retail-ceiling-tech-events.json): Fox and Falco 0.7 on frame 14, Captain
 * Falcon (Illidan) 2.0 on frame 11; and +0x078 air_max_horizontal_velocity,
 * the cap of the drift that follows: Fox 3, Falco 4, Captain Falcon 3.
 */
function referenceCeiling(character: Character): { readonly speed: number; readonly frame: number; readonly airMax: number } {
  if (character === Character.demonHunter) return { speed: 2.0, frame: 11, airMax: 3.0 };
  return { speed: 0.699999988079071, frame: 14, airMax: character === Character.rifleman ? 4.0 : 3.0 };
}

/**
 * One frame of Melee's air drift with the stick fully toward `velocity`
 * (ftCommon_CalcSelfAccel_DriftFrom, ftCommon_CalcSelfAccel_AccelToVelClampedFrom,
 * melee:src/melee/ft/ftcommon.c): the acceleration toward the drift maximum,
 * or, past it, the air friction instead, no lower than that maximum and no
 * higher than air_max_horizontal_velocity. Melee units, from the fighter's own
 * air values.
 */
function meleeAirDrift(character: Character, velocity: number, airMax: number): number {
  const physics = createFighter(character, 0.0, 1).tuning.physics;
  const target = f32(melee(physics.airSpeed));
  let accel = f32(melee(physics.airAcceleration));
  if (f32(velocity + accel) > target) {
    accel = -f32(melee(physics.airFriction));
    if (f32(velocity + accel) < target) accel = f32(target - velocity);
    if (f32(velocity + accel) > airMax) accel = f32(airMax - velocity);
  }
  return f32(velocity + accel);
}

/**
 * A tumbler that pressed tech, launched up into the left raised deck's
 * underside on the solid-deck test stage, holding the stick left only on
 * frame `leftOn` after the contact: its sideways speed then (Melee units).
 * The shipped stages' one underside, the main deck's, is too near the bottom
 * blast zone for a fighter to reach the impulse.
 */
function ceilingTechSpeed(character: Character, leftOn: number): number | undefined {
  const s = solo(SOLID_DECK_TEST_STAGE, character, -265.0);
  const f = fighter(s);
  tumbling(f, -265.0, RAISED_UNDERSIDE_Z - bodyTop(character) * WORLD_UNITS_PER_MELEE_UNIT - 10.0);
  f.launch.knockbackZ = 18.0;
  if (framesUntil(s, () => f.surfaceRecovery.contactSerial > 0, 10, (n) => (n === 1 ? [Action.leftTrigger] : [])) === undefined) return undefined;
  if (f.surfaceRecovery.state !== SurfaceContact.techCeiling) return undefined;
  // Held airborne: the floor below the raised deck is nearer than the fall to the impulse frame.
  f.tuning = { ...f.tuning, physics: { ...f.tuning.physics, gravity: 0.0 } };
  for (let n = 1; n <= leftOn; n++) frame(s, n === leftOn ? [Action.moveLeft] : []);
  return f.motion.grounded ? undefined : melee(f.motion.vx);
}

/** The first frame after the contact on which the stick moves the fighter faster than a frame of air drift alone. */
function ceilingImpulseFrame(character: Character): number | string {
  const drift = melee(createFighter(character, 0.0, 1).tuning.physics.airAcceleration);
  for (let leftOn = 1; leftOn <= 20; leftOn++) {
    const speed = ceilingTechSpeed(character, leftOn);
    if (speed === undefined) return "no ceiling tech in the air";
    if (Math.abs(speed) > drift + 0.0001) return leftOn;
  }
  return "no impulse";
}

const CEILING_IMPULSE = "ftCo_DatAttrs +0x10C passiveceil_vel_x 0.7 (Fox, Falco), 2.0 (Captain Falcon) from the retail DATs times the stick at the animation's throw-flag event, frame 14 (Fox, Falco) or 11 (Captain Falcon) (retail-ceiling-tech-events.json): melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveCeil.c ftCo_PassiveCeil_Anim, then a frame of air drift (ft_081B.c ft_80084DB0); under the solid-deck test stage's raised deck, gravity held at zero after the contact since its floor is nearer than the fall to the impulse frame";

const ECB_TOP = "ceilings meet the fighter's airborne ECB top, the highest of its six ftData x44 ECB bones in the model's bind pose times model_scaling +0x8C: Fox 11.16, Falco 13.75, Captain Falcon 18.78 (melee:src/melee/mp/mpcoll.c mpColl_LoadECB_JObj; PlFxNr/PlFcNr/PlCaNr.dat)";

const SURFACE_GATE = "wall and ceiling techs use the floor's gate 0x800986B0 (PlCo +0x250 = 20, +0x01C = 40): melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c ftCo_800C1D38, ftCo_PassiveCeil.c";
const WALL_FLANK = "the ECB's side meets a wall, and mpColl_LoadECB_JObj keeps an airborne ECB at least 2 units a side (melee:src/melee/mp/mpcoll.c); airborne collision moves only the position (melee:src/melee/ft/ft_081B.c ft_800835B0)";

const SURFACES: readonly Scenario[] = [
  { area: "wall/ceiling", name: "main deck side: where a launch about 5 below the ledge meets it (from the ledge)", cite: STAGE_COLLISION, run: (c) => sideCheck(c, 5.0) },
  { area: "wall/ceiling", name: "main deck side: where a launch about 15 below the ledge meets it (from the ledge)", cite: STAGE_COLLISION, run: (c) => sideCheck(c, 15.0) },
  { area: "wall/ceiling", name: "main deck side: where a launch about 40 below the ledge meets it (from the ledge)", cite: STAGE_COLLISION, run: (c) => sideCheck(c, 40.0) },
  {
    area: "wall/ceiling", name: "main deck side: a fighter stopped against its top, outside the wall", cite: WALL_FLANK,
    run: (c) => {
      const meeting = meetSide(c, 5.0);
      return meeting === undefined ? { expected: "wall", actual: "no contact" } : { expected: LEDGE_BODY_HALF_WIDTH, actual: meeting.stop - meeting.x, tolerance: 0.001 };
    },
  },
  {
    area: "wall/ceiling", name: "main deck underside: a rise beneath its middle meets it this far under the floor", cite: STAGE_COLLISION,
    run: (c) => {
      const meeting = meetUnderside(c);
      return { expected: -REFERENCE_UNDERSIDE_Y, actual: meeting === undefined ? "no contact" : -meeting.contactZ, tolerance: 0.001 };
    },
  },
  {
    area: "wall/ceiling", name: "main deck underside: a rise beneath its middle stops the fighter this far under it (its ECB top)", cite: ECB_TOP,
    run: (c) => {
      const meeting = meetUnderside(c);
      return { expected: referenceEcbTop(c), actual: meeting === undefined ? "no contact" : meeting.below, tolerance: 0.001 };
    },
  },
  {
    area: "wall/ceiling", name: "raised deck underside (solid-deck test stage): a rise stops the fighter this far under it (its ECB top)", cite: ECB_TOP,
    run: (c) => {
      const meeting = meetRaisedUnderside(c);
      return { expected: referenceEcbTop(c), actual: meeting === undefined ? "no contact" : meeting.below, tolerance: 0.001 };
    },
  },
  { area: "wall/ceiling", name: "wall tech off the main deck's side 19 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "tech", actual: surfaceTech(c, true, 19) }) },
  { area: "wall/ceiling", name: "wall tech off the main deck's side 20 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "no tech", actual: surfaceTech(c, true, 20) }) },
  {
    area: "wall/ceiling", name: "wall tech: frames on the wall before it pushes off", cite: WALL_HANG,
    run: (c) => leaveCheck(wallTechLeave(c, false), (leave) => ({ expected: 5, actual: leave.hang })),
  },
  {
    area: "wall/ceiling", name: "wall tech: push-off speed away from the side (Melee units/frame)", cite: WALL_LAUNCH,
    run: (c) => leaveCheck(wallTechLeave(c, false), (leave) => ({ expected: f32(referenceWall(c).pushOff - airDrag(c).friction), actual: leave.speed, tolerance: 0.0001 })),
  },
  {
    area: "wall/ceiling", name: "wall tech with the stick up: wall jump speed away from the side", cite: `${WALL_LAUNCH}; up selects the jump: ftCo_800C1E0C`,
    run: (c) => leaveCheck(wallTechLeave(c, true), (leave) => ({ expected: f32(referenceWall(c).jumpX - airDrag(c).friction), actual: leave.speed, tolerance: 0.0001 })),
  },
  {
    area: "wall/ceiling", name: "wall tech with the stick up: wall jump rise (Melee units)", cite: `${WALL_LAUNCH}; up selects the jump: ftCo_800C1E0C`,
    run: (c) => leaveCheck(wallTechLeave(c, true), (leave) => ({ expected: aerialJumpApex(referenceWall(c).jumpZ, airDrag(c).gravity), actual: leave.rise, tolerance: 0.01 })),
  },
  {
    area: "wall/ceiling", name: "wall jump: drifting into the side at air speed, a flick away holds it this many frames", cite: `${WALL_JUMP}; ${WALL_HANG}`,
    run: (c) => leaveCheck(fastWallJump(c), (leave) => ({ expected: 5, actual: leave.hang })),
  },
  {
    area: "wall/ceiling", name: "wall jump: speed away from the side (Melee units/frame)", cite: `${WALL_JUMP}; ${WALL_LAUNCH}`,
    run: (c) => leaveCheck(fastWallJump(c), (leave) => ({ expected: f32(referenceWall(c).jumpX - airDrag(c).friction), actual: leave.speed, tolerance: 0.0001 })),
  },
  {
    area: "wall/ceiling", name: "wall jump: rise (Melee units)", cite: `${WALL_JUMP}; ${WALL_LAUNCH}`,
    run: (c) => leaveCheck(fastWallJump(c), (leave) => ({ expected: aerialJumpApex(referenceWall(c).jumpZ, airDrag(c).gravity), actual: leave.rise, tolerance: 0.01 })),
  },
  {
    area: "wall/ceiling", name: "wall jump: drifting in from 1 unit out, slower than the minimum approach speed, a flick away", cite: WALL_JUMP,
    run: (c) => ({ expected: "no wall jump", actual: wallJumpLeave(c, WORLD_UNITS_PER_MELEE_UNIT, 0.0) === undefined ? "no wall jump" : "wall jump" }),
  },
  { area: "wall/ceiling", name: "ceiling tech off a raised deck's underside (solid-deck test stage) 19 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "tech", actual: surfaceTech(c, false, 19) }) },
  { area: "wall/ceiling", name: "ceiling tech off a raised deck's underside (solid-deck test stage) 20 frames before contact", cite: SURFACE_GATE, run: (c) => ({ expected: "no tech", actual: surfaceTech(c, false, 20) }) },
  {
    area: "wall/ceiling", name: "ceiling tech: frame after contact of its sideways impulse", cite: CEILING_IMPULSE,
    run: (c) => ({ expected: referenceCeiling(c).frame, actual: ceilingImpulseFrame(c) }),
  },
  {
    area: "wall/ceiling", name: "ceiling tech: speed after the impulse frame with the stick fully left (Melee units/frame)",
    cite: `${CEILING_IMPULSE}; that frame's drift uses each fighter's air speed, acceleration and friction, so Illidan's 2.0 loses his friction rather than meeting his authored cap`,
    run: (c) => {
      const { speed, frame: impulse, airMax } = referenceCeiling(c);
      const actual = ceilingTechSpeed(c, impulse);
      return { expected: meleeAirDrift(c, speed, airMax), actual: actual === undefined ? "no ceiling tech in the air" : -actual, tolerance: 0.0001 };
    },
  },
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
const DODGE_INTANGIBLE = "Fox/Falco intangibility: body-state commands in retail-roster.json (EscapeN, EscapeF, EscapeAir), as references/melee-frame-data/records.jsonl reports for the ground dodges";

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
  airborne(f, mainDeckRight(0) + outside, mainDeckZ(0) - below);
  f.facing = -1;
  f.jump.remaining = 1;
  for (let n = 1; n <= 120; n++) {
    frame(s, []);
    if (f.ledge.state !== LedgeState.none) return true;
    if (mainDeckZ(0) - f.motion.z > below + 250.0) break;
  }
  return false;
}

/** Drifts toward the stage from 2 units outside the right wall's flank and 20 below the ledge, holding left, until a catch or well past it. */
function catchAgainstWall(character: Character): string {
  const s = solo(0, character);
  const f = fighter(s);
  airborne(f, mainDeckRight(0) + (LEDGE_BODY_HALF_WIDTH + 2.0) * WORLD_UNITS_PER_MELEE_UNIT, mainDeckZ(0) - 20.0);
  f.facing = -1;
  f.jump.remaining = 1;
  for (let n = 1; n <= 120; n++) {
    frame(s, [Action.moveLeft]);
    if (f.ledge.state !== LedgeState.none) return f.surfaceRecovery.contactSerial > 0 ? "caught against the wall" : "caught clear of the wall";
    if (mainDeckZ(0) - f.motion.z > 400.0) break;
  }
  return "fell";
}

/** A fighter hanging on the ledge past its intangible frames, grabbed from 70 units inside it: "caught", or "not caught" with the grab started. */
function grabOnLedgeHanger(character: Character): string {
  const s = scene(0, [
    { character, x: mainDeckRight(0) - 70.0, facing: 1 },
    { character, x: mainDeckRight(0) + 30.0, facing: -1 },
  ]);
  const grabber = fighter(s, 0);
  const hanger = fighter(s, 1);
  airborne(hanger, mainDeckRight(0) + 30.0, mainDeckZ(0));
  hanger.jump.remaining = 1;
  if (framesUntil(s, () => hanger.ledge.state === LedgeState.hang, 60) === undefined) return "never hung";
  if (framesUntil(s, () => !isIntangible(hanger), 60) === undefined) return "still intangible";
  let started = false;
  for (let n = 0; n < 40; n++) {
    frame(s, n === 0 ? [Action.grab] : []);
    started = started || grabber.attack.style === AttackStyle.grab;
    if (hanger.grab.grabbedFrames > 0) return "caught";
  }
  return started ? "not caught" : "grab never started";
}

const LEDGE_BOX = "ledge snap ftData x44 +0x10/+0x14/+0x18: Fox/Falco 11/13/9, Captain Falcon 9/17/11 (Illidan), reach adds the 2-unit minimum ECB half-width; melee:src/melee/ft/ftcliffcommon.c, melee:src/melee/mp/mpcoll.c mpColl_80044164 (#47)";

const LEDGES: readonly Scenario[] = [
  { area: "ledge", name: "fall from ledge height 60 units out", cite: LEDGE_BOX, run: (c) => ({ expected: true, actual: catchesLedge(c, 60.0, 0.0) }) },
  { area: "ledge", name: "fall from ledge height, reach - 1 out (77; Illidan 65)", cite: LEDGE_BOX, run: (c) => ({ expected: true, actual: catchesLedge(c, ledgeBox(c).reach - 1.0, 0.0) }) },
  { area: "ledge", name: "fall from ledge height, reach + 1 out (79; Illidan 67)", cite: LEDGE_BOX, run: (c) => ({ expected: false, actual: catchesLedge(c, ledgeBox(c).reach + 1.0, 0.0) }) },
  { area: "ledge", name: "fall from 1 unit inside the box top (104; Illidan 134 below)", cite: LEDGE_BOX, run: (c) => ({ expected: true, actual: catchesLedge(c, 30.0, ledgeBox(c).highest - 1.0) }) },
  { area: "ledge", name: "fall from 1 unit above the box top (106; Illidan 136 below)", cite: LEDGE_BOX, run: (c) => ({ expected: false, actual: catchesLedge(c, 30.0, ledgeBox(c).highest + 1.0) }) },
  { area: "ledge", name: "drifting in below the ledge, a fall along the main deck's side wall", cite: `${LEDGE_BOX}; ${WALL_FLANK}`, run: (c) => ({ expected: "caught against the wall", actual: catchAgainstWall(c) }) },
  { area: "ledge", name: "standing grab on a fighter hanging past its intangible frames", cite: "ftColl_80078A2C skips a victim with x1A6A & x1A68 (melee:src/melee/ft/ftcoll.c:1330); the hang sets x1A6A = 511 (ftCliffCommon_80081370, melee:src/melee/ft/ftcliffcommon.c:86; ftCo_8009A804, ftCo_CliffWait.c:25) and every catch sets x1A68 = 1 (ftCo_800D8C54, ftCo_Catch.c:115) (#72)", run: (c) => ({ expected: "not caught", actual: grabOnLedgeHanger(c) }) },
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
const KNOWN_MISMATCHES: ReadonlyMap<string, string> = new Map<string, string>([
  // With Illidan's top under the underside his position is below the bottom blast zone, which #80 lowers to Final Destination's.
  ["wall/ceiling | main deck underside: a rise beneath its middle meets it this far under the floor | Illidan", "#80"],
  ["wall/ceiling | main deck underside: a rise beneath its middle stops the fighter this far under it (its ECB top) | Illidan", "#80"],
]);

/** Mismatches that aren't known, known mismatches and departures that now match Melee, and known rows the table no longer has. */
export function oracleProblems(rows: readonly OracleRow[]): string[] {
  const keys = new Set(rows.map(rowKey));
  return [
    ...rows.filter((row) => row.outcome === "mismatch" && !KNOWN_MISMATCHES.has(rowKey(row)))
      .map((row) => `new mismatch: ${rowKey(row)}: expected ${row.expected}, got ${row.actual}`),
    ...rows.filter((row) => row.outcome !== "mismatch" && KNOWN_MISMATCHES.has(rowKey(row)))
      .map((row) => `known mismatch now ${row.outcome}: ${rowKey(row)}; remove it from KNOWN_MISMATCHES`),
    ...rows.filter((row) => row.outcome === "pass" && SCENARIOS.some((scenario) => scenario.name === row.scenario && scenario.departure !== undefined))
      .map((row) => `departure now matches Melee: ${rowKey(row)}; remove its departure`),
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
  const counts = (label: string, count: (outcome: Outcome) => number): string =>
    `${pad(label, 13)} ${pad(String(count("pass")), 5)} ${pad(String(count("mismatch")), 9)} ${pad(String(count("departure")), 10)} ${count("n/a")}`;
  lines.push("", `${pad("area", 13)} ${pad("pass", 5)} ${pad("mismatch", 9)} ${pad("departure", 10)} n/a`);
  for (const area of [...new Set(rows.map((row) => row.area))]) {
    lines.push(counts(area, (outcome) => rows.filter((row) => row.area === area && row.outcome === outcome).length));
  }
  lines.push(counts("all", (outcome) => rows.filter((row) => row.outcome === outcome).length));
  const mismatches = rows.filter((row) => row.outcome === "mismatch");
  if (mismatches.length > 0) {
    lines.push("", "mismatches:");
    for (const row of mismatches) lines.push(`  ${rowKey(row)}: expected ${row.expected}, got ${row.actual} - ${KNOWN_MISMATCHES.get(rowKey(row)) ?? "not known"}`);
  }
  return lines.join("\n");
}
