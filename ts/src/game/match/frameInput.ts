import { copyAttackBuffer, queueAttack, sameAttackBuffer } from "../input/attackBuffer";
import { adaptInput } from "../input/adapter";
import { type InputRow, copyInput, sameInput } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type ParticipantInputs, type ParticipantSlot, type Slots, isParticipantMask, isParticipantSlot, participantActive, participantInputs } from "../input/participants";
import { captureImpactEventsBefore, finishImpactEventsAfter } from "../presentation/impactEvents";
import { advanceImpacts, clearImpactState, emitImpacts } from "../presentation/impactState";
import { advanceSpecialEffect, clearSpecialEffectState } from "../presentation/specialEffectState";
import { advanceSummons, clearSummonState } from "../presentation/summonState";
import { advanceFighterPose, copyFighterPoseInto } from "../presentation/fighterPose";
import { copySummonPoseInto } from "../presentation/summonPose";
import { type Roster, copyControls, fighterAt, isActive, sameControls } from "../sim/roster";
import { type FrameControls, createFrameControls } from "./controls";
import type { PacingAndPresentation } from "./pacingAndPresentation";
import { type MatchState, Phase, computerActive } from "./rules";
import { produceComputerInput, repeatComputerInput } from "./botPlay";
import { type StepScope, observedFrameLegalActions, observedFrameStartedActions, stepMatch } from "./step";
import { latchPresses, releasePresses } from "./training";
import { type ReplayState, copyReplayState } from "../replay/snapshot";
import { type BotMemory, clearBotMemory, copyBotMemory, createBotMemory, firstBotMemoryDifference } from "./botPerception";
import { type BotStrategy, copyBotStrategy, createBotStrategy, botStrategyValues } from "./botStrategy";


export interface MatchFrameInput {
  frame: number | undefined;
  mask: number;
  networkMask: number;
  source: "network" | "adapted";
  readonly values: FrameControls;
  readonly network: ParticipantInputs;
  readonly botDelaysAfterInput: Slots<number>;
  readonly botMemoryAfterInput: BotMemory;
  readonly botStrategiesAfterInput: Slots<BotStrategy>;
  readonly scratch: FrameControls;
}

export function createMatchFrameInput(): MatchFrameInput {
  return {
    frame: undefined, mask: 0, networkMask: 0, source: "adapted",
    values: createFrameControls(), network: participantInputs(), botDelaysAfterInput: [0.0, 0.0, 0.0, 0.0], scratch: createFrameControls(),
    botMemoryAfterInput: createBotMemory(),
    botStrategiesAfterInput: [createBotStrategy(), createBotStrategy(), createBotStrategy(), createBotStrategy()],
  };
}

export function resetMatchFrameInput(row: MatchFrameInput): void {
  row.frame = undefined;
  row.mask = 0;
  row.source = "adapted";
}

export function captureFrame(row: MatchFrameInput, frame: number, mask: number, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): boolean {
  if (frame < 0 || row.frame === frame || !isParticipantMask(mask)) return false;
  row.frame = frame;
  row.mask = mask;
  copyBotMemory(row.botMemoryAfterInput, runtime.botMemory);
  for (const slot of PARTICIPANT_SLOTS) {
    copyBotStrategy(row.botStrategiesAfterInput[slot], runtime.botStrategies[slot]);
    if (participantActive(mask, slot)) {
      copyControls(row.values.inputs[slot], controls.inputs[slot]);
      copyAttackBuffer(row.values.commands[slot], controls.commands[slot]);
    }
    row.botDelaysAfterInput[slot] = runtime.botAttackDelays[slot];
  }
  row.source = "adapted";
  row.networkMask = 0;
  return true;
}

export function captureNetworkFrame(row: MatchFrameInput, frame: number, source: ParticipantInputs, world: Roster, senderMask: number): boolean {
  if (frame < 0 || row.frame === frame || !isParticipantMask(world.mask) || !isParticipantMask(senderMask)) return false;
  row.frame = frame;
  row.mask = world.mask;
  row.networkMask = senderMask;
  for (const slot of PARTICIPANT_SLOTS) if (participantActive(senderMask, slot)) copyInput(row.network[slot], source[slot]);
  row.source = "network";
  return true;
}

export const hasNetworkRows = (row: Readonly<MatchFrameInput>): boolean => row.source === "network";

export function copyNetworkRow(row: Readonly<MatchFrameInput>, slot: number, target: InputRow): boolean {
  if (row.source !== "network" || !isParticipantSlot(slot) || !participantActive(row.networkMask, slot)) return false;
  copyInput(target, row.network[slot]);
  return true;
}

export function networkRowsMatch(row: Readonly<MatchFrameInput>, source: ParticipantInputs): boolean {
  if (row.source !== "network") return false;
  return PARTICIPANT_SLOTS.every(slot => !participantActive(row.networkMask, slot) || sameInput(row.network[slot], source[slot]));
}

export function replaceNetworkRows(row: MatchFrameInput, source: ParticipantInputs): boolean {
  if (row.source !== "network") return false;
  for (const slot of PARTICIPANT_SLOTS) if (participantActive(row.networkMask, slot)) copyInput(row.network[slot], source[slot]);
  return true;
}


export function copyMatchFrameInput(target: MatchFrameInput, source: Readonly<MatchFrameInput>): void {
  target.frame = source.frame;
  target.mask = source.mask;
  target.networkMask = source.networkMask;
  target.source = source.source;
  const adapted = source.source !== "network";

  if (adapted) copyBotMemory(target.botMemoryAfterInput, source.botMemoryAfterInput);
  else if (target.botMemoryAfterInput.history.length > 0) clearBotMemory(target.botMemoryAfterInput);

  const mask = source.mask > 0 && source.mask < 16 ? source.mask : 0;
  const networkMask = source.networkMask > 0 && source.networkMask < 16 ? source.networkMask : 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (adapted) copyBotStrategy(target.botStrategiesAfterInput[slot], source.botStrategiesAfterInput[slot]);
    if (adapted && (mask & (1 << slot)) !== 0) {
      copyControls(target.values.inputs[slot], source.values.inputs[slot]);
      copyAttackBuffer(target.values.commands[slot], source.values.commands[slot]);
    }
    if ((networkMask & (1 << slot)) !== 0) copyInput(target.network[slot], source.network[slot]);
    target.botDelaysAfterInput[slot] = source.botDelaysAfterInput[slot];
  }
}

export function sameMatchFrameInput(a: Readonly<MatchFrameInput>, b: Readonly<MatchFrameInput>): boolean {
  if (a.frame !== b.frame || a.mask !== b.mask || a.networkMask !== b.networkMask || a.source !== b.source) return false;
  if (a.source !== "network" && firstBotMemoryDifference(a.botMemoryAfterInput, b.botMemoryAfterInput) !== undefined) return false;
  if (a.source !== "network" && PARTICIPANT_SLOTS.some(slot => botStrategyValues(a.botStrategiesAfterInput[slot]).join(",") !== botStrategyValues(b.botStrategiesAfterInput[slot]).join(","))) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (a.source === "network") {
      if (participantActive(a.networkMask, slot) && !sameInput(a.network[slot], b.network[slot])) return false;
    } else if (participantActive(a.mask, slot)) {
      if (a.botDelaysAfterInput[slot] !== b.botDelaysAfterInput[slot] || !sameControls(a.values.inputs[slot], b.values.inputs[slot]) || !sameAttackBuffer(a.values.commands[slot], b.values.commands[slot])) return false;
    }
  }
  return true;
}


const beforeOut: Slots<boolean> = [false, false, false, false];
const beforeJump: Slots<number> = [0, 0, 0, 0];
const beforeAttack: Slots<number> = [0, 0, 0, 0];
const beforeDamage: Slots<number> = [0.0, 0.0, 0.0, 0.0];
const beforeShield: Slots<number> = [0.0, 0.0, 0.0, 0.0];






export interface RepeatedComputers {
  readonly mask: number;
  readonly after: Readonly<PacingAndPresentation>;
}


function prepareMatchFrame(row: MatchFrameInput, game: MatchState, world: Roster, controls: FrameControls, runtime: PacingAndPresentation, frame: number, repeated: RepeatedComputers | undefined): boolean {
  if (row.frame !== frame || frame !== runtime.simulationFrame + 1 || row.mask !== world.mask) return false;
  if (row.source !== "network") copyBotMemory(runtime.botMemory, row.botMemoryAfterInput);
  if (row.source !== "network") for (const slot of PARTICIPANT_SLOTS) copyBotStrategy(runtime.botStrategies[slot], row.botStrategiesAfterInput[slot]);
  for (const slot of PARTICIPANT_SLOTS) {
    const decision = runtime.botDecisions[slot];
    decision.decided = false;
    if (!isActive(world, slot)) continue;
    if (row.source === "network") {
      if (computerActive(game, slot)) {
        const input = row.values.inputs[slot];
        const commands = row.values.commands[slot];
        if (repeated !== undefined && participantActive(repeated.mask, slot)) repeatComputerInput(world, runtime, repeated.after, repeated.after.botDecisions[slot], slot, frame, input, commands);
        else produceComputerInput(game, world, runtime, slot, frame, input, commands);
        decision.decided = true;
        copyControls(decision.input, input);
        copyAttackBuffer(decision.commands, commands);
      } else adaptInput(row.network[slot], fighterAt(world, slot), frame, row.values.inputs[slot], row.values.commands[slot]);
    } else runtime.botAttackDelays[slot] = row.botDelaysAfterInput[slot];
    copyControls(row.scratch.inputs[slot], row.values.inputs[slot]);
    row.scratch.commands[slot] = controls.commands[slot];
    const request = row.values.commands[slot].pending;
    if (request !== undefined) queueAttack(controls.commands[slot], request);
    const f = fighterAt(world, slot);
    captureImpactEventsBefore(runtime.frameImpacts[slot], f);
    beforeOut[slot] = f.status.out;
    beforeJump[slot] = f.jump.serial;
    beforeAttack[slot] = f.attack.serial;
    beforeDamage[slot] = f.status.damage;
    beforeShield[slot] = f.shield.energy;
  }
  return true;
}

/**
 * A scoped step's other fighters end as `after` holds them, with the
 * observations that run made. Those in `reused` began the frame with that
 * run's poses, special effects and summons, so they take its results too.
 */
export interface ScopedFrame extends StepScope {
  after: Readonly<ReplayState>;
  reused: number;
}

function reusePresentation(runtime: PacingAndPresentation, after: Readonly<ReplayState>, slot: ParticipantSlot): void {
  const was = after.runtime;
  runtime.specials.drainSerial[slot] = was.specials.drainSerial[slot];
  runtime.specials.drainAge[slot] = was.specials.drainAge[slot];
  copySummonPoseInto(runtime.summons.bears[slot], was.summons.bears[slot]);
  runtime.summons.bearHitSerial[slot] = was.summons.bearHitSerial[slot];
  copyFighterPoseInto(runtime.poses[slot], was.poses[slot], after.world);
}

export function executeMatchFrame(row: MatchFrameInput, game: MatchState, world: Roster, controls: FrameControls, runtime: PacingAndPresentation, frame: number, repeated?: RepeatedComputers, scope?: Readonly<ScopedFrame>): boolean {
  if (!prepareMatchFrame(row, game, world, controls, runtime, frame, repeated)) return false;
  if (game.phase === Phase.match && game.training) {

    const trainer = game.trainer;
    const skip = trainer.speedPhase + 1 < trainer.speed;
    trainer.speedPhase = skip ? trainer.speedPhase + 1 : 0;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      if (skip) latchPresses(trainer.latches[slot], row.scratch.inputs[slot]);
      else releasePresses(trainer.latches[slot], row.scratch.inputs[slot]);
    }
    if (skip) {
      runtime.simulationFrame = frame;
      return true;
    }
  }
  advanceImpacts(runtime.impacts);
  stepMatch(game, world, row.scratch, frame, scope);
  for (const slot of PARTICIPANT_SLOTS) {
    if (scope !== undefined && slot !== scope.slot) {
      observedFrameLegalActions[slot] = scope.after.runtime.observedLegal[slot];
      observedFrameStartedActions[slot] = scope.after.runtime.observedStarted[slot];
    }
    runtime.observedLegal[slot] = observedFrameLegalActions[slot];
    runtime.observedStarted[slot] = observedFrameStartedActions[slot];
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) { advanceSummons(runtime.summons, undefined, slot); continue; }
    const f = fighterAt(world, slot);
    finishImpactEventsAfter(runtime.frameImpacts[slot], f, world);
    if (scope !== undefined && slot !== scope.slot && participantActive(scope.reused, slot)) {
      emitImpacts(runtime.impacts, runtime.frameImpacts[slot], frame);
      reusePresentation(runtime, scope.after, slot);
      continue;
    }
    if (game.phase === Phase.match) {
      emitImpacts(runtime.impacts, runtime.frameImpacts[slot], frame);
      advanceSpecialEffect(runtime.specials, f, slot);
      advanceSummons(runtime.summons, f, slot);
    }
    const hit = !beforeOut[slot] && !f.status.out && (f.status.damage > beforeDamage[slot] || (f.shield.stun > 0 && f.shield.energy < beforeShield[slot]));
    advanceFighterPose(runtime.poses[slot], f, world, row.scratch.inputs[slot], beforeOut[slot], f.jump.serial !== beforeJump[slot], f.attack.serial !== beforeAttack[slot], hit);
  }
  if (game.phase !== Phase.match) {
    clearImpactState(runtime.impacts);
    clearSpecialEffectState(runtime.specials);
    clearSummonState(runtime.summons);
  }
  runtime.simulationFrame = frame;
  return true;
}








export function restoreMatchFrame(row: MatchFrameInput, game: MatchState, world: Roster, controls: FrameControls, runtime: PacingAndPresentation, frame: number, after: Readonly<ReplayState>): boolean {
  if (game.training) return executeMatchFrame(row, game, world, controls, runtime, frame);
  if (row.frame !== frame || frame !== runtime.simulationFrame + 1 || row.mask !== world.mask || after.runtime.simulationFrame !== frame) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(world, slot)) captureImpactEventsBefore(runtime.frameImpacts[slot], fighterAt(world, slot));
  }
  copyReplayState({ world, match: game, controls, runtime }, after);
  for (const slot of PARTICIPANT_SLOTS) {

    observedFrameLegalActions[slot] = runtime.observedLegal[slot];
    observedFrameStartedActions[slot] = runtime.observedStarted[slot];
    if (isActive(world, slot)) finishImpactEventsAfter(runtime.frameImpacts[slot], fighterAt(world, slot), world);
  }
  return runtime.simulationFrame === frame;
}


export function borrowMatchFrame(row: MatchFrameInput, world: Roster, runtime: PacingAndPresentation, frame: number, after: Readonly<ReplayState>): boolean {
  if (row.frame !== frame || frame !== runtime.simulationFrame + 1 || row.mask !== world.mask || after.runtime.simulationFrame !== frame) return false;
  const scratch = runtime.frameImpacts;
  runtime.frameImpacts = after.runtime.frameImpacts;
  after.runtime.frameImpacts = scratch;
  for (const slot of PARTICIPANT_SLOTS) {
    observedFrameLegalActions[slot] = after.runtime.observedLegal[slot];
    observedFrameStartedActions[slot] = after.runtime.observedStarted[slot];
    if (!isActive(world, slot)) continue;
    const events = after.runtime.frameImpacts[slot];
    captureImpactEventsBefore(events, fighterAt(world, slot));
    finishImpactEventsAfter(events, fighterAt(after.world, slot), after.world);
  }
  return true;
}
