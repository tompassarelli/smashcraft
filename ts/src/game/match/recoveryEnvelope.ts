// Recovery envelope (smashcraft:docs/gameplay-design.md, "Recovery and
// edgeguarding"): how deep below the ledge and how far out from it a fighter
// gets back, playing its double jump, air dodge, side and up specials through
// the keyboard path and the real frame executor, from rest with its aerial
// jump unspent. Deterministic: the same build measures the same numbers.
import { assertDefined, assertTrue } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, bit } from "../input/actions";
import { copyInput } from "../input/inputRow";
import { type KeyboardCapture, commitEdges, keyboardCapture, sampleKeys } from "../input/keyboardCapture";
import { participantInputs } from "../input/participants";
import { Character, LedgeState, SpecialAction } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { ledgeCatchBox } from "../sim/ledge";
import { mainDeckRight } from "../sim/stage";
import { captureNetworkFrame, executeMatchFrame } from "./frameInput";
import { type TestMatch, testMatch } from "./testMatch";

/** Sky Deck: one flat main deck with Final Destination's walls and blast zones. */
const STAGE_CHOICE = 0;
const LEDGE_X = mainDeckRight(0);
/** The height probe starts this far outside the ledge, clear of its wall. */
export const HEIGHT_PROBE_OUT = 120.0;
/** The reach probe starts this far below the ledge, low enough that coming back needs the up special. */
export const REACH_PROBE_DEPTH = 150.0;
/** Searches stop at the blast zones (Final Destination's, 840 below and 962 beyond the ledge). */
const MAX_DEPTH = 820.0;
const MAX_REACH = 940.0;
/** A search resolves to this many world units. */
const RESOLUTION = 8.0;
const FRAME_LIMIT = 420;

/** One way to come back: when to jump, dodge, side special and up special, and where the up special aims. */
export interface RecoveryPlan {
  /** Side special toward the stage before the jump. */
  readonly sideFirst: boolean;
  /** Air dodge up and toward the stage at the jump's peak. */
  readonly dodge: boolean;
  /** Side special toward the stage at the jump's peak (after the dodge). */
  readonly sideAtPeak: boolean;
  /** Frames after the peak (or the dodge or side special) before the up special. */
  readonly upDelay: number;
  /** The up special's aim held through its startup: toward the stage (1) or not (0), and up (1) or level (0). */
  readonly aimX: number;
  readonly aimZ: number;
}

function plans(): RecoveryPlan[] {
  const list: RecoveryPlan[] = [];
  const aims = [[0, 1], [1, 1], [1, 0]] as const;
  for (const [aimX, aimZ] of aims) {
    for (const upDelay of [0, 12, 24]) list.push({ sideFirst: false, dodge: false, sideAtPeak: false, upDelay, aimX, aimZ });
    list.push({ sideFirst: false, dodge: true, sideAtPeak: false, upDelay: 0, aimX, aimZ });
    list.push({ sideFirst: false, dodge: false, sideAtPeak: true, upDelay: 0, aimX, aimZ });
    list.push({ sideFirst: true, dodge: false, sideAtPeak: false, upDelay: 0, aimX, aimZ });
    list.push({ sideFirst: false, dodge: true, sideAtPeak: true, upDelay: 0, aimX, aimZ });
  }
  return list;
}

export const RECOVERY_PLANS: readonly RecoveryPlan[] = plans();

export interface RecoveryRun {
  readonly match: TestMatch;
  readonly fighter: Fighter;
  readonly capture: KeyboardCapture;
}

/** The fighter at rest in the air beyond the right ledge, facing the stage, its aerial jump unspent. */
export function recoveryRun(character: Character, mana: number, x: number, z: number): RecoveryRun {
  const match = testMatch(3, character);
  match.game.stageChoice = STAGE_CHOICE;
  const fighter = createFighter(character, x, -1);
  match.world.fighters[0] = fighter;
  match.world.fighters[1] = createFighter(Character.demonHunter, -400.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.z = z;
  fighter.jump.remaining = 1;
  fighter.mana.points = mana;
  return { match, fighter, capture: keyboardCapture() };
}

const rows = participantInputs();
const firstRow = assertDefined(rows[0], "row");

/** Plays one frame holding `held`, through the keyboard sampler and the frame executor. */
export function playKeys(run: RecoveryRun, held: number): void {
  const { match, capture } = run;
  assertTrue(sampleKeys(capture, held));
  const frame = match.runtime.simulationFrame + 1;
  copyInput(firstRow, capture.row);
  assertTrue(captureNetworkFrame(match.row, frame, rows, match.world, 3));
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, frame));
  commitEdges(capture);
}

/** Keys held: toward the stage (left, from beyond the right ledge), up, special, jump and shield (an air dodge). */
export const TOWARD = bit(Action.moveLeft);
export const AWAY = bit(Action.moveRight);
export const UP = bit(Action.moveUp);
export const DOWN = bit(Action.moveDown);
export const SPECIAL = bit(Action.special);
const JUMP = bit(Action.jump);
const DODGE = bit(Action.rightTrigger);

export const recovered = (f: Fighter): boolean => f.ledge.state !== LedgeState.none || (f.motion.grounded && !f.status.out);
const busy = (f: Fighter): boolean => f.special.action !== SpecialAction.none || f.dodge.airDodging;

/** Whether a plan brings the fighter back from (x, z): a ledge catch or a landing on the stage. */
export function recovers(character: Character, mana: number, x: number, z: number, plan: Readonly<RecoveryPlan>): boolean {
  const run = recoveryRun(character, mana, x, z);
  const f = run.fighter;
  const lowest = f32(-ledgeCatchBox(character).highest - 30.0);
  // Phases: 0 side first, 1 jump, 2 rising, 3 dodge, 4 side at peak, 5 wait, 6 up special, 7 helpless.
  let phase = plan.sideFirst ? 0 : 1;
  let wait = 0;
  let pressed = false;
  for (let frame = 1; frame <= FRAME_LIMIT; frame++) {
    let held = TOWARD;
    if (phase === 0) {
      if (!pressed) { held = TOWARD | SPECIAL; pressed = true; } else if (!busy(f)) { phase = 1; pressed = false; }
    }
    if (phase === 1) {
      held = TOWARD | JUMP;
      phase = 2;
      wait = 0;
    } else if (phase === 2) {
      wait++;
      if (wait > 2 && f.motion.vz <= 0) phase = plan.dodge ? 3 : plan.sideAtPeak ? 4 : 5;
      if (phase !== 2) { pressed = false; wait = 0; }
    }
    if (phase === 3) {
      if (!pressed) { held = TOWARD | UP | DODGE; pressed = true; } else if (!busy(f)) { phase = plan.sideAtPeak ? 4 : 5; pressed = false; }
    }
    if (phase === 4) {
      if (!pressed) { held = TOWARD | SPECIAL; pressed = true; } else if (!busy(f)) { phase = 5; pressed = false; }
    }
    if (phase === 5) {
      if (wait >= plan.upDelay) { phase = 6; wait = 0; pressed = false; } else wait++;
    }
    if (phase === 6) {
      const aim = (plan.aimX > 0 ? TOWARD : 0) | (plan.aimZ > 0 ? UP : 0);
      if (!pressed) { held = aim | SPECIAL | UP; pressed = true; wait = 0; } else {
        wait++;
        held = wait <= 14 ? aim : TOWARD;
        if (!busy(f) && wait > 1) phase = 7;
      }
    }
    playKeys(run, held);
    if (recovered(f)) return true;
    if (f.status.out) return false;
    if (f.special.fall && f.motion.z < lowest && f.motion.vz <= 0) return false;
    if (phase >= 6 && f.special.action === SpecialAction.none && !f.special.fall && f.jump.remaining === 0 && f.motion.z < lowest && f.motion.vz <= 0) return false;
  }
  return false;
}

/** Whether any plan recovers from (x, z); `hint` is tried first and set to the plan that worked. */
function anyRecovers(character: Character, mana: number, x: number, z: number, hint: { index: number }): boolean {
  const count = RECOVERY_PLANS.length;
  for (let k = 0; k < count; k++) {
    let index = hint.index + k;
    if (index >= count) index -= count;
    if (recovers(character, mana, x, z, assertDefined(RECOVERY_PLANS[index], "plan"))) {
      hint.index = index;
      return true;
    }
  }
  return false;
}

/** The largest value in [0, limit] for which `ok` holds, to RESOLUTION, assuming it holds below that and fails above. */
function search(limit: number, ok: (value: number) => boolean): number {
  if (!ok(0.0)) return 0.0;
  let good = 0.0;
  let bad = limit + RESOLUTION;
  if (ok(limit)) return limit;
  bad = limit;
  while (bad - good > RESOLUTION) {
    const middle = f32(f32(good + bad) * 0.5);
    if (ok(middle)) good = middle; else bad = middle;
  }
  return Math.round(good);
}

export interface RecoveryEnvelope {
  /** Deepest start below the ledge, HEIGHT_PROBE_OUT outside it, that still gets back (world units). */
  readonly height: number;
  /** Farthest start outside the ledge, level with it, that still gets back (world units). */
  readonly reach: number;
}

/** The fighter's recovery envelope with `mana` mana (100 full, 0 empty). */
export function recoveryEnvelope(character: Character, mana: number): RecoveryEnvelope {
  const hint = { index: 0 };
  const height = search(MAX_DEPTH, (depth) => anyRecovers(character, mana, f32(LEDGE_X + HEIGHT_PROBE_OUT), -depth, hint));
  hint.index = 0;
  const reach = search(MAX_REACH, (out) => anyRecovers(character, mana, f32(LEDGE_X + out), -REACH_PROBE_DEPTH, hint));
  return { height, reach };
}

/** The up special's own route (smashcraft:docs/gameplay-design.md, "Up specials"): its highest rise and farthest level reach. */
export interface UpSpecialRoute {
  readonly rise: number;
  readonly reach: number;
}

/** Height a fighter may sink below its start and still count as level with it. */
const LEVEL_TOLERANCE = 10.0;
const ROUTE_X = 700.0;
const ROUTE_Z = 300.0;

/** From (700, 300) facing away from the stage, jumps spent: presses up special, then holds `hold(frame)`. */
function route(character: Character, mana: number, hold: (frame: number) => number): UpSpecialRoute {
  const run = recoveryRun(character, mana, ROUTE_X, ROUTE_Z);
  const f = run.fighter;
  f.facing = 1;
  f.jump.remaining = 0;
  let rise = 0.0;
  let reach = 0.0;
  playKeys(run, UP | SPECIAL);
  for (let frame = 2; frame <= 300 && !f.motion.grounded && !f.status.out; frame++) {
    playKeys(run, hold(frame));
    const height = f32(f.motion.z - ROUTE_Z);
    if (height > rise) rise = height;
    if (height >= -LEVEL_TOLERANCE && f32(f.motion.x - ROUTE_X) > reach) reach = f32(f.motion.x - ROUTE_X);
  }
  return { rise, reach };
}

/** Vertical: up held throughout. Horizontal: the farthest of up-away, away, and away with a glide jump at frame 20. */
export function upSpecialRoute(character: Character, mana: number): UpSpecialRoute {
  const rise = route(character, mana, () => UP).rise;
  let reach = 0.0;
  for (const plan of [() => AWAY | UP, () => AWAY, (frame: number) => frame === 20 ? AWAY | JUMP : AWAY]) {
    const across = route(character, mana, plan).reach;
    if (across > reach) reach = across;
  }
  return { rise: Math.round(rise), reach: Math.round(reach) };
}

/**
 * Recovery archetypes (smashcraft:docs/gameplay-design.md, "Recovery and
 * edgeguarding"), after Melee's: long but linear (Fox, Falco), strong
 * vertical with mixups (Marth, Sheik, Mewtwo), drifting (Peach, Jigglypuff)
 * and heavy and exploitable (Ganondorf, Captain Falcon).
 */
export const RecoveryArchetype = { long: 0, vertical: 1, drifter: 2, heavy: 3 } as const;
export type RecoveryArchetype = (typeof RecoveryArchetype)[keyof typeof RecoveryArchetype];

/** [spec] One archetype's bands, world units: the up special's route at full mana and the whole envelope's floors. */
export interface RecoveryBand {
  readonly name: string;
  readonly riseMin: number;
  readonly riseMax: number;
  readonly reachMin: number;
  readonly reachMax: number;
  readonly heightMin: number;
  readonly envelopeReachMin: number;
}

export const RECOVERY_BANDS: readonly RecoveryBand[] = [
  { name: "long", riseMin: 480.0, riseMax: 640.0, reachMin: 480.0, reachMax: 900.0, heightMin: 780.0, envelopeReachMin: 920.0 },
  { name: "vertical", riseMin: 400.0, riseMax: 560.0, reachMin: 320.0, reachMax: 600.0, heightMin: 700.0, envelopeReachMin: 840.0 },
  { name: "drifter", riseMin: 380.0, riseMax: 520.0, reachMin: 600.0, reachMax: 900.0, heightMin: 680.0, envelopeReachMin: 920.0 },
  { name: "heavy", riseMin: 320.0, riseMax: 440.0, reachMin: 320.0, reachMax: 480.0, heightMin: 620.0, envelopeReachMin: 740.0 },
];
/** [spec] The empty-mana up special's floor on either axis, and the empty-mana envelope's floors. */
export const FREE_ROUTE_MIN = 240.0;
export const FREE_HEIGHT_MIN = 500.0;
export const FREE_REACH_MIN = 640.0;

/** Each fighter's archetype (gameplay-design.md's table). */
export function recoveryArchetype(character: Character): RecoveryArchetype {
  switch (character) {
    case Character.rifleman:
    case Character.blademaster:
    case Character.tinker:
    case Character.kaelthas:
      return RecoveryArchetype.long;
    case Character.warden:
    case Character.lich:
    case Character.shadowHunter:
    case Character.thrall:
    case Character.jaina:
    case Character.chen:
      return RecoveryArchetype.vertical;
    case Character.demonHunter:
    case Character.dreadlord:
    case Character.beastmaster:
    case Character.sylvanas:
      return RecoveryArchetype.drifter;
    default:
      return RecoveryArchetype.heavy;
  }
}
