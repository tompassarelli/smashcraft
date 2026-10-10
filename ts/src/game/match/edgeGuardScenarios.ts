import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { type AttackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, LedgeState, SpecialAction } from "../sim/codes";
import { canAttack, isIntangible } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { type Controls, createRoster, neutralControls, copyControls } from "../sim/roster";
import { mainDeckRight } from "../sim/stage";
import { squareRoot } from "../sim/warcraftMath";
import { produceComputerInput } from "./botPlay";
import { forwardAirTool } from "./botEdgeGuard";
import { createFrameControls } from "./controls";
import type { CpuOpponentId, CpuTier } from "./cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createMatchState, Phase } from "./rules";

const STAGE = 0;
export const LEDGE_X = mainDeckRight(STAGE);
export const START_OUT = 200.0;
export const START_DEPTH = 100.0;
export const GIMP_DAMAGE = 40.0;
export const PREDICTABLE_WAIT = 12;
const FRAME_LIMIT = 420;
const AIM_HOLD = 16;
const GUARD_START = 30.0;
const GUARD_LEAD = 30;

export const EdgeGuardTool = { downAir: 0, forwardAir: 1 } as const;
export type EdgeGuardTool = (typeof EdgeGuardTool)[keyof typeof EdgeGuardTool];

export function edgeGuardTool(character: Character): EdgeGuardTool {
  return forwardAirTool(character) ? EdgeGuardTool.forwardAir : EdgeGuardTool.downAir;
}

export interface EdgeGuardScenario {
  readonly guarder: Character;
  readonly out: number;
  readonly z: number;
  readonly press: number;
}

export interface RecoveryPlan {
  readonly wait: number;
  readonly aimX: number;
  readonly aimZ: number;
  readonly drift: number;
}

export const PREDICTABLE: RecoveryPlan = { wait: PREDICTABLE_WAIT, aimX: -1, aimZ: 1, drift: -1 };

export interface Outcome {
  readonly killed: boolean;
  readonly recovered: boolean;
  readonly hitFrame: number;
  readonly spiked: boolean;
}

type Guard = (input: Controls, commands: AttackBuffer, frame: number) => void;

interface Duel {
  readonly victim: Fighter;
  readonly guarder: Fighter;
  readonly step: (victimInput: Controls, guard: Guard) => number;
}

function duel(victim: Character, guarder: Character, guardX: number, guardZ: number, seed: number, cpu?: { readonly opponent: CpuOpponentId; readonly tier: CpuTier }): Duel {
  const v = createFighter(victim, f32(LEDGE_X + START_OUT), -1);
  const g = createFighter(guarder, guardX, 1);
  v.motion.grounded = false;
  v.motion.surface = undefined;
  v.motion.z = -START_DEPTH;
  v.jump.remaining = 0;
  v.status.damage = GIMP_DAMAGE;
  v.mana.points = 100;
  if (cpu === undefined) {
    g.motion.grounded = false;
    g.motion.surface = undefined;
    g.motion.z = guardZ;
  }
  const match = createMatchState();
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  match.stageChoice = STAGE;
  match.matchSeed = seed;
  if (cpu !== undefined) {
    match.cpuOpponents[1] = cpu.opponent;
    match.cpuResolvedOpponents[1] = cpu.opponent;
    match.cpuTiers[1] = cpu.tier;
  }
  const world = createRoster(3, [v, g]);
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const produced = createFrameControls();
  const row = createMatchFrameInput();
  return {
    victim: v, guarder: g,
    step: (victimInput, guard) => {
      const frame = runtime.simulationFrame + 1;
      copyControls(produced.inputs[0], victimInput);
      clearAttackBuffer(produced.commands[0]);
      if (cpu !== undefined) produceComputerInput(match, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
      else {
        copyControls(produced.inputs[1], neutralControls());
        clearAttackBuffer(produced.commands[1]);
        guard(produced.inputs[1], produced.commands[1], frame);
      }
      if (!captureFrame(row, frame, world.mask, produced, runtime) || !executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error("edge-guard frame rejected");
      return frame;
    },
  };
}

function recoveryInput(v: Readonly<Fighter>, plan: Readonly<RecoveryPlan>, frame: number, into: Controls): void {
  copyControls(into, neutralControls());
  if (frame < plan.wait) {
    into.direction = plan.drift;
    return;
  }
  const aiming = frame < plan.wait + AIM_HOLD;
  into.direction = aiming ? plan.aimX : -1;
  into.verticalDirection = aiming ? plan.aimZ : 1;
  const acting = v.special.action === SpecialAction.none && !v.special.fall && v.launch.hitstun <= 0;
  if (frame === plan.wait || (acting && floorMod(frame, 2) === 0)) {
    into.specialPressed = true;
    into.specialX = 0;
    into.specialZ = 1;
  }
}

function settle(d: Duel, plan: Readonly<RecoveryPlan>, guard: Guard, minHit: number, lead = 0): Outcome {
  const v = d.victim;
  const stocks = v.status.stocks;
  const input = neutralControls();
  const x = v.motion.x;
  const z = v.motion.z;
  for (let n = 1; n <= lead; n++) {
    d.step(input, guard);
    v.motion.x = x;
    v.motion.z = z;
    v.motion.vx = 0.0;
    v.motion.vz = 0.0;
  }
  let hitFrame = -1;
  let spiked = false;
  for (let n = 1; n <= FRAME_LIMIT; n++) {
    recoveryInput(v, plan, n, input);
    d.step(input, guard);
    if (hitFrame < 0 && v.launch.hitstun > 0) {
      if (n < minHit) return { killed: false, recovered: false, hitFrame: n, spiked: false };
      hitFrame = n;
      spiked = v.motion.vz < 0.0;
    }
    if (v.status.out || v.status.stocks < stocks) return { killed: true, recovered: false, hitFrame, spiked };
    if (v.ledge.state !== LedgeState.none || (v.motion.grounded && v.motion.x <= LEDGE_X)) return { killed: false, recovered: true, hitFrame, spiked };
  }
  return { killed: false, recovered: false, hitFrame, spiked };
}

function pressTool(guarder: Fighter, frame: number, press: number, commands: AttackBuffer): void {
  if (frame !== press) return;
  const forward = edgeGuardTool(guarder.character) === EdgeGuardTool.forwardAir;
  queueAttack(commands, { style: forward ? AttackStyle.forwardTilt : AttackStyle.downTilt, facing: 1, frame, mayCharge: false });
}

export function playScenario(victim: Character, scenario: Readonly<EdgeGuardScenario>, guarded: boolean): Outcome {
  const d = duel(victim, scenario.guarder, f32(LEDGE_X + scenario.out), scenario.z, 0);
  return settle(d, PREDICTABLE, (_input, commands, frame) => { if (guarded) pressTool(d.guarder, frame, scenario.press, commands); }, PREDICTABLE_WAIT);
}

export const MIXED_PLANS: readonly RecoveryPlan[] = [
  { wait: 2, aimX: -1, aimZ: 1, drift: -1 },
  { wait: 8, aimX: -1, aimZ: 1, drift: 1 },
  { wait: 14, aimX: -1, aimZ: 1, drift: 0 },
  { wait: 2, aimX: -1, aimZ: 1, drift: 1 },
  { wait: 8, aimX: -1, aimZ: 1, drift: -1 },
  { wait: 14, aimX: -1, aimZ: 1, drift: 1 },
  { wait: 2, aimX: -1, aimZ: 1, drift: 0 },
  { wait: 8, aimX: -1, aimZ: 1, drift: 0 },
];

export function mixedPlan(seed: number): RecoveryPlan {
  return at(MIXED_PLANS, floorMod(seed, MIXED_PLANS.length));
}

export function guardedReturn(victim: Character, guarder: Character, seed: number, tier: CpuTier, plan: Readonly<RecoveryPlan> = mixedPlan(seed)): Outcome {
  const d = duel(victim, guarder, f32(LEDGE_X - GUARD_START), 0.0, seed, { opponent: "wren", tier });
  return settle(d, plan, () => undefined, 0, GUARD_LEAD);
}

export interface RecoveryProfile {
  readonly startup: number;
  readonly intangible: number;
  readonly speed: number;
  readonly opening: number;
  readonly exposed: number;
  readonly landingLag: number;
  readonly endsAt: "ledge" | "deck" | "none";
}

export function recoveryProfile(character: Character, plan: Readonly<RecoveryPlan> = PREDICTABLE): RecoveryProfile {
  const d = duel(character, Character.rifleman, f32(LEDGE_X - 900.0), 0.0, 0, undefined);
  const v = d.victim;
  const input = neutralControls();
  let startup = -1;
  let intangible = 0;
  let speed = 0.0;
  let opening = 0;
  let run = 0;
  let exposed = 0;
  let landingLag = 0;
  let endsAt: RecoveryProfile["endsAt"] = "none";
  let x = v.motion.x;
  let z = v.motion.z;
  for (let n = 1; n <= FRAME_LIMIT; n++) {
    if (endsAt === "none") recoveryInput(v, plan, n, input);
    else copyControls(input, neutralControls());
    d.step(input, () => undefined);
    const moved = f32(squareRoot(f32(f32(f32(v.motion.x - x) * f32(v.motion.x - x)) + f32(f32(v.motion.z - z) * f32(v.motion.z - z)))));
    const rose = f32(v.motion.z - z);
    x = v.motion.x;
    z = v.motion.z;
    if (n < plan.wait) continue;
    if (startup < 0 && rose > 4.0) startup = n - plan.wait;
    if (endsAt === "none" && moved > speed) speed = moved;
    if (isIntangible(v)) {
      if (endsAt === "none") intangible++;
      run = 0;
    } else {
      if (endsAt === "none") exposed++;
      run++;
      if (run > opening) opening = run;
    }
    if (endsAt === "none" && v.ledge.state !== LedgeState.none) {
      endsAt = "ledge";
      break;
    }
    if (endsAt === "none" && v.motion.grounded) endsAt = "deck";
    if (endsAt === "deck") {
      if (canAttack(v)) break;
      landingLag++;
    }
  }
  return { startup, intangible, speed: Math.round(speed), opening, exposed, landingLag, endsAt };
}

export function unguarded(victim: Character, plan: Readonly<RecoveryPlan>): Outcome {
  const d = duel(victim, Character.rifleman, f32(LEDGE_X - 900.0), 0.0, 0, undefined);
  return settle(d, plan, () => undefined, 0);
}

export const EDGE_GUARD_SCENARIOS: Readonly<Record<number, EdgeGuardScenario>> = {
  [Character.rifleman]: { guarder: Character.rifleman, out: 162.0, z: -53.0, press: 6 },
  [Character.demonHunter]: { guarder: Character.demonHunter, out: 165.0, z: -20.0, press: 6 },
  [Character.blademaster]: { guarder: Character.blademaster, out: 163.0, z: -68.0, press: 6 },
  [Character.mountainKing]: { guarder: Character.mountainKing, out: 164.0, z: -68.0, press: 3 },
  [Character.warden]: { guarder: Character.warden, out: 163.0, z: -68.0, press: 9 },
  [Character.lich]: { guarder: Character.lich, out: 97.0, z: -84.0, press: 6 },
  [Character.forsakenPaladin]: { guarder: Character.forsakenPaladin, out: 98.0, z: -84.0, press: 6 },
  [Character.dreadlord]: { guarder: Character.dreadlord, out: 96.0, z: -84.0, press: 6 },
  [Character.shadowHunter]: { guarder: Character.shadowHunter, out: 163.0, z: -68.0, press: 6 },
  [Character.pitLord]: { guarder: Character.pitLord, out: 160.0, z: -134.0, press: 3 },
  [Character.beastmaster]: { guarder: Character.beastmaster, out: 98.0, z: -134.0, press: 6 },
  [Character.lichKing]: { guarder: Character.lichKing, out: 148.0, z: -118.0, press: 1 },
  [Character.thrall]: { guarder: Character.thrall, out: 165.0, z: -68.0, press: 3 },
  [Character.jaina]: { guarder: Character.jaina, out: 163.0, z: -68.0, press: 6 },
  [Character.sylvanas]: { guarder: Character.sylvanas, out: 163.0, z: -68.0, press: 3 },
  [Character.cairne]: { guarder: Character.cairne, out: -7.0, z: 22.0, press: 19 },
  [Character.chen]: { guarder: Character.chen, out: 163.0, z: -68.0, press: 3 },
  [Character.peon]: { guarder: Character.peon, out: 97.0, z: -84.0, press: 6 },
  [Character.tinker]: { guarder: Character.tinker, out: 163.0, z: -68.0, press: 1 },
  [Character.kaelthas]: { guarder: Character.kaelthas, out: 163.0, z: -68.0, press: 3 },
  [Character.murloc]: { guarder: Character.murloc, out: 163.0, z: -68.0, press: 3 },
  [Character.grom]: { guarder: Character.grom, out: 163.0, z: -68.0, press: 1 },
  [Character.kobold]: { guarder: Character.kobold, out: 163.0, z: -68.0, press: 3 },
  [Character.malfurion]: { guarder: Character.malfurion, out: 97.0, z: -84.0, press: 6 },
  [Character.medivh]: { guarder: Character.medivh, out: 163.0, z: -68.0, press: 3 },
  [Character.anubarak]: { guarder: Character.anubarak, out: 165.0, z: -68.0, press: 6 },
};

export const OPENING_MIN = 15;
