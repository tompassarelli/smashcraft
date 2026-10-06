// Character selection with the match rules, stage selection, settings and the
// rematch, chosen or automatic. Every entry point runs from a synchronized
// event (a key event, frame click, sync message, chat or the game timer), so
// all clients take the same path.
import { type ParticipantSlot, isParticipantSlot } from "../../game/input/participants";
import {
  Phase, canChooseComputer, cancelRematchCountdown, characterFor, confirmRematch, cycleSlotMode, humanActive, recallCharacter,
  requestStageSelect, requestStart, setAutomaticRematch, setEndless, tickRematchCountdown,
  returnToCharacters, selectCharacter, selectCpuCharacter, selectStage, setStocks, setTimeLimit, updateConnectedHumans,
} from "../../game/match/rules";
import { prepareQuickMatch } from "../../game/shell/devSettings";
import type { Scenario } from "../../game/shell/build";
import { preparePlaytest } from "../../game/shell/playtest";
import { nextStage } from "../../game/menu/stageCatalog";
import { nextSelectableCharacter } from "../../game/sim/heroes/registry";
import { traceSelectionState } from "./diagnostics";
import { clearParticipantInputs, controlsAvailable, currentHumanMask } from "./inputs";
import { startMatch } from "./matchStart";
import { makePreview } from "./preview";
import { type ShellState, shell } from "./state";
import type { PanelActions } from "./ui";
import { views } from "./ui";
import { announce, setStatus } from "./view";

/** Left and right on a menu: the next fighter, or the other stage. */
export function choose(s: ShellState, slot: ParticipantSlot, direction: -1 | 1): void {
  if (!controlsAvailable(s, slot)) return;
  if (s.game.phase === Phase.characterMenu) {
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
  if (game.phase === Phase.characterMenu) {
    if (requestStageSelect(game, slot)) for (const panel of views(s).settings) panel.close();
  } else if (game.phase === Phase.stageMenu) {
    if (requestStart(game, slot)) startMatch(s);
  } else if (game.phase === Phase.result) {
    if (cancelRematchCountdown(game, slot)) return;
    if (!confirmRematch(game, slot)) return;
    updateConnectedHumans(game, currentHumanMask(game.departedMask));
    setStatus(s, "", 0.0);
    makePreview(s);
  }
}

export function back(s: ShellState, slot: ParticipantSlot): void {
  if (!controlsAvailable(s, slot)) return;
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
export function startQuickMatch(s: ShellState, stage = 0, scenario: Scenario = s.build.scenario): void {
  if (prepareQuickMatch(s.game, stage)) {
    for (const panel of views(s).settings) panel.close();
    startMatch(s, scenario);
  }
}

/** A playtest request: computers in the slots of `computers`, then the match, past both menus. */
export function startPlaytest(s: ShellState, computers: number): boolean {
  if (!preparePlaytest(s.game, computers)) return false;
  for (const panel of views(s).settings) panel.close();
  startMatch(s);
  return true;
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
        selectCharacter(s.game, slot, choice);
        makePreview(s);
      }),
      selectCpuChoice: (participant, computer, choice) => withSlot(participant, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu || !canChooseComputer(s.game, slot, computer)) return;
        selectCpuCharacter(s.game, slot, computer, choice);
        makePreview(s);
      }),
      cycleMode: (actor, fighterSlot) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || !cycleSlotMode(s.game, slot, fighterSlot)) return;
        makePreview(s);
        traceSelectionState(s, `cycle actor ${slot} slot ${fighterSlot}`);
      }),
      recallChoice: (actor, chipSlot) => withSlot(actor, (s, slot) => {
        if (!controlsAvailable(s, slot) || s.game.phase !== Phase.characterMenu) return;
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
      toggleAutomaticRematch: participant => withSlot(participant, (s, slot) => {
        if (controlsAvailable(s, slot)) setAutomaticRematch(s.game, slot, !s.game.automaticRematch);
      }),
    },
    stage: {
      selectStage: (participant, choice) => withSlot(participant, (s, slot) => selectStage(s.game, slot, choice)),
      start: participant => withSlot(participant, confirm),
      back: participant => withSlot(participant, (s, slot) => returnToCharacters(s.game, slot)),
    },
    settings: {
      closeSettings: participant => withSlot(participant, clearParticipantInputs),
    },
  };
}
