import { traceUi } from "../../game/ui/frames";
import { cameraKey, returnPauseMenu, PAUSE_CAMERA_KEYS, pauseCameraKey } from "./pauseCamera";
import { HIT_PRESENTATION_CASES } from "../../game/shell/hitPresentationCases";
import { createImpactEvents } from "../../game/presentation/impactEvents";
import { emitImpacts } from "../../game/presentation/impactState";


import { Action } from "../../game/input/actions";
import { sampleKeys } from "../../game/input/keyboardCapture";
import { isCarrierKey } from "../../game/netcode/journal/keyboard";
import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot } from "../../game/input/participants";
import { heldActions, keyDown, pressKey, releaseKey } from "../../game/input/playerKeys";
import { startKeyDown, startKeyUp } from "../../game/match/controls";
import { Phase, cancelRematchCountdown, characterFor, copyMatchState, firstHumanSlot, humanActive, recallCharacter, selectCharacter } from "../../game/match/rules";
import { ROSTER_MANA } from "../../game/sim/mana";
import { fighterAt, isActive } from "../../game/sim/roster";
import { NO_LESSON, tutorialFinished } from "../../game/match/tutorial";
import { METER_COMMAND, classicDevRequest, loreDevRequest, LORE_WIN_COMMAND, winLoreBattle, DESYNC_COMMAND, QUICK_CPU_STOCKS, RESET_COMMAND, QUICK_TRAINING_COMMAND, applyDevCommand, prepareQuickCpu, prepareQuickTraining, quickMatchCpuHero, quickMatchCpuProfile, quickMatchHero, quickMatchStocks, quickMatchPair, quickPromoRequest, prepareQuickPromo, quickStageSettings, quickPainHero, quickRecoveryHero, quickOffstageHero } from "../../game/shell/devSettings";
import { fighterName } from "../../game/sim/heroes/registry";
import { endReplaySegment } from "./replays";
import { devReceiptFile } from "../../game/shell/journalFiles";
import { applySetupCommand } from "../../game/shell/sessionSetup";
import { pausedMessage } from "../../game/shell/messages";
import { captureBinding } from "../../game/ui/bindingSettings";
import { writeLines } from "wisp/src/platform/fileio";
import { confirmedChecksum, startInputTrace, traceParticipant } from "./diagnostics";
import { probeFrameCostClock } from "./frameCost";
import { probeRenderClock } from "./renderClock";
import { startDrawingBetweenFrames } from "./betweenFrames";
import { showBackdrop, showStageLighting, leverCommand } from "./stageScenery";
import { clearCapturedInputs } from "./inputs";
import { journalEpoch, journalIdentity } from "./journal";
import { chatBusy, requestPause } from "./journalPause";
import { Key, syncKeyEvents } from "./keyEvents";
import { startBodyFit } from "./bodyFit";
import { startAgencyFixture } from "./agencyFixture";
import { clearVisualCapture, configureVisualCapture } from "../../game/shell/visualCapture";
import { back, choose, confirm, openSettingsScreen, resetToStartingSelection, startDevClassic, startDevLore, startQuickMatch } from "./menus";
import { LORE_BATTLES } from "../../game/classic/loreBattles";
import { makePreview } from "./preview";
import { exportProbe, probeIntegrity, probeRecording, startProbe } from "./responseProbe";
import { type ShellState, activeRollback, cancelPendingPlaytest, keepShellMomentEnd, localSlot, playsOnKeyboard } from "./state";
import { clearMatchEffects, views } from "./ui";
import { ownConfirmedState } from "./confirmedState";
import { LASTING, pauseMatchPresentation, renderFighter, renderPersistentPresentation, setStatus } from "./view";


function journalOwnsKey(s: ShellState, slot: ParticipantSlot, key: number): boolean {
  const epoch = journalEpoch(s);
  if (epoch === undefined) return false;
  const { journal } = epoch;
  if (journal.ingress === "keyboard") return isCarrierKey(key);
  if (journal.ingress !== "editbox") return false;


  if (s.game.phase !== Phase.match) return journal.lifecycle?.quiescent() !== true;
  return key === Key.y && !playsOnKeyboard(journal, slot);
}


export function startDown(s: ShellState, slot: ParticipantSlot): void {
  const epoch = journalEpoch(s);
  const playing = s.game.phase === Phase.match;
  if (epoch?.journal.editbox !== undefined && chatBusy(epoch.journal)) return;
  if (epoch !== undefined && playing && epoch.journal.barrier.request !== undefined) return;
  if (s.session.paused) s.pauseKeysHeld = [0x26, 0x28, 32, 69, Key.n, Key.u, ...PAUSE_CAMERA_KEYS].filter(key => BlzIsKeyPressed(ConvertOsKeyType(key)));
  const deferred = epoch !== undefined && playing;
  const consumed = !s.session.startHeld[slot] && views(s).selections[slot].consumeStart();
  const action = startKeyDown(s.session, slot, s.game.phase, consumed || views(s).settings[slot].isOpen(), deferred);
  if (action === "togglePause") {
    if (epoch !== undefined && deferred) requestPause(s, epoch.rollback, epoch.journal, !s.session.paused);
    else {
      clearCapturedInputs(s);
      pauseMatchPresentation(s, s.session.paused);
      syncKeyEvents(s);
      setStatus(s, s.session.paused ? pausedMessage("Y") : "Resumed.", s.session.paused ? LASTING : 1.0);
    }
  } else if (action === "confirm") confirm(s, slot);
}


function journalMenuKey(s: ShellState, slot: ParticipantSlot, key: number): boolean {
  const action = key === Key.w ? Action.moveLeft : key === Key.r ? Action.moveRight : key === 32 ? Action.moveUp : key === 69 ? Action.moveDown : key === Key.n ? Action.attack : key === Key.u ? Action.special : undefined;
  if (action !== undefined) {
    pressKey(s.participants[slot].keys, key, s.participants[slot].bindings.bindings);
    if (views(s).selections[slot].menuAction(action)) return true;
  }
  if ((key === Key.w || key === Key.r || key === Key.n || key === Key.u) && cancelRematchCountdown(s.game, slot)) return true;
  if (key === Key.w || key === Key.r) choose(s, slot, key === Key.w ? -1 : 1);
  else if (key === Key.n) {
    if (s.game.phase !== Phase.characterMenu) confirm(s, slot);
    else {
      cancelPendingPlaytest();
      selectCharacter(s.game, slot, characterFor(s.game, slot) ?? 0);
      makePreview(s);
    }
  } else if (key === Key.u) {
    if (s.game.phase === Phase.characterMenu) recallCharacter(s.game, slot, slot);
    else back(s, slot);
  } else return false;
  return true;
}

function exitPausedMatch(s: ShellState, title: boolean): void {
  ownConfirmedState(s);
  keepShellMomentEnd(s);
  endReplaySegment(s);
  clearMatchEffects(s);
  if (s.game.run.active && s.pauseSelection !== undefined) copyMatchState(s.game, s.pauseSelection);
  s.game.phase = Phase.characterMenu;
  s.game.practice = false;
  if (tutorialFinished(s.game.trainer)) s.game.trainer.lesson = NO_LESSON;
  s.game.run.active = false;
  s.session.paused = false;
  const menu = s.pauseMenu ??= { choice: 0, shown: false, title: false };
  menu.shown = false;
  menu.title = title;
  traceUi(`ui title-set source=exitPausedMatch title=${title} phase=${s.game.phase}`);
  clearCapturedInputs(s);
  setStatus(s, "", 0.0);
  makePreview(s);
  pauseMatchPresentation(s, false);
}

export function selectPauseMenu(s: ShellState, actor: number, choice: number): void {
  if (!isParticipantSlot(actor) || !humanActive(s.game, actor)) return;
  if (s.pauseMenu?.title) {
    traceUi("ui title-clear source=selectPauseMenu");
    s.pauseMenu.title = false;
    return;
  }
  if (s.game.phase !== Phase.match || !s.session.paused) return;
  if (choice === 0) {
    startDown(s, actor);
    startKeyUp(s.session, actor);
  } else exitPausedMatch(s, choice === 2);
}

function participantKeyDown(s: ShellState, slot: ParticipantSlot): void {
  if (!humanActive(s.game, slot)) return;
  const key = GetHandleId(BlzGetTriggerPlayerKey());
  if (key === Key.f1) traceUi(`ui F1 down slot=${slot} phase=${s.game.phase} journalOwns=${journalOwnsKey(s, slot, key)} title=${s.pauseMenu?.title} held=${keyDown(s.participants[slot].keys, key)} settings=${views(s).settings[slot].isOpen()} ready=${s.participants[slot].bindings.ready}`);
  if (journalOwnsKey(s, slot, key)) return;
  if (s.trace.active) s.trace.window.keyDown[slot]++;
  traceParticipant(s, slot, `received down ${key}`);
  const participant = s.participants[slot];
  const { keys, bindings } = participant;
  const settings = views(s).settings[slot];
  if (key < 0 || key > 255 || keyDown(keys, key)) return;
  if (s.pauseMenu?.title && (key === Key.n || key === Key.y)) {
    traceUi(`ui title-clear source=keyDown key=${key}`);
    s.pauseMenu.title = false;
    return;
  }
  if ((key === Key.y || key === Key.escape) && cancelRematchCountdown(s.game, slot)) return;
  if (key === Key.y) {
    startDown(s, slot);
    return;
  }
  if (s.game.phase === Phase.match && s.session.paused) {
    if (GetTriggerPlayer() === GetLocalPlayer() && pauseCameraKey(key)) {
      if (s.rollback?.journal?.editbox === undefined || playsOnKeyboard(s.rollback.journal, slot)) cameraKey(s, key, true);
      return;
    }
    if (GetTriggerPlayer() === GetLocalPlayer()) returnPauseMenu(s);
    const menu = s.pauseMenu ??= { choice: 0, shown: true, title: false };
    if (key === Key.f2 && s.game.training) s.trainingHints = !s.trainingHints;
    else if (key === 0x26 || key === 32) menu.choice = menu.choice === 0 ? 2 : menu.choice - 1;
    else if (key === 0x28 || key === 69) menu.choice = menu.choice === 2 ? 0 : menu.choice + 1;
    else if (key === Key.escape || key === Key.u) exitPausedMatch(s, false);
    else if (key === Key.n) {
      selectPauseMenu(s, slot, menu.choice);
    }
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
    traceUi("ui F1 handler=openSettingsScreen");
    openSettingsScreen(s, slot);
    return;
  }
  if (!bindings.ready) return;
  if (key === 13 && s.game.phase !== Phase.match) return;
  const { game } = s;
  views(s).selections[slot].menuBindings(bindings.bindings);
  const editbox = s.rollback?.journal?.editbox !== undefined;
  if (editbox && game.phase !== Phase.match && journalMenuKey(s, slot, key)) return;
  if (key === Key.escape && game.phase === Phase.stageMenu) {
    back(s, slot);
    return;
  }
  if (game.phase === Phase.match && (s.session.paused || activeRollback(s) !== undefined)) return;
  const action = pressKey(keys, key, bindings.bindings);
  if (action === undefined) return;
  if (cancelRematchCountdown(game, slot)) return;
  participant.lastInputAction = action;
  traceParticipant(s, slot, `mapped action ${action}`);
  if (game.phase === Phase.characterMenu && views(s).selections[slot].menuAction(action)) return;
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
  if (key === Key.f1) traceUi(`ui F1 up slot=${slot} phase=${s.game.phase} journalOwns=${journalOwnsKey(s, slot, key)}`);

  if (key === Key.y) {
    startKeyUp(s.session, slot);
    return;
  }
  if (s.game.phase === Phase.match && s.session.paused) {
    if (GetTriggerPlayer() === GetLocalPlayer()) cameraKey(s, key, false);
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


const fromFirstHuman = (s: Readonly<ShellState>) => triggerSlot() === firstHumanSlot(s.game);


export function onDeveloperRestart(s: ShellState): void {
  if (!fromFirstHuman(s) || s.restartRequested) return;
  s.restartRequested = true;
  RestartGame(false);
}


export function onDeveloperTrace(s: ShellState): void {
  if (fromFirstHuman(s) && !s.trace.active && !probeRecording(s.probe)) startInputTrace(s);
}


export function onProbeStart(s: ShellState, edgeStamps: boolean): void {
  if (s.probe !== undefined && !s.trace.active && fromFirstHuman(s)) startProbe(s.probe, edgeStamps);
}


export function onProbeExport(s: ShellState): void {
  if (s.probe === undefined || !fromFirstHuman(s)) return;
  const rollback = activeRollback(s);
  if (rollback !== undefined) probeIntegrity(s.probe, `checksum ${rollback.epoch} ${s.runtime.simulationFrame} ${confirmedChecksum(s)} ${s.game.phase}`);
  exportProbe(s.probe);
}





export function onDevCommand(s: ShellState): void {
  applyDeveloperCommand(s, GetPlayerId(GetTriggerPlayer()), GetEventPlayerChatString());
}


const CINE_OFF_SUFFIX = " |cine off";


export function applyDeveloperCommand(s: ShellState, actor: number, original: string): void {
  ownConfirmedState(s);
  if (original === RESET_COMMAND) {
    s.promoHudHidden = false;
    clearVisualCapture(localSlot());
    pauseMatchPresentation(s, s.session.paused);
  }
  const captured = s.build.responseProbe ? configureVisualCapture(original, localSlot()) : original;
  const cineOff = captured.endsWith(CINE_OFF_SUFFIX);
  if (cineOff || original === RESET_COMMAND) views(s).combat.cineFilter = !cineOff;
  const message = cineOff ? captured.substring(0, captured.length - CINE_OFF_SUFFIX.length) : captured;
  let receipt: string | undefined;
  const promo = quickPromoRequest(message);
  const quickStage = quickStageSettings(message);
  const quickHero = quickMatchHero(message);
  const quickPair = quickMatchPair(message);
  const recoveryHero = quickRecoveryHero(message);
  const offstageHero = quickOffstageHero(message);
  const painHero = quickPainHero(message);
  const quickCpu = quickMatchCpuProfile(message);

  const setup = applySetupCommand(s.game, actor, message);
  if (setup === `dev: stage ${s.game.stageChoice}` && s.game.phase === Phase.characterMenu) s.dev.stageChoice = s.game.stageChoice;
  const classic = classicDevRequest(message);
  const lore = loreDevRequest(message, LORE_BATTLES.length);
  if (message === LORE_WIN_COMMAND) {
    if (!winLoreBattle(s.game, s.world)) return;
    receipt = "dev: lore win";
  } else if (lore !== undefined) {
    receipt = `dev: lore ${lore}`;
    startDevLore(s, lore);
  } else if (classic !== undefined) {
    receipt = `dev: classic ${fighterName(classic.character)}${classic.boss ? " boss" : ""}`;
    startDevClassic(s, classic.character, classic.boss);
  } else if (message === QUICK_TRAINING_COMMAND) {
    receipt = "dev: quick training";
    prepareQuickTraining(s.game);
    startQuickMatch(s, 0);
  } else if (message === RESET_COMMAND) {
    receipt = "dev: reset";
    resetToStartingSelection(s);
  } else if (message.startsWith(METER_COMMAND)) {
    const points = S2I(message.substring(METER_COMMAND.length));
    if (s.game.phase !== Phase.match || points < 0 || points > ROSTER_MANA.max) return;
    for (const slot of PARTICIPANT_SLOTS) if (isActive(s.world, slot)) fighterAt(s.world, slot).mana.points = points;
    receipt = `dev: meter ${points}`;
  } else if (message === "-dev camera") {
    receipt = "dev: camera match";
    startQuickMatch(s, 0, "camera");
  } else if (promo !== undefined) {
    if (!prepareQuickPromo(s.game, promo.pair)) return;
    s.promoHudHidden = true;
    ClearTextMessages();
    receipt = "dev: quick promo";
    startQuickMatch(s, promo.stage, "normal", undefined, QUICK_CPU_STOCKS);
  } else if (quickCpu !== undefined) {
    receipt = `dev: quick match cpu ${quickCpu}`;
    prepareQuickCpu(s.game, quickCpu, quickMatchCpuHero(message));
    startQuickMatch(s, 0, s.build.scenario, undefined, QUICK_CPU_STOCKS);
  } else if (quickStage !== undefined) {
    receipt = "dev: quick match";
    startQuickMatch(s, quickStage.stage, s.build.scenario, undefined, 1, quickStage);
  } else if (offstageHero !== undefined) {
    receipt = `dev: quick offstage ${fighterName(offstageHero)}`;
    startQuickMatch(s, 0, "up-special-recovery", offstageHero);
  } else if (recoveryHero !== undefined) {
    receipt = `dev: quick recovery ${fighterName(recoveryHero)}`;
    startQuickMatch(s, 0, "knockdown", recoveryHero);
  } else if (painHero !== undefined) {
    receipt = `dev: quick ${painHero.scenario} ${fighterName(painHero.character)}`;
    startQuickMatch(s, 0, painHero.scenario, painHero.character);
  } else if (quickPair !== undefined) {
    receipt = `dev: quick match ${fighterName(quickPair[0])} / ${fighterName(quickPair[1])}`;
    startQuickMatch(s, 0, s.build.scenario, quickPair);
  } else if (quickHero !== undefined) {
    receipt = `dev: quick match ${fighterName(quickHero)}`;
    startQuickMatch(s, 0, s.build.scenario, quickHero, quickMatchStocks(message));
  } else if (message.startsWith("-dev effects ")) {
    const index = S2I(message.slice(13));
    const scenario = HIT_PRESENTATION_CASES[index];
    if (scenario === undefined || s.game.phase !== Phase.match) return;
    const events = { ...createImpactEvents(), ...scenario.cue };
    events.x = 0.0;
    const ui = views(s);
    emitImpacts(s.runtime.impacts, events, 8);
    ui.combat.presentConfirmed(s.devReceipts + 1, 4, events);
    ui.combat.present(s.runtime.impacts, s.runtime.simulationFrame, s.runtime.impacts, true);
    receipt = `dev: effects ${index} ${scenario.model} ${scenario.sound}`;
  } else if (message === "-dev frame-cost-clock") {
    receipt = "dev: frame cost clock probe";
    probeFrameCostClock();
  } else if (message === "-dev backdrop off" || message === "-dev backdrop on") {
    const visible = message === "-dev backdrop on";
    receipt = `dev: backdrop ${visible ? "on" : "off"}`;
    showBackdrop(s, visible);
  } else if (message === "-dev lighting stock" || message === "-dev lighting stage") {
    const authored = message === "-dev lighting stage";
    showStageLighting(s, authored);
    for (const slot of PARTICIPANT_SLOTS) renderFighter(s, slot, s.runtime.poses[slot], s.participants[slot].before.out);
    renderPersistentPresentation(s);
    receipt = `dev: lighting ${authored ? "stage" : "stock"}`;
  } else if (message === "-dev view near" || message === "-dev view far" || message === "-dev view off") {
    s.viewExtreme = message === "-dev view near" ? "near" : message === "-dev view far" ? "far" : undefined;
    receipt = `dev: view ${s.viewExtreme ?? "off"}`;
  } else if (message.startsWith("-dev lever ")) {
    const words = message.slice(11).split(" ");
    leverCommand(s, words[0] ?? "", words[1] ?? "", words[2] ?? "");
    receipt = "";
  } else if (message.startsWith("-dev fogv ")) {

    const v = message.slice(10).split(" ").map((word) => S2R(word));
    if (v.length < 11) return;
    SetTerrainFogExV(R2I(v[0] ?? 0), v[1] ?? 0, v[2] ?? 0, v[3] ?? 0, v[4] ?? 0, v[5] ?? 0, v[6] ?? 0, v[7] ?? 0, v[8] ?? 0, v[9] ?? 0, v[10] ?? 0);
    BlzSetTerrainFogDrawOverSky((v[11] ?? 0) > 0.5);
    receipt = `dev: fogv ${message.slice(10)}`;
  } else if (message === "-dev smooth-draw") {
    receipt = startDrawingBetweenFrames() ? "dev: smooth draw on" : "dev: smooth draw already on";
  } else if (message === "-dev camera-smooth on" || message === "-dev camera-smooth off") {
    s.cameraTween = message === "-dev camera-smooth on";
    receipt = `dev: camera smooth ${s.cameraTween ? "on" : "off"}`;
  } else if (message === "-dev render-clock") {
    receipt = "dev: render clock probe";
    probeRenderClock();
  } else if (message === DESYNC_COMMAND) {
    const slot = actor;
    receipt = `dev: desync from player ${slot + 1}'s client`;
    // Creating a handle on one client alone diverges Warcraft's handle counter and tempest checksum.
    if (slot === GetPlayerId(GetLocalPlayer())) CreateTimer();
  } else if (setup !== undefined) {
    receipt = setup;
    makePreview(s);
  } else receipt = startAgencyFixture(s, message) ?? startBodyFit(s, message) ?? applyDevCommand(s.dev, message);
  if (receipt === undefined) return;
  s.devReceipts++;
  if (!s.promoHudHidden) DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, receipt);
  const file = devReceiptFile(journalIdentity(s, s.rollback?.epoch ?? 0), s.devReceipts, s.dev, s.game);
  writeLines(file.name, file.lines);
}
