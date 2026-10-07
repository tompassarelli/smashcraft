import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { type ImpactEvents, createImpactEvents } from "../presentation/impactEvents";
import { clearImpactState, copyImpactStateInto, createImpactState, type ImpactState } from "../presentation/impactState";
import { clearSpecialEffectState, copySpecialEffectStateInto, createSpecialEffectState, type SpecialEffectState } from "../presentation/specialEffectState";
import { clearSummonState, copySummonStateInto, createSummonState, type SummonState } from "../presentation/summonState";
import { clearFighterPose, copyFighterPoseInto, createFighterPose, type FighterPose } from "../presentation/fighterPose";
import type { Roster } from "../sim/roster";
import { isActive } from "../sim/roster";
import { type BotMemory, clearBotMemory, copyBotMemory, createBotMemory } from "./botPerception";

/**
 * What a match carries beside its world, game rules and controls: the frame pacing
 * (simulationFrame, botAttackDelays, botMemory) and the presentation history (impacts, special
 * effects, summons, poses). Only the pacing feeds the simulation.
 */
export interface PacingAndPresentation {
  simulationFrame: number;
  botAttackDelays: Slots<number>;
  readonly botMemory: BotMemory;
  impacts: ImpactState;
  specials: SpecialEffectState;
  summons: SummonState;
  /** Scratch, overwritten before every step: no state crosses frames. */
  frameImpacts: Slots<ImpactEvents>;
  poses: Slots<FighterPose>;
  /** The step that reached this state: each fighter's legal and started actions (observedFrameLegalActions, observedFrameStartedActions). */
  readonly observedLegal: Slots<number>;
  readonly observedStarted: Slots<number>;
}

export function createPacingAndPresentation(): PacingAndPresentation {
  return {
    simulationFrame: 0,
    botAttackDelays: [0.0, 0.0, 0.0, 0.0],
    botMemory: createBotMemory(),
    impacts: createImpactState(),
    specials: createSpecialEffectState(),
    summons: createSummonState(),
    frameImpacts: [createImpactEvents(), createImpactEvents(), createImpactEvents(), createImpactEvents()],
    poses: [createFighterPose(), createFighterPose(), createFighterPose(), createFighterPose()],
    observedLegal: [0, 0, 0, 0],
    observedStarted: [0, 0, 0, 0],
  };
}

/** Clears the impact, special-effect, summon and pose history; the pacing and the per-frame scratch stay. */
export function clearPresentationHistory(runtime: PacingAndPresentation): void {
  clearImpactState(runtime.impacts);
  clearSpecialEffectState(runtime.specials);
  clearSummonState(runtime.summons);
  for (const slot of PARTICIPANT_SLOTS) clearFighterPose(runtime.poses[slot]);
}

/** Copies between worlds: poses of the source world's participants, with their slot references. */
export function copyPacingAndPresentation(target: PacingAndPresentation, source: Readonly<PacingAndPresentation>, sourceWorld: Readonly<Roster>): void {
  target.simulationFrame = source.simulationFrame;
  copyBotMemory(target.botMemory, source.botMemory);
  copyImpactStateInto(target.impacts, source.impacts);
  copySpecialEffectStateInto(target.specials, source.specials);
  copySummonStateInto(target.summons, source.summons);
  for (const slot of PARTICIPANT_SLOTS) {
    target.botAttackDelays[slot] = source.botAttackDelays[slot];
    target.observedLegal[slot] = source.observedLegal[slot];
    target.observedStarted[slot] = source.observedStarted[slot];
    if (isActive(sourceWorld, slot)) copyFighterPoseInto(target.poses[slot], source.poses[slot], sourceWorld);
  }
}

/**
 * As createPacingAndPresentation leaves it, for every slot: copies keep the
 * per-slot observations of slots a match doesn't play, so a slot an earlier
 * match used would otherwise stay in later matches' state (`-dev reset`).
 */
export function resetPacingAndPresentation(runtime: PacingAndPresentation): void {
  runtime.simulationFrame = 0;
  clearPresentationHistory(runtime);
  runtime.botAttackDelays.fill(0.0);
  clearBotMemory(runtime.botMemory);
  runtime.observedLegal.fill(0);
  runtime.observedStarted.fill(0);
}
