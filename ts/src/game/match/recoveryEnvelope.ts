




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


const STAGE_CHOICE = 0;
const LEDGE_X = mainDeckRight(0);

export const HEIGHT_PROBE_OUT = 120.0;

export const REACH_PROBE_DEPTH = 150.0;

const MAX_DEPTH = 820.0;
const MAX_REACH = 940.0;

const RESOLUTION = 8.0;
const FRAME_LIMIT = 420;


interface RecoveryPlan {

  readonly sideFirst: boolean;

  readonly dodge: boolean;

  readonly sideAtPeak: boolean;

  readonly upDelay: number;

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


export function playKeys(run: RecoveryRun, held: number): void {
  const { match, capture } = run;
  assertTrue(sampleKeys(capture, held));
  const frame = match.runtime.simulationFrame + 1;
  copyInput(firstRow, capture.row);
  assertTrue(captureNetworkFrame(match.row, frame, rows, match.world, 3));
  assertTrue(executeMatchFrame(match.row, match.game, match.world, match.inputs, match.runtime, frame));
  commitEdges(capture);
}


export const TOWARD = bit(Action.moveLeft);
export const AWAY = bit(Action.moveRight);
export const UP = bit(Action.moveUp);
export const DOWN = bit(Action.moveDown);
export const SPECIAL = bit(Action.special);
const JUMP = bit(Action.jump);
const DODGE = bit(Action.rightTrigger);

export const recovered = (f: Fighter): boolean => f.ledge.state !== LedgeState.none || (f.motion.grounded && !f.status.out);
const busy = (f: Fighter): boolean => f.special.action !== SpecialAction.none || f.dodge.airDodging;


export function recovers(character: Character, mana: number, x: number, z: number, plan: Readonly<RecoveryPlan>): boolean {
  const run = recoveryRun(character, mana, x, z);
  const f = run.fighter;
  const lowest = f32(-ledgeCatchBox(character).highest - 30.0);

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

interface RecoveryEnvelope {

  readonly height: number;

  readonly reach: number;
}


export function recoveryEnvelope(character: Character, mana: number): RecoveryEnvelope {
  const hint = { index: 0 };
  const height = search(MAX_DEPTH, (depth) => anyRecovers(character, mana, f32(LEDGE_X + HEIGHT_PROBE_OUT), -depth, hint));
  hint.index = 0;
  const reach = search(MAX_REACH, (out) => anyRecovers(character, mana, f32(LEDGE_X + out), -REACH_PROBE_DEPTH, hint));
  return { height, reach };
}


interface UpSpecialRoute {
  readonly rise: number;
  readonly reach: number;
}


const LEVEL_TOLERANCE = 10.0;
const ROUTE_X = 700.0;
const ROUTE_Z = 300.0;


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


export function upSpecialRoute(character: Character, mana: number): UpSpecialRoute {
  const rise = route(character, mana, () => UP).rise;
  let reach = 0.0;
  for (const plan of [() => AWAY | UP, () => AWAY, (frame: number) => frame === 20 ? AWAY | JUMP : AWAY]) {
    const across = route(character, mana, plan).reach;
    if (across > reach) reach = across;
  }
  return { rise: Math.round(rise), reach: Math.round(reach) };
}







const RecoveryArchetype = { long: 0, vertical: 1, drifter: 2, heavy: 3 } as const;
type RecoveryArchetype = (typeof RecoveryArchetype)[keyof typeof RecoveryArchetype];


interface RecoveryBand {
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
