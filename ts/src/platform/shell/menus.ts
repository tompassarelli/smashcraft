import type { QuickStageSettings } from "../../game/shell/devSettings";




import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot } from "../../game/input/participants";
import {
  Phase, changeStagePoolMode, changeStagePoolStage, canChooseComputer, cancelRematchCountdown, firstHumanSlot, characterFor, confirmRematch, cycleSlotMode, humanActive, recallCharacter,
  requestStageSelect, requestStart, setAutomaticRematch, setCpuOpponent, setCpuTier, setEndless, setHitAreas, setPartnerDamage, setTraining, cycleMatchMode, stepClassicTier, stepLoreBattle, setItemsOn, setUltimatesOn, toggleItemKind, stepPartnerBehaviour,
  stepPartnerEscape, stepPartnerTech, stepTrainingSpeed, setTutorialLesson, tickRematchCountdown,
  returnToCharacters, selectCharacter, selectCpuCharacter, selectStage, setHazards, setMeterDropsOn, setStocks, setTimeLimit, updateConnectedHumans,
  type MatchState, copyMatchState, createMatchState, setParticipants,
} from "../../game/match/rules";
import { keepMomentEnd, resetMomentRecorder } from "../../game/replay/moment";
import { resetPacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { clearObservedActions } from "../../game/match/step";
import { clearAttackBuffer } from "../../game/input/attackBuffer";
import { copyControls, neutralControls } from "../../game/sim/roster";
import { chooseScenarioCharacters } from "../../game/shell/scenarios";
import { PARTNER_DAMAGE_STEP } from "../../game/match/trainingState";
import { LESSONS, NO_LESSON, prepareTutorial, stepTutorialLesson } from "../../game/match/tutorial";
import { prepareQuickMatch } from "../../game/shell/devSettings";
import type { Scenario } from "../../game/shell/build";
import type { Character } from "../../game/sim/codes";
import { type PlaytestRequest, preparePlaytest } from "../../game/shell/playtest";
import { nextStage } from "../../game/menu/stageCatalog";
import { nextMatchCharacter } from "../../game/match/rules";
import { stepCpuOpponent, stepCpuTier } from "../../game/match/cpuProfiles";
import { traceSelectionState } from "./diagnostics";
import { ClassicStep, continueClassic, quitClassic, skipToClassicBoss, startClassic } from "../../game/classic/classic";
import { LORE_BATTLES, LoreStep, continueLore, startLore } from "../../game/classic/loreBattles";
import { clearParticipantInputs, controlsAvailable, currentComputerMask, currentHumanMask } from "./inputs";
import { startMatch } from "./matchStart";
import { recalibrateText, recalibratedDelay } from "./netDelay";
import { chooseDelay } from "../../game/ui/bindingSettings";
import { cancelStageLoad, requestStageLoad, stageLoading } from "./stageLoad";
import { endReplaySegment } from "./replays";
import { makePreview } from "./preview";
import { type ShellState, cancelPendingPlaytest, shell } from "./state";
import type { PanelActions } from "./ui";
import { clearMatchEffects, views } from "./ui";
import { announce, pauseMatchPresentation, setStatus } from "./view";


export function choose(s: ShellState, slot: ParticipantSlot, direction: -1 | 1): void {
  if (!controlsAvailable(s, slot) || stageLoading(s)) return;
  if (s.game.phase === Phase.characterMenu) {
    cancelPendingPlaytest();
    selectCharacter(s.game, slot, nextMatchCharacter(s.game, characterFor(s.game, slot), direction));
    makePreview(s);
  } else if (s.game.phase === Phase.stageMenu) selectStage(s.game, slot, nextStage(s.game.stageChoice, direction));
}


export function confirm(s: ShellState, slot: ParticipantSlot): void {
  if (s.pauseMenu?.title) {
    s.pauseMenu.title = false;
    return;
  }
  if (!controlsAvailable(s, slot)) {
    announce(s, "Controls are still loading or settings are open.");
    return;
  }
  const { game } = s;
  if (stageLoading(s)) return;
  if (game.phase === Phase.characterMenu) {
    s.pauseSelection = createMatchState();
    copyMatchState(s.pauseSelection, game);
  }
  if (game.phase === Phase.characterMenu && game.lore) {
    if (!startLore(game, slot)) return;
    for (const panel of views(s).settings) panel.close();
    requestStageLoad(s, slot);
  } else if (game.phase === Phase.characterMenu && game.classic) {
    if (!startClassic(game, slot)) return;
    for (const panel of views(s).settings) panel.close();
    requestStageLoad(s, slot);
  } else if (game.phase === Phase.characterMenu) {
    if (requestStageSelect(game, slot)) {
      if (s.dev.stageChoice !== undefined) selectStage(game, slot, s.dev.stageChoice);
      s.dev.stageChoice = undefined;
      for (const panel of views(s).settings) panel.close();
    }
  } else if (game.phase === Phase.stageMenu) {
    requestStageLoad(s, slot);
  } else if (game.phase === Phase.result && game.run.active && game.lore) {
    const step = continueLore(game, slot);
    if (step === LoreStep.none) return;
    setStatus(s, "", 0.0);
    if (step === LoreStep.retry) requestStageLoad(s, slot);
    else {
      updateConnectedHumans(game, currentHumanMask(game.departedMask));
      makePreview(s);
    }
  } else if (game.phase === Phase.result && game.run.active) {
    const step = continueClassic(game, slot);
    if (step === ClassicStep.none) return;
    setStatus(s, "", 0.0);
    if (step === ClassicStep.fight) requestStageLoad(s, slot);
    else {
      updateConnectedHumans(game, currentHumanMask(game.departedMask));
      makePreview(s);
    }
  } else if (game.phase === Phase.result) {
    if (cancelRematchCountdown(game, slot)) return;
    if (!confirmRematch(game, slot)) return;
    updateConnectedHumans(game, currentHumanMask(game.departedMask));
    setStatus(s, "", 0.0);
    makePreview(s);
  }
}

export function back(s: ShellState, slot: ParticipantSlot): void {
  if (!controlsAvailable(s, slot) || stageLoading(s)) return;
  if (s.game.phase === Phase.characterMenu) views(s).selections[slot].recallHeld();
  else if (s.game.phase === Phase.stageMenu) returnToCharacters(s.game, slot);
  else if (s.game.phase === Phase.result && quitClassic(s.game, slot)) {
    setStatus(s, "", 0.0);
    makePreview(s);
  } else if (s.game.phase === Phase.result) cancelRematchCountdown(s.game, slot);
}






export function serviceAutomaticRematch(s: ShellState): void {
  const journal = s.rollback?.journal;
  if (journal !== undefined && s.rollback?.active === true && journal.lifecycle?.quiescent() !== true) return;
  if (!tickRematchCountdown(s.game)) return;
  setStatus(s, "", 0.0);
  startMatch(s);
}

export function openSettingsScreen(s: ShellState, slot: ParticipantSlot): void {
  if (s.game.phase !== Phase.characterMenu || !humanActive(s.game, slot)) return;
  if (!s.participants[slot].bindings.ready) {
    announce(s, "Controls are still loading.");
    return;
  }
  clearParticipantInputs(s, slot);
  views(s).settings[slot].show();
}


export function startQuickMatch(s: ShellState, stage = 0, scenario: Scenario = s.build.scenario, character?: Character | readonly Character[], stocks = 1, stageSettings?: QuickStageSettings): void {
  if (prepareQuickMatch(s.game, stage, character, stocks)) {
    for (const panel of views(s).settings) panel.close();
    startMatch(s, scenario, stageSettings);
  }
}


export function startDevClassic(s: ShellState, character: Character, boss: boolean): void {
  const first = firstHumanSlot(s.game);
  if (first === undefined || s.game.phase !== Phase.characterMenu || stageLoading(s)) return;
  selectCharacter(s.game, first, character);
  s.game.training = false;
  s.game.classic = true;
  s.pauseSelection = createMatchState();
  copyMatchState(s.pauseSelection, s.game);
  if (!startClassic(s.game, first)) return;
  if (boss) skipToClassicBoss(s.game);
  for (const panel of views(s).settings) panel.close();
  requestStageLoad(s, first);
}


export function startDevLore(s: ShellState, battle: number): void {
  const first = firstHumanSlot(s.game);
  if (first === undefined || s.game.phase !== Phase.characterMenu || stageLoading(s)) return;
  s.game.training = false;
  s.game.classic = false;
  s.game.lore = true;
  s.game.loreBattle = battle - 1;
  if (!startLore(s.game, first)) return;
  for (const panel of views(s).settings) panel.close();
  requestStageLoad(s, first);
}


export function startPlaytest(s: ShellState, request: PlaytestRequest): boolean {
  const first = firstHumanSlot(s.game);
  if (first === undefined || !preparePlaytest(s.game, request)) return false;
  for (const panel of views(s).settings) panel.close();
  return requestStageLoad(s, first);
}


function withSlot(participant: number, act: (s: ShellState, slot: ParticipantSlot) => void): void {
  if (isParticipantSlot(participant)) act(shell(), participant);
}


export function panelActions(): PanelActions {
  return {
    selection: {
      selectChoice: (participant, choice) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu) return;
        cancelPendingPlaytest();
        selectCharacter(s.game, slot, choice);
        makePreview(s);
      }),
      selectCpuChoice: (participant, computer, choice) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu || !canChooseComputer(s.game, slot, computer)) return;
        cancelPendingPlaytest();
        selectCpuCharacter(s.game, slot, computer, choice);
        makePreview(s);
      }),
      cycleMode: (actor, fighterSlot) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || !cycleSlotMode(s.game, slot, fighterSlot)) return;
        cancelPendingPlaytest();
        makePreview(s);
        traceSelectionState(s, `cycle actor ${slot} slot ${fighterSlot}`);
      }),
      recallChoice: (actor, chipSlot) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu) return;
        cancelPendingPlaytest();
        recallCharacter(s.game, slot, chipSlot);
        makePreview(s);
      }),
      openSettings: participant => withSlot(participant, openSettingsScreen),
      start: participant => withSlot(participant, (s, slot) => {
        if (s.game.phase === Phase.characterMenu) confirm(s, slot);
      }),
      changeStocks: (participant, direction) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setStocks(s.game, slot, s.game.stockCount + direction);
      }),
      changeTime: (participant, direction) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setTimeLimit(s.game, slot, s.game.timeLimitMinutes + direction);
      }),
      toggleEndless: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setEndless(s.game, slot, !s.game.endless);
      }),
      changeCpuOpponent: (actor, computer, direction) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || !isParticipantSlot(computer)) return;
        cancelPendingPlaytest();
        setCpuOpponent(s.game, slot, computer, stepCpuOpponent(s.game.cpuOpponents[computer], direction));
      }),
      changeCpuTier: (actor, computer, direction) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || !isParticipantSlot(computer)) return;
        cancelPendingPlaytest();
        setCpuTier(s.game, slot, computer, stepCpuTier(s.game.cpuTiers[computer], direction));
      }),
      toggleAutomaticRematch: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setAutomaticRematch(s.game, slot, !s.game.automaticRematch);
      }),
      toggleItems: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setItemsOn(s.game, slot, !s.game.items.on);
      }),
      toggleUltimates: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setUltimatesOn(s.game, slot, s.game.ultimatesOff);
      }),
      toggleItemKind: (participant, kind) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) toggleItemKind(s.game, slot, kind);
      }),
      cycleMatchMode: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) cycleMatchMode(s.game, slot);
      }),
      stepClassicTier: (participant, direction) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot)) return;
        if (s.game.lore) stepLoreBattle(s.game, slot, direction, LORE_BATTLES.length);
        else stepClassicTier(s.game, slot, direction);
      }),
      stepTraining: (participant, setting, direction) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot)) return;
        if (setting === "behaviour") stepPartnerBehaviour(s.game, slot, direction);
        else if (setting === "escape") stepPartnerEscape(s.game, slot, direction);
        else if (setting === "tech") stepPartnerTech(s.game, slot, direction);
        else setPartnerDamage(s.game, slot, s.game.trainer.damage + direction * PARTNER_DAMAGE_STEP);
      }),
      toggleHitAreas: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setHitAreas(s.game, slot, !s.game.trainer.showHitAreas);
      }),
      stepSpeed: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) stepTrainingSpeed(s.game, slot, 1);
      }),
      stepTutorial: (participant, direction) => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) stepTutorialLesson(s.game, slot, direction);
      }),
      startTutorial: participant => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot) || stageLoading(s)) return;
        cancelPendingPlaytest();
        if (!prepareTutorial(s.game, slot)) return;
        for (const panel of views(s).settings) panel.close();
        makePreview(s);
        requestStageLoad(s, slot);
      }),
      closeTutorial: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setTutorialLesson(s.game, slot, NO_LESSON, LESSONS.length);
      }),
    },
    stage: {
      togglePoolMode: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) changeStagePoolMode(s.game, slot);
      }),
      togglePoolStage: (participant, choice) => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) changeStagePoolStage(s.game, slot, choice);
      }),
      selectStage: (participant, choice) => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) selectStage(s.game, slot, choice);
      }),
      start: participant => withSlot(participant, confirm),
      back: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) returnToCharacters(s.game, slot);
      }),
      toggleHazards: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) setHazards(s.game, slot, !s.game.hazards);
      }),
      toggleDrops: participant => withSlot(participant, (s, slot) => {
        if (!stageLoading(s)) setMeterDropsOn(s.game, slot, !s.game.drops.on);
      }),
    },
    settings: {
      closeSettings: participant => withSlot(participant, clearParticipantInputs),
      delayInfo: participant => {
        const s = shell();
        return s.rollback === undefined || !isParticipantSlot(participant) ? "" : recalibrateText(s.rollback.net, s.game, participant);
      },
      recalibrate: participant => withSlot(participant, (s, slot) => {
        if (s.rollback !== undefined) chooseDelay(s.participants[slot].bindings, recalibratedDelay(s.rollback.net, s.game, slot));
      }),
    },
  };
}


export function startingSelection(scenario: Scenario): MatchState {
  const game = createMatchState();
  setParticipants(game, currentHumanMask(0), currentComputerMask());
  chooseScenarioCharacters(scenario, game);
  return game;
}






export function resetToStartingSelection(s: ShellState): void {
  if (s.game.phase === Phase.match) {
    keepMomentEnd(s.moment.recorder, s.world, s.game, s.controls, s.runtime);
    endReplaySegment(s);
    clearMatchEffects(s);
  }
  cancelStageLoad(s);
  if (s.session.paused) {
    s.session.paused = false;
    pauseMatchPresentation(s, false);
  }
  for (const panel of views(s).settings) panel.close();
  copyMatchState(s.game, startingSelection(s.build.scenario));
  s.dev.stageChoice = undefined;
  resetMomentRecorder(s.moment.recorder);
  resetPacingAndPresentation(s.runtime);
  clearObservedActions();
  for (const slot of PARTICIPANT_SLOTS) {
    clearAttackBuffer(s.controls.commands[slot]);
    copyControls(s.controls.inputs[slot], neutralControls());
  }
  setStatus(s, "", 0.0);
  makePreview(s);
}
