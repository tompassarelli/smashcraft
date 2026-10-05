import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { type ImpactEvents, createImpactEvents } from "../presentation/impactEvents";
import { clearImpactState, copyImpactStateInto, createImpactState, type ImpactState } from "../presentation/impactState";
import { clearSpecialEffectState, copySpecialEffectStateInto, createSpecialEffectState, type SpecialEffectState } from "../presentation/specialEffectState";
import { clearSummonState, copySummonStateInto, createSummonState, type SummonState } from "../presentation/summonState";
import { clearFighterPose, copyFighterPoseInto, createFighterPose, type FighterPose } from "../presentation/fighterPose";
import type { Roster } from "../sim/roster";
import { isActive } from "../sim/roster";

/** Frame-owned pacing and presentation history; only pacing feeds the simulation. */
export interface ReplayRuntimeState {
  simulationFrame: number;
  botAttackDelays: Slots<number>;
  impacts: ImpactState;
  specials: SpecialEffectState;
  summons: SummonState;
  /** Scratch, overwritten before every step: no state crosses frames. */
  frameImpacts: Slots<ImpactEvents>;
  poses: Slots<FighterPose>;
}

export function createReplayRuntimeState(): ReplayRuntimeState {
  return {
    simulationFrame: 0,
    botAttackDelays: [0.0, 0.0, 0.0, 0.0],
    impacts: createImpactState(),
    specials: createSpecialEffectState(),
    summons: createSummonState(),
    frameImpacts: [createImpactEvents(), createImpactEvents(), createImpactEvents(), createImpactEvents()],
    poses: [createFighterPose(), createFighterPose(), createFighterPose(), createFighterPose()],
  };
}

export function resetPoses(runtime: ReplayRuntimeState): void {
  clearImpactState(runtime.impacts);
  clearSpecialEffectState(runtime.specials);
  clearSummonState(runtime.summons);
  for (const slot of PARTICIPANT_SLOTS) clearFighterPose(runtime.poses[slot]);
}

/** Copies between worlds: poses of the source world's participants, with their slot references. */
export function copyReplayRuntimeState(target: ReplayRuntimeState, source: Readonly<ReplayRuntimeState>, sourceWorld: Readonly<Roster>, _targetWorld: Readonly<Roster>): void {
  target.simulationFrame = source.simulationFrame;
  copyImpactStateInto(target.impacts, source.impacts);
  copySpecialEffectStateInto(target.specials, source.specials);
  copySummonStateInto(target.summons, source.summons);
  for (const slot of PARTICIPANT_SLOTS) {
    target.botAttackDelays[slot] = source.botAttackDelays[slot];
    if (isActive(sourceWorld, slot)) copyFighterPoseInto(target.poses[slot], source.poses[slot], sourceWorld);
  }
}
