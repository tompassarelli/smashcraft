import { floorDiv } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { AttackStyle, Character, GroundAction } from "../sim/codes";
import { attackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { cpuSkill } from "./cpuSkill";
import { useMatchSeed } from "./botRandom";
import { executeBotTechnique, isFrameTight } from "./botTechnicalExecution";
import { createFighter } from "../sim/fighter";
import { createRoster, neutralControls } from "../sim/roster";
import { clearDash } from "../sim/groundMovement";
import { advanceFighterMotion } from "../sim/step";
import { createMatchState, Phase } from "./rules";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { createFrameControls } from "./controls";
import { produceComputerInput } from "./botPlay";
import { clearBotMemory } from "./botPerception";
import type { CpuTier } from "./cpuProfiles";

export interface DashCalibration {
  readonly tier: CpuTier;
  readonly intervals: readonly number[];
  readonly frames: number;
  readonly runs: number;
  readonly technicalInputs: number;
  readonly slips: number;
  readonly wrongOptions: number;
}

/** Repeated opposite-side spacing situations request turns through the production input path. */
export function collectDashCalibration(tier: CpuTier, frames = 120000): DashCalibration {
  const own = createFighter(Character.blademaster, 0.0, 1);
  const target = createFighter(Character.blademaster, 0.0, -1);
  const world = createRoster(3, [own, target]);
  const game = createMatchState();
  game.phase = Phase.match;
  game.cpuResolvedOpponents[0] = "ember";
  game.cpuTiers[0] = tier;
  game.matchSeed = 817;
  const runtime = createPacingAndPresentation();
  const controls = createFrameControls();
  const intervals: number[] = [];
  let previous = 0;
  let chosen = 0;
  let runs = 0;
  let running = false;
  let technicalInputs = 0;
  let slips = 0;
  let wrongOptions = 0;
  for (let frame = 1; frame <= frames; frame++) {
    // Repeat the same legal grounded spacing situation, retaining actual dash/run state.
    own.motion.x = previous > 0 ? 500.0 : -500.0;
    own.motion.z = 0.0;
    own.motion.grounded = true;
    runtime.botAttackDelays[0] = 999.0;
    const outcome = produceComputerInput(game, world, runtime, 0, frame, controls.inputs[0], controls.commands[0]);
    if (outcome !== "none") technicalInputs++;
    if (outcome === "dropped" || outcome === "wrongOption") slips++;
    if (outcome === "wrongOption") wrongOptions++;
    const input = controls.inputs[0];
    if (input.direction !== 0 && input.direction !== previous) {
      if (previous !== 0) intervals.push(frame - chosen);
      clearDash(own);
      running = false;
      previous = input.direction;
      chosen = frame;
    }
    advanceFighterMotion(world, 0, game.stageChoice, frame, input, 0.0);
    const run = own.ground.action === GroundAction.run;
    if (run && !running) runs++;
    running = run;
  }
  clearBotMemory(runtime.botMemory);
  intervals.sort((a, b) => a - b);
  return { tier, intervals, frames, runs, technicalInputs, slips, wrongOptions };
}

export function dashPercentile(row: DashCalibration, tenths: number): number {
  return at(row.intervals, floorDiv((row.intervals.length - 1) * tenths, 10));
}

/** Alternating wavedash air dodges and landing aerials count frame-tight presses and their legal mistakes. */
export function collectTechnicalCalibration(tier: CpuTier, frames = 6000): { inputs: number; slips: number; wrongOptions: number } {
  const own = createFighter(Character.rifleman, 0.0, 1);
  const policy = cpuSkill("wren", tier).decision;
  const input = neutralControls();
  const commands = attackBuffer(0);
  let inputs = 0;
  let slips = 0;
  let wrongOptions = 0;
  useMatchSeed(817);
  for (let frame = 1; frame <= frames; frame++) {
    Object.assign(input, neutralControls());
    clearAttackBuffer(commands);
    own.motion.grounded = frame % 2 === 0;
    if (own.motion.grounded) {
      input.direction = -1;
      input.jumpPressed = true;
      input.airDodgePressed = true;
    } else {
      queueAttack(commands, { style: AttackStyle.forwardTilt, facing: 1, frame, mayCharge: false });
    }
    check(isFrameTight(own, input, commands));
    const outcome = executeBotTechnique(own, input, commands, frame, 0, policy);
    if (outcome !== "none") inputs++;
    if (outcome === "dropped" || outcome === "wrongOption") slips++;
    if (outcome === "wrongOption") wrongOptions++;
  }
  useMatchSeed(0);
  return { inputs, slips, wrongOptions };
}

function check(condition: boolean): void {
  if (!condition) throw new Error("calibration press is not frame-tight");
}
