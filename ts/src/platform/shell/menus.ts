// Character selection with the match rules, stage selection, settings and the
// rematch, chosen or automatic. Every entry point runs from a synchronized
// event (a key event, frame click, sync message, chat or the game timer), so
// all clients take the same path.
import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot } from "../../game/input/participants";
import {
  Phase, changeStagePoolMode, changeStagePoolStage, canChooseComputer, cancelRematchCountdown, firstHumanSlot, characterFor, confirmRematch, cycleSlotMode, humanActive, recallCharacter,
  requestStageSelect, requestStart, setAutomaticRematch, setCpuOpponent, setCpuTier, setEndless, setHitAreas, setPartnerDamage, setTraining, stepPartnerBehaviour,
  stepPartnerEscape, stepPartnerTech, stepTrainingSpeed, tickRematchCountdown,
  returnToCharacters, selectCharacter, selectCpuCharacter, selectStage, setHazards, setStocks, setTimeLimit, updateConnectedHumans,
  type MatchState, copyMatchState, createMatchState, setParticipants,
} from "../../game/match/rules";
import { keepMomentEnd, resetMomentRecorder } from "../../game/replay/moment";
import { resetPacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { clearObservedActions } from "../../game/match/step";
import { clearAttackBuffer } from "../../game/input/attackBuffer";
import { copyControls, neutralControls } from "../../game/sim/roster";
import { chooseScenarioCharacters } from "../../game/shell/scenarios";
import { PARTNER_DAMAGE_STEP } from "../../game/match/trainingState";
import { prepareQuickMatch } from "../../game/shell/devSettings";
import type { Scenario } from "../../game/shell/build";
import type { Character } from "../../game/sim/codes";
import { type PlaytestRequest, preparePlaytest } from "../../game/shell/playtest";
import { nextStage } from "../../game/menu/stageCatalog";
import { nextSelectableCharacter } from "../../game/sim/heroes/registry";
import { stepCpuOpponent, stepCpuTier } from "../../game/match/cpuProfiles";
import { traceSelectionState } from "./diagnostics";
import { clearParticipantInputs, controlsAvailable, currentComputerMask, currentHumanMask } from "./inputs";
import { startMatch } from "./matchStart";
import { cancelPendingPlaytest } from "./playtest";
import { cancelStageLoad, requestStageLoad, stageLoading } from "./stageLoad";
import { endReplaySegment } from "./replays";
import { makePreview } from "./preview";
import { type ShellState, shell } from "./state";
import type { PanelActions } from "./ui";
import { clearMatchEffects, views } from "./ui";
import { announce, pauseMatchPresentation, setStatus } from "./view";

/** Left and right on a menu: the next fighter, or the other stage. */
export function choose(s: ShellState, slot: ParticipantSlot, direction: -1 | 1): void {
  if (!controlsAvailable(s, slot) || stageLoading(s)) return;
  if (s.game.phase === Phase.characterMenu) {
    cancelPendingPlaytest();
    selectCharacter(s.game, slot, nextSelectableCharacter(characterFor(s.game, slot), direction));
    makePreview(s);
  } else if (s.game.phase === Phase.stageMenu) selectStage(s.game, slot, nextStage(s.game.stageChoice, direction));
}

/** Accept: continue to stages, start the match, or ready up for a rematch. */
export function confirm(s: ShellState, slot: ParticipantSlot): void {
  if (!controlsAvailable(s, slot)) {
    announce(s, "Controls are still loading or settings are open.");
    return;
  }
  const { game } = s;
  if (stageLoading(s)) return;
  if (game.phase === Phase.characterMenu) {
    if (requestStageSelect(game, slot)) {
      if (s.dev.stageChoice !== undefined) selectStage(game, slot, s.dev.stageChoice);
      s.dev.stageChoice = undefined;
      for (const panel of views(s).settings) panel.close();
    }
  } else if (game.phase === Phase.stageMenu) {
    requestStageLoad(s, slot);
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
  else if (s.game.phase === Phase.result) cancelRematchCountdown(s.game, slot);
}

/**
 * Each game callback at a result: the countdown runs once the players'
 * controller helpers have all stopped sending the last match, which is when
 * their presses reach the menus, and starts the rematch when it runs out.
 */
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

/** `-dev quick`: every human's default fighter on the default stage, past both menus. */
export function startQuickMatch(s: ShellState, stage = 0, scenario: Scenario = s.build.scenario, character?: Character | readonly Character[], stocks = 1): void {
  if (prepareQuickMatch(s.game, stage, character, stocks)) {
    for (const panel of views(s).settings) panel.close();
    startMatch(s, scenario);
  }
}

/** A playtest request: its computers at its level, then the match, past both menus. */
export function startPlaytest(s: ShellState, request: PlaytestRequest): boolean {
  const first = firstHumanSlot(s.game);
  if (first === undefined || !preparePlaytest(s.game, request)) return false;
  for (const panel of views(s).settings) panel.close();
  return requestStageLoad(s, first);
}

/** Panel events carry a participant number; anything but a slot is ignored. */
function withSlot(participant: number, act: (s: ShellState, slot: ParticipantSlot) => void): void {
  if (isParticipantSlot(participant)) act(shell(), participant);
}

/** The panels' requests. Each looks up the current state, so recreated panels act on the same match. */
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
      toggleTraining: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setTraining(s.game, slot, !s.game.training);
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
    },
    settings: {
      closeSettings: participant => withSlot(participant, clearParticipantInputs),
    },
  };
}

/** Fighter selection as the map starts it: the players in the game, and the scenario's fighters. */
export function startingSelection(scenario: Scenario): MatchState {
  const game = createMatchState();
  setParticipants(game, currentHumanMask(0), currentComputerMask());
  chooseScenarioCharacters(scenario, game);
  return game;
}

/**
 * `-dev reset`: ends any match between frames and puts the rules back at
 * startingSelection, so the next match plays the boot's seed and settings.
 * Leaving the match phase ends its journal epoch as a result does.
 */
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
