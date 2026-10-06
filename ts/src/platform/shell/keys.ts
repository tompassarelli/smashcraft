// Synchronized key and chat events: menu keys, Start, settings capture,
// callback-match input, developer chords and dev console commands.
import { Action } from "../../game/input/actions";
import { sampleKeys } from "../../game/input/keyboardCapture";
import { isCarrierKey } from "../../game/netcode/journal/keyboard";
import { type ParticipantSlot, isParticipantSlot } from "../../game/input/participants";
import { heldActions, keyDown, pressKey, releaseKey } from "../../game/input/playerKeys";
import { startKeyDown, startKeyUp } from "../../game/match/controls";
import { Phase, characterFor, firstHumanSlot, humanActive, leavePractice, recallCharacter, selectCharacter } from "../../game/match/rules";
import { DESYNC_COMMAND, QUICK_MATCH_COMMAND, applyDevCommand } from "../../game/shell/devSettings";
import { devReceiptFile } from "../../game/shell/journalFiles";
import { pausedMessage } from "../../game/shell/messages";
import { captureBinding } from "../../game/ui/bindingSettings";
import { writeLines } from "wisp/src/platform/fileio";
import { confirmedChecksum, startInputTrace, traceParticipant } from "./diagnostics";
import { probeFrameCostClock } from "./frameCost";
import { clearAllInputs } from "./inputs";
import { journalEpoch, journalIdentity } from "./journal";
import { chatBusy, requestPause } from "./journalPause";
import { Key } from "./keyEvents";
import { back, choose, confirm, openSettingsScreen, startQuickMatch } from "./menus";
import { makePreview } from "./preview";
import { exportProbe, probeIntegrity, probeRecording, startProbe } from "./responseProbe";
import { type ShellState, activeRollback, playsOnKeyboard } from "./state";
import { views } from "./ui";
import { LASTING, pauseMatchPresentation, setStatus } from "./view";

/** Keys the journal's carriers or edit box own, which the map must not read as the player's controls. */
function journalOwnsKey(s: ShellState, slot: ParticipantSlot, key: number): boolean {
  const epoch = journalEpoch(s);
  if (epoch === undefined) return false;
  const { journal } = epoch;
  if (journal.ingress === "keyboard") return isCarrierKey(key);
  if (journal.ingress !== "editbox") return false;
  // The edit box owns typing until the ended epoch is quiescent, and Start during
  // a match, unless the player plays the match on the keyboard: then Y is Start.
  if (s.game.phase !== Phase.match) return journal.lifecycle?.quiescent() !== true;
  return key === Key.y && !playsOnKeyboard(journal, slot);
}

/** Start: confirms in menus; in a match, pauses at once, or through the helpers' barrier for a journal. */
function startDown(s: ShellState, slot: ParticipantSlot): void {
  const epoch = journalEpoch(s);
  const playing = s.game.phase === Phase.match;
  if (epoch?.journal.editbox !== undefined && chatBusy(epoch.journal)) return;
  if (epoch !== undefined && playing && epoch.journal.barrier.request !== undefined) return;
  const deferred = epoch !== undefined && playing;
  const action = startKeyDown(s.session, slot, s.game.phase, views(s).settings[slot].isOpen(), deferred);
  if (action === "togglePause") {
    if (epoch !== undefined && deferred) requestPause(s, epoch.rollback, epoch.journal, !s.session.paused);
    else {
      clearAllInputs(s);
      pauseMatchPresentation(s, s.session.paused);
      setStatus(s, s.session.paused ? pausedMessage("Y") : "Resumed.", s.session.paused ? LASTING : 1.0);
    }
  } else if (action === "confirm") confirm(s, slot);
}

/** Journal menus have fixed controller keys, independent of combat bindings and the mouse. */
function journalMenuKey(s: ShellState, slot: ParticipantSlot, key: number): boolean {
  if (key === Key.w || key === Key.r) choose(s, slot, key === Key.w ? -1 : 1);
  else if (key === Key.n) {
    if (s.game.phase !== Phase.characterMenu) confirm(s, slot);
    else {
      selectCharacter(s.game, slot, characterFor(s.game, slot) ?? 0);
      makePreview(s);
    }
  } else if (key === Key.u) {
    if (s.game.phase === Phase.characterMenu) recallCharacter(s.game, slot, slot);
    else back(s, slot);
  } else return false;
  return true;
}

function participantKeyDown(s: ShellState, slot: ParticipantSlot): void {
  if (!humanActive(s.game, slot)) return;
  const key = GetHandleId(BlzGetTriggerPlayerKey());
  if (journalOwnsKey(s, slot, key)) return;
  if (s.trace.active) s.trace.window.keyDown[slot]++;
  traceParticipant(s, slot, `received down ${key}`);
  const participant = s.participants[slot];
  const { keys, bindings } = participant;
  const settings = views(s).settings[slot];
  if (key < 0 || key > 255 || keyDown(keys, key)) return;
  if (key === Key.y) {
    startDown(s, slot);
    return;
  }
  if (key === Key.escape && settings.isOpen()) {
    settings.close();
    return;
  }
  if (settings.isOpen()) {
    captureBinding(bindings, key);
    return;
  }
  if (key === Key.f1) {
    openSettingsScreen(s, slot);
    return;
  }
  if (!bindings.ready) return;
  const { game } = s;
  const editbox = s.rollback?.journal?.editbox !== undefined;
  if (editbox && game.phase !== Phase.match && journalMenuKey(s, slot, key)) return;
  if (key === Key.escape && game.phase === Phase.stageMenu) {
    back(s, slot);
    return;
  }
  if (key === Key.escape && s.session.paused && leavePractice(game, slot)) {
    s.session.paused = false;
    setStatus(s, "", 0.0);
    makePreview(s);
    pauseMatchPresentation(s, false);
    return;
  }
  if (game.phase === Phase.match && (s.session.paused || activeRollback(s) !== undefined)) return;
  const action = pressKey(keys, key, bindings.bindings);
  if (action === undefined) return;
  participant.lastInputAction = action;
  traceParticipant(s, slot, `mapped action ${action}`);
  if (game.phase === Phase.match) sampleKeys(participant.capture, heldActions(keys));
  else if (action === Action.moveLeft || action === Action.moveRight) choose(s, slot, 1);
  else if (action === Action.attack) {
    if (game.phase === Phase.characterMenu) views(s).selections[slot].placeHovered();
    else confirm(s, slot);
  } else if (action === Action.special) back(s, slot);
}

function participantKeyUp(s: ShellState, slot: ParticipantSlot): void {
  if (!humanActive(s.game, slot)) return;
  const key = GetHandleId(BlzGetTriggerPlayerKey());
  // Starting a match changes the phase before its confirming key is released.
  if (key === Key.y) {
    startKeyUp(s.session, slot);
    return;
  }
  if (journalOwnsKey(s, slot, key)) return;
  if (s.trace.active) s.trace.window.keyUp[slot]++;
  traceParticipant(s, slot, `received up ${key}`);
  const participant = s.participants[slot];
  releaseKey(participant.keys, key, participant.bindings.bindings);
  if (s.game.phase === Phase.match) sampleKeys(participant.capture, heldActions(participant.keys));
}

function triggerSlot(): ParticipantSlot | undefined {
  const slot = GetPlayerId(GetTriggerPlayer());
  return isParticipantSlot(slot) ? slot : undefined;
}

export function onKeyDown(s: ShellState): void {
  const slot = triggerSlot();
  if (slot !== undefined) participantKeyDown(s, slot);
}

export function onKeyUp(s: ShellState): void {
  const slot = triggerSlot();
  if (slot !== undefined) participantKeyUp(s, slot);
}

/** Developer chords answer only the first human, so one press acts once on every client. */
const fromFirstHuman = (s: Readonly<ShellState>) => triggerSlot() === firstHumanSlot(s.game);

/** Ctrl+R: restart the map. */
export function onDeveloperRestart(s: ShellState): void {
  if (!fromFirstHuman(s) || s.restartRequested) return;
  s.restartRequested = true;
  RestartGame(false);
}

/** Ctrl+T: start the input trace. */
export function onDeveloperTrace(s: ShellState): void {
  if (fromFirstHuman(s) && !s.trace.active && !probeRecording(s.probe)) startInputTrace(s);
}

/** Ctrl+G records the response probe; Ctrl+J records it with a file per edge. */
export function onProbeStart(s: ShellState, edgeStamps: boolean): void {
  if (s.probe !== undefined && !s.trace.active && fromFirstHuman(s)) startProbe(s.probe, edgeStamps);
}

/** Ctrl+H: the confirmed checksum, then the probe's pages. */
export function onProbeExport(s: ShellState): void {
  if (s.probe === undefined || !fromFirstHuman(s)) return;
  const rollback = activeRollback(s);
  if (rollback !== undefined) probeIntegrity(s.probe, `checksum ${rollback.epoch} ${s.runtime.simulationFrame} ${confirmedChecksum(s)} ${s.game.phase}`);
  exportProbe(s.probe);
}

/**
 * Chat reaches every client at the same game time. The receipt file lets
 * automation confirm every client holds the setting before the next match.
 */
export function onDevCommand(s: ShellState): void {
  const message = GetEventPlayerChatString();
  let receipt: string | undefined;
  if (message === QUICK_MATCH_COMMAND) {
    receipt = "dev: quick match";
    startQuickMatch(s);
  } else if (message === "-dev frame-cost-clock") {
    receipt = "dev: frame cost clock probe";
    probeFrameCostClock();
  } else if (message === DESYNC_COMMAND) {
    const slot = GetPlayerId(GetTriggerPlayer());
    receipt = `dev: desync from player ${slot + 1}'s client`;
    // One more handle on one client: Warcraft's handle counter and tempest checksum diverge.
    if (slot === GetPlayerId(GetLocalPlayer())) CreateTimer();
  } else receipt = applyDevCommand(s.dev, message);
  if (receipt === undefined) return;
  s.devReceipts++;
  DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, receipt);
  const file = devReceiptFile(journalIdentity(s, s.rollback?.epoch ?? 0), s.devReceipts, s.dev);
  writeLines(file.name, file.lines);
}
