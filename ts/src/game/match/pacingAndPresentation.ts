import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { type ImpactEvents, createImpactEvents } from "../presentation/impactEvents";
import { clearImpactState, copyImpactStateInto, createImpactState, type ImpactState } from "../presentation/impactState";
import { clearSpecialEffectState, copySpecialEffectStateInto, createSpecialEffectState, type SpecialEffectState } from "../presentation/specialEffectState";
import { clearSummonState, copySummonStateInto, createSummonState, type SummonState } from "../presentation/summonState";
import { clearFighterPose, copyFighterPoseInto, createFighterPose, type FighterPose } from "../presentation/fighterPose";
import type { Roster } from "../sim/roster";
import { type Controls, copyControls, isActive, neutralControls } from "../sim/roster";
import { type BotMemory, clearBotMemory, copyBotMemory, createBotMemory } from "./botPerception";
import { type BotStrategy, createBotStrategy, copyBotStrategy, clearBotStrategy } from "./botStrategy";
import { type AttackBuffer, attackBuffer, copyAttackBuffer } from "../input/attackBuffer";


export interface BotDecision {
  decided: boolean;
  readonly input: Controls;
  readonly commands: AttackBuffer;
}

const createBotDecision = (): BotDecision => ({ decided: false, input: neutralControls(), commands: attackBuffer(0) });






export interface PacingAndPresentation {
  simulationFrame: number;
  botAttackDelays: Slots<number>;
  readonly botMemory: BotMemory;
  readonly botStrategies: Slots<BotStrategy>;

  readonly botDecisions: Slots<BotDecision>;
  impacts: ImpactState;
  specials: SpecialEffectState;
  summons: SummonState;

  frameImpacts: Slots<ImpactEvents>;
  poses: Slots<FighterPose>;

  readonly observedLegal: Slots<number>;
  readonly observedStarted: Slots<number>;
}

export function createPacingAndPresentation(): PacingAndPresentation {
  return {
    simulationFrame: 0,
    botAttackDelays: [0.0, 0.0, 0.0, 0.0],
    botMemory: createBotMemory(),
    botStrategies: [createBotStrategy(), createBotStrategy(), createBotStrategy(), createBotStrategy()],
    botDecisions: [createBotDecision(), createBotDecision(), createBotDecision(), createBotDecision()],
    impacts: createImpactState(),
    specials: createSpecialEffectState(),
    summons: createSummonState(),
    frameImpacts: [createImpactEvents(), createImpactEvents(), createImpactEvents(), createImpactEvents()],
    poses: [createFighterPose(), createFighterPose(), createFighterPose(), createFighterPose()],
    observedLegal: [0, 0, 0, 0],
    observedStarted: [0, 0, 0, 0],
  };
}


export function clearPresentationHistory(runtime: PacingAndPresentation): void {
  clearImpactState(runtime.impacts);
  clearSpecialEffectState(runtime.specials);
  clearSummonState(runtime.summons);
  for (const slot of PARTICIPANT_SLOTS) clearFighterPose(runtime.poses[slot]);
}

/** Copies between worlds: poses of the source world's participants, with their slot references, apart from `keptPoses`, which the target already holds. */
export function copyPacingAndPresentation(target: PacingAndPresentation, source: Readonly<PacingAndPresentation>, sourceWorld: Readonly<Roster>, keptPoses = 0): void {
  target.simulationFrame = source.simulationFrame;
  copyBotMemory(target.botMemory, source.botMemory);
  copyImpactStateInto(target.impacts, source.impacts);
  copySpecialEffectStateInto(target.specials, source.specials);
  copySummonStateInto(target.summons, source.summons);
  for (const slot of PARTICIPANT_SLOTS) {
    target.botAttackDelays[slot] = source.botAttackDelays[slot];
    copyBotStrategy(target.botStrategies[slot], source.botStrategies[slot]);
    const decision = source.botDecisions[slot];
    target.botDecisions[slot].decided = decision.decided;
    if (decision.decided) copyBotDecision(target.botDecisions[slot], decision);
    target.observedLegal[slot] = source.observedLegal[slot];
    target.observedStarted[slot] = source.observedStarted[slot];
    if (isActive(sourceWorld, slot) && (keptPoses & (1 << slot)) === 0) copyFighterPoseInto(target.poses[slot], source.poses[slot], sourceWorld);
  }
}

function copyBotDecision(target: BotDecision, source: Readonly<BotDecision>): void {
  copyControls(target.input, source.input);
  copyAttackBuffer(target.commands, source.commands);
}






export function resetPacingAndPresentation(runtime: PacingAndPresentation): void {
  runtime.simulationFrame = 0;
  clearPresentationHistory(runtime);
  runtime.botAttackDelays.fill(0.0);
  clearBotMemory(runtime.botMemory);
  for (const strategy of runtime.botStrategies) clearBotStrategy(strategy);
  for (const decision of runtime.botDecisions) decision.decided = false;
  runtime.observedLegal.fill(0);
  runtime.observedStarted.fill(0);
}
