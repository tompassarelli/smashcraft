import { servicePauseCameraControls, pauseHudHidden } from "./pauseCamera";




import { PARTICIPANT_SLOTS, isParticipantMask, isParticipantSlot } from "../../game/input/participants";
import { clearPulse } from "../../game/input/directionalInput";
import { ownConfirmedState } from "./confirmedState";
import { startKeyUp } from "../../game/match/controls";
import { Phase, copyMatchState, humanActive, humanPresent, participantLeft, updateConnectedHumans } from "../../game/match/rules";
import { FRAME_SECONDS } from "../../game/presentation/fighterPose";
import { FLOOR_HEIGHT } from "../../game/presentation/arenaCamera";
import { type MapBuild, journalIngress } from "../../game/shell/build";
import { pausing } from "../../game/shell/pauseBarrier";
import type { RollbackPlayback } from "../../game/shell/playback";
import { cancelBindingCapture, initializeBindingSettings, useDefaultBindings } from "../../game/ui/bindingSettings";
import { f32 } from "wisp/src/sim/f32";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { DRAW_EVENT, beginPresentedFrame, drawBetweenFrames, startFrameClock } from "./betweenFrames";
import { EDITBOX_ENTER, EditboxIngress } from "../editboxJournal";
import { localParticipantSlot, traceTick, writeReadyMarker } from "./diagnostics";
import { writeDrawnFrame } from "./drawnFrame";
import { heldVisualFrame } from "../../game/shell/visualCapture";
import { holdPresentedCapture, serviceVisualCapture } from "./visualCapture";
import { callbackMatchTick } from "./frame";
import { clearAllInputs, clearParticipantInputs, currentHumanMask } from "./inputs";
import { INPUT_PREFIX, journalEpoch, publishMenu, serviceJournalEnd } from "./journal";
import * as journalPause from "./journalPause";
import { KEY_DOWN, KEY_UP, Key, registerKey, removeKeyEvents, syncKeyEvents } from "./keyEvents";
import { onDevCommand, onDeveloperRestart, onDeveloperTrace, onKeyDown, onKeyUp, onProbeExport, onProbeStart } from "./keys";
import { panelActions, serviceAutomaticRematch, startingSelection } from "./menus";
import { PLAYER_FILE_RECEIVED, bindingFiles, playerFileReceived, playerFilesOwnerLeft, startPlayerFiles } from "./playerFiles";
import { PLAYTEST, PLAYTEST_PREFIX, playtestRequested, readPlaytestRequest, servicePlaytestRequest } from "./playtest";
import { STAGE_READY, cancelStageLoad, serviceStageLoad, stageReadyEvent } from "./stageLoad";
import { STAGE_READY_PREFIX } from "../../game/shell/stageLoad";
import { makePreview } from "./preview";
import { preloadStageAssets } from "./stageScenery";
import * as probe from "./responseProbe";
import { receiveInput, rollbackTick } from "./rollback";
import { floorMod } from "wisp/src/sim/intMath";
import * as netDelay from "./netDelay";
import { SAVE_MOMENT, momentKey, serviceMomentRequest, serviceMomentSave } from "./moment";
import { readMatchIndex, writeMatchRecord } from "./matchRecords";
import { type Rollback, type ShellState, activeRollback, createShellState, localSlot, momentSaves, replayRecording, shellState } from "./state";
import { endReplaySegment, serviceReplay } from "./replays";
import { CONTROL_ACK_PREFIX, PAUSE_REQUEST_PREFIX } from "../../game/shell/pauseBarrier";
import { clearMatchEffects, createUi, recreateUi, views } from "./ui";
import { resultsView } from "../../game/presentation/matchCues";
import * as view from "./view";
import { keepMomentEnd } from "../../game/replay/moment";
import { resultMessage } from "../../game/shell/messages";
import { beforeNativeDriverTick, afterNativeDriverTick, captureNativeDriverInputs } from "../nativeDriver";
import { fighterAt, isActive } from "../../game/sim/roster";
import { PAD_MOUSE, createPadTriggers, padMouse } from "./analogPad";

const INIT = "shell.init";
const TICK = "shell.tick";
const PLAYER_LEFT = "shell.playerLeft";
const CONTROL_ACK = "shell.controlAck";
const PAUSE_REQUEST = "shell.pauseRequest";
const CHAT_CLOSED = "shell.chatClosed";
const INPUT = "shell.input";
const DEV_COMMAND = "shell.devCommand";
const RESTART = "shell.restart";
const TRACE = "shell.trace";
const PROBE_START = "shell.probeStart";
const PROBE_EDGES = "shell.probeEdges";
const PROBE_DUMP = "shell.probeDump";


interface PendingStart {
  readonly build: MapBuild;
  readonly playback: RollbackPlayback;
}

declare global {
  var __smashcraftShellStart: PendingStart | undefined;
}


function gameTick(s: ShellState): void {
  if (!beforeNativeDriverTick(s)) return;
  if (s.build.pausePositionProbe && s.game.phase === Phase.match && s.probe?.run === 0) probe.startProbe(s.probe, false);
  const pausedBefore = s.session.paused;
  view.serviceResumePresentation(s);
  serviceVisualCapture(s);
  const epoch = journalEpoch(s);
  const editbox = s.rollback?.journal?.editbox;
  servicePauseCameraControls(s);
  editbox?.tick();
  const chatSlot = s.build.devConsole ? localParticipantSlot(s) : undefined;
  if (chatSlot !== undefined) editbox?.publishChat(s.build.id, chatSlot);
  if (epoch !== undefined) {
    journalPause.serviceChat(s, epoch.rollback, epoch.journal);
    journalPause.servicePauseRequest(s, epoch.rollback, epoch.journal);
    serviceMomentRequest(s, epoch.rollback, epoch.journal);
    if (editbox !== undefined && s.game.phase !== Phase.match) serviceJournalEnd(s, epoch.rollback, epoch.journal);
  }
  const rollback = activeRollback(s);
  probe.probeBegin(s.probe, s.runtime.simulationFrame, rollback?.schedule.speculativeFrame() ?? -1, rollback?.schedule.knownThrough() ?? -1, s.game.phase);
  traceTick(s);
  for (const slot of PARTICIPANT_SLOTS) {
    const participant = s.participants[slot];
    if (participant.appliedBindingRevision === participant.bindings.revision) continue;
    clearParticipantInputs(s, slot);
    participant.appliedBindingRevision = participant.bindings.revision;
  }
  s.status.seconds = Math.max(0.0, f32(s.status.seconds - FRAME_SECONDS));
  s.moment.notice = Math.max(0.0, f32(s.moment.notice - FRAME_SECONDS));
  serviceMomentSave(s);
  serviceReplay(s);
  captureNativeDriverInputs(s);
  if (s.rollback !== undefined) serviceDelay(s, s.rollback);
  if (rollback !== undefined && s.game.phase === Phase.match) {
    const { journal } = rollback;
    if (journal !== undefined) journalPause.serviceControlAck(s, rollback, journal);
    rollbackTick(s, rollback);
    if (journal !== undefined) {
      journalPause.sendPauseCommit(s, rollback, journal);
      journalPause.commitPauseAtFrame(s, rollback, journal);
    }
  } else if (s.game.phase === Phase.match && !s.session.paused) callbackMatchTick(s);
  if (s.game.phase !== Phase.match) clearAllInputs(s);
  else for (const slot of PARTICIPANT_SLOTS) clearPulse(s.participants[slot].keys.directions);
  syncKeyEvents(s);
  const held = heldVisualFrame(localSlot()) !== undefined || view.resumePresentationHeld(s);
  beginPresentedFrame(s.game.phase === Phase.match && !s.session.paused && !held);
  if (!held) {
    view.renderPersistentPresentation(s);
    view.lockArenaCamera(s);
    view.renderUi(s);
    holdPresentedCapture(s);
  }
  writeDrawnFrame(s);
  const journal = s.rollback?.journal;
  if (editbox !== undefined && journal !== undefined) {
    const { barrier } = journal;
    editbox.updatePauseHint(s.session.paused, barrier.request !== undefined, pausing(barrier), pauseHudHidden(s));
  }
  if (s.game.phase === Phase.characterMenu || s.game.phase === Phase.stageMenu) s.menuFrames = ((s.menuFrames ?? 0) + 1) & 1048575;
  servicePlaytestRequest(s);
  serviceStageLoad(s);
  if (s.game.phase === Phase.result) serviceAutomaticRematch(s);
  presentMatchFlow(s);
  publishMenu(s);
  const local = localParticipantSlot(s);
  if (s.probe !== undefined && local !== undefined) {
    const confirmed = s.participants[local].body !== undefined && isActive(s.world, local) && fighterAt(s.world, local).shield.raised;
    const predictedWorld = rollback?.speculative.world;
    const predicted = predictedWorld !== undefined && isActive(predictedWorld, local);
    probe.probePresent(s.probe, confirmed, predicted && fighterAt(predictedWorld, local).shield.raised, predicted ? rollback?.speculative.runtime.poses[local].selectionSerial ?? -1 : -1);
    if (probe.probeRecording(s.probe)) {
      const presented = s.build.presentation === "pool-predicted" && rollback !== undefined ? rollback.speculative : undefined;
      const world = presented?.world ?? s.world;
      const frame = presented?.runtime.simulationFrame ?? s.runtime.simulationFrame;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(world, slot)) continue;
        const { x, z } = fighterAt(world, slot).motion;
        probe.probeFighterPosition(s.probe, slot, frame, x, z);
      }
      if (s.build.pausePositionProbe && pausedBefore !== s.session.paused) {
        probe.probeIntegrity(s.probe, `pause-boundary ${s.session.paused ? "paused" : "resumed"} ${frame}`);
        if (!s.session.paused) probe.exportProbe(s.probe);
      }
    }
  }
  writeReadyMarker(s);
  afterNativeDriverTick(s);
}


function presentMatchFlow(s: ShellState): void {
  const { match, selections } = views(s);
  const { phase } = s.game;
  if (phase === Phase.characterMenu || phase === Phase.stageMenu) {
    match.enterMenus();
    const local = localParticipantSlot(s);
    match.presentMenus(s.game, local === undefined ? undefined : selections[local].hoveredTile());
    return;
  }
  if (!match.tick()) return;
  const posing = match.posing;
  const body = posing === undefined ? undefined : s.participants[posing]?.body;
  if (body !== undefined) ShowUnit(body.unit, false);
}

function playerLeft(s: ShellState): void {
  ownConfirmedState(s);
  const slot = GetPlayerId(GetTriggerPlayer());
  playerFilesOwnerLeft(slot);
  if (!humanPresent(s.game, slot)) return;
  const wasMatch = s.game.phase === Phase.match;
  keepMomentEnd(s.moment.recorder, s.world, s.game, s.controls, s.runtime);
  endReplaySegment(s);
  participantLeft(s.game, slot, s.world);
  clearAllInputs(s);
  startKeyUp(s.session, slot);
  if (isParticipantSlot(slot)) cancelBindingCapture(s.participants[slot].bindings);
  if (s.rollback !== undefined) s.rollback.active = false;
  if (wasMatch) {
    clearMatchEffects(s);
    s.session.paused = false;
    view.pauseMatchPresentation(s, false);
    view.setStatus(s, resultMessage(s.game), view.LASTING);
    views(s).match.beginResults(resultsView(s.game, s.world, views(s).match.tally), 0);
    writeMatchRecord(s);
  } else if (s.game.phase === Phase.characterMenu || s.game.phase === Phase.stageMenu) {
    cancelStageLoad(s);
    s.game.phase = Phase.characterMenu;
    const humans = currentHumanMask(s.game.departedMask);
    if (isParticipantMask(humans)) {
      updateConnectedHumans(s.game, humans);
      makePreview(s);
    }
    view.announce(s, "A player left. Choose the next match.");
  }
  removeKeyEvents(s);
  syncKeyEvents(s);
}


function developerChord(s: ShellState, key: number, handler: string): void {
  const trigger = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(s.game, slot)) BlzTriggerRegisterPlayerKeyEvent(trigger, Player(slot), ConvertOsKeyType(key), 2, true);
  }
  TriggerAddAction(trigger, trampoline(handler));
}

function syncTrigger(s: ShellState, prefix: string, handler: string, humansOnly: boolean): void {
  const trigger = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) {
    if (!humansOnly || humanActive(s.game, slot)) BlzTriggerRegisterPlayerSyncEvent(trigger, Player(slot), prefix, false);
  }
  TriggerAddAction(trigger, trampoline(handler));
}


function createTriggers(s: ShellState): void {
  createPadTriggers(s);
  if (s.probe !== undefined) {
    developerChord(s, Key.g, PROBE_START);
    developerChord(s, Key.j, PROBE_EDGES);
    developerChord(s, Key.h, PROBE_DUMP);
  }
  developerChord(s, Key.r, RESTART);
  developerChord(s, Key.t, TRACE);
  const startDown = CreateTrigger();
  const startUp = CreateTrigger();
  registerKey(s, startDown, Key.y, true);
  registerKey(s, startUp, Key.y, false);
  TriggerAddAction(startDown, trampoline(KEY_DOWN));
  TriggerAddAction(startUp, trampoline(KEY_UP));
  const moment = CreateTrigger();
  registerKey(s, moment, Key.k, true);
  TriggerAddAction(moment, trampoline(SAVE_MOMENT));
  syncKeyEvents(s);
  const { rollback } = s;
  if (rollback !== undefined) syncTrigger(s, INPUT_PREFIX, INPUT, true);
  if (rollback !== undefined) netDelay.registerDelayProposals(netDelay.DELAY_RECEIVED);
  if (rollback?.journal !== undefined) syncTrigger(s, CONTROL_ACK_PREFIX, CONTROL_ACK, true);
  if (rollback?.journal?.editbox !== undefined) {
    syncTrigger(s, PAUSE_REQUEST_PREFIX, PAUSE_REQUEST, true);
    syncTrigger(s, journalPause.CHAT_CLOSED_PREFIX, CHAT_CLOSED, true);
  }
  if (s.build.devConsole) {
    const chat = CreateTrigger();
    for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerChatEvent(chat, Player(slot), "-dev ", false);
    TriggerAddAction(chat, trampoline(DEV_COMMAND));
  }
  syncTrigger(s, PLAYTEST_PREFIX, PLAYTEST, true);
  syncTrigger(s, STAGE_READY_PREFIX, STAGE_READY, true);
  const leave = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerEvent(leave, Player(slot), EVENT_PLAYER_LEAVE);
  TriggerAddAction(leave, trampoline(PLAYER_LEFT));
  const tick = CreateTimer();
  TimerStart(tick, FRAME_SECONDS, true, trampoline(TICK));
  startFrameClock(tick);
}


function worldOrigin(): { x: number; y: number; z: number } {
  const center = GetRectCenter(GetPlayableMapRect());
  const origin = { x: GetLocationX(center), y: GetLocationY(center), z: GetLocationZ(center) + FLOOR_HEIGHT };
  RemoveLocation(center);
  return origin;
}


function initialize(): void {
  DestroyTimer(GetExpiredTimer());
  const pending = globalThis.__smashcraftShellStart;
  if (pending === undefined || shellState() !== undefined) return;
  globalThis.__smashcraftShellStart = undefined;
  const { build } = pending;
  const origin = worldOrigin();
  BlzHideOriginFrames(true);

  if (!BlzLoadTOCFile("war3mapImported\\SmashcraftHUD.toc")) DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, "Smashcraft's menus could not load. Restart the game.");
  BlzEnableSelections(false, false);
  EnableUserControl(true);
  FogEnable(false);
  FogMaskEnable(false);


  for (const slot of PARTICIPANT_SLOTS) SetPlayerColor(Player(slot), ConvertPlayerColor(slot));
  const s = createShellState(build, {
    origin, frames: view.createStatusFrames(), persistence: bindingFiles, playback: pending.playback,
    editbox: journalIngress(build) === "editbox" ? new EditboxIngress() : undefined,
  });
  copyMatchState(s.game, startingSelection(build.scenario));
  createUi(s, panelActions());
  preloadStageAssets(s);
  view.drawStage(s);
  CameraSetSmoothingFactor(0.0);
  SetTimeOfDay(12.0);
  SetTimeOfDayScale(0.0);
  startPlayerFiles();
  makePreview(s);
  view.lockArenaCamera(s);
  view.renderUi(s);
  createTriggers(s);
  readPlaytestRequest(s);
  readMatchIndex();
  for (const participant of s.participants) {
    if (humanActive(s.game, participant.slot)) initializeBindingSettings(participant.bindings);
    else useDefaultBindings(participant.bindings);
  }
}


function serviceDelay(s: ShellState, rollback: Rollback): void {
  const local = localSlot();
  netDelay.serviceNetDelay(rollback.net, s.game, local, rollback.delay, s.game.phase === Phase.match);
  if (s.game.phase !== Phase.characterMenu || floorMod(rollback.net.ticks, 30) !== 0) return;
  const text = netDelay.lobbyDelayText(rollback.net, s.game, s.participants.map(participant => participant.bindings.delay));
  for (const panel of views(s).selections) panel.showDelay(text);
}


function withShell(handler: (s: ShellState) => void): () => void {
  return () => {
    const s = shellState();
    if (s !== undefined) handler(s);
  };
}


export function installShell(): void {
  on(PAD_MOUSE, withShell(padMouse));
  on(INIT, initialize);
  on(TICK, withShell(gameTick));
  on(DRAW_EVENT, drawBetweenFrames);
  on(KEY_DOWN, withShell(onKeyDown));
  on(KEY_UP, withShell(onKeyUp));
  on(INPUT, withShell(receiveInput));
  on(netDelay.DELAY_RECEIVED, withShell(s => { if (s.rollback !== undefined) netDelay.receiveDelayProposal(s.rollback.net); }));
  on(CONTROL_ACK, withShell(journalPause.receiveControlAckEvent));
  on(PAUSE_REQUEST, withShell(journalPause.pauseRequestEvent));
  on(CHAT_CLOSED, withShell(journalPause.chatClosedEvent));
  on(EDITBOX_ENTER, withShell(journalPause.chatEntered));
  on(DEV_COMMAND, withShell(onDevCommand));
  on(PLAYER_LEFT, withShell(playerLeft));
  on(RESTART, withShell(onDeveloperRestart));
  on(TRACE, withShell(onDeveloperTrace));
  on(PROBE_START, withShell(s => onProbeStart(s, false)));
  on(PROBE_EDGES, withShell(s => onProbeStart(s, true)));
  on(PROBE_DUMP, withShell(onProbeExport));
  on(probe.PROBE_EXPORT, withShell(s => { if (s.probe !== undefined) probe.exportProbePage(s.probe); }));
  on(PLAYER_FILE_RECEIVED, playerFileReceived);
  on(SAVE_MOMENT, withShell(momentKey));
  on(PLAYTEST, withShell(playtestRequested));
  on(STAGE_READY, withShell(stageReadyEvent));
  const s = shellState();
  if (s?.ui !== undefined) recreateUi(s, panelActions());

  if (s !== undefined && s.moment === undefined) s.moment = momentSaves();
  if (s !== undefined && s.replay === undefined) s.replay = replayRecording();
  const rollback: { net?: netDelay.NetDelay; readonly mode: { readonly rollback: number } } | undefined = s?.rollback;
  if (rollback !== undefined && rollback.net === undefined) rollback.net = netDelay.createNetDelay(rollback.mode.rollback);

  if (s !== undefined && s.drawnStage === undefined) view.drawStage(s);
}


export function startShell(build: MapBuild, playback: RollbackPlayback): void {
  globalThis.__smashcraftShellStart = { build, playback };
  TimerStart(CreateTimer(), 0.0, false, trampoline(INIT));
}
