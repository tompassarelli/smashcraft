


import type { ParticipantSlot } from "../../game/input/participants";
import { canRequestStart, requestStart, resolveStageChoice } from "../../game/match/rules";
import { stageInfo } from "../../game/menu/stageCatalog";
import { STAGE_READY_PREFIX, StageLoadStep, beginStageLoad, stageReported, tickStageLoad } from "../../game/shell/stageLoad";
import { startMatch } from "./matchStart";
import type { ShellState } from "./state";
import { views } from "./ui";
import { drawStage } from "./view";

export const STAGE_READY = "shell.stageReady";


export function requestStageLoad(s: ShellState, slot: ParticipantSlot): boolean {
  if (s.stageLoad !== undefined || !canRequestStart(s.game, slot)) return false;
  resolveStageChoice(s.game, (s.menuFrames ?? 0) + s.game.matchSeed);
  s.stageLoad = beginStageLoad(s.game, slot);
  const { name, texture } = stageInfo(s.game.stageChoice);
  views(s).match.showLoading(name, texture);
  drawStage(s);
  return true;
}

export const stageLoading = (s: Readonly<ShellState>): boolean => s.stageLoad !== undefined;

function finishStageLoad(s: ShellState): void {
  const load = s.stageLoad;
  s.stageLoad = undefined;
  if (load !== undefined && requestStart(s.game, load.starter)) startMatch(s);
  views(s).match.hideLoading();
}


export function cancelStageLoad(s: ShellState): void {
  if (s.stageLoad === undefined) return;
  s.stageLoad = undefined;
  views(s).match.hideLoading();
}


export function serviceStageLoad(s: ShellState): void {
  const load = s.stageLoad;
  if (load === undefined) return;
  const step = tickStageLoad(load);
  if (step === StageLoadStep.report) BlzSendSyncData(STAGE_READY_PREFIX, `${load.stage}`);
  else if (step === StageLoadStep.start) finishStageLoad(s);
}


export function stageReadyEvent(s: ShellState): void {
  const load = s.stageLoad;
  if (load !== undefined && stageReported(load, GetPlayerId(GetTriggerPlayer()), BlzGetTriggerSyncData())) finishStageLoad(s);
}
