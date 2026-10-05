// The native shell's lifecycle: start creates the state and every handle
// once, install registers every callback by name (and after a hot reload
// recreates the UI objects, which keep their creation code), and the game
// callback services one frame of menus, input, simulation and presentation.
import { PARTICIPANT_SLOTS, isParticipantMask, isParticipantSlot } from "../../game/input/participants";
import { clearPulse } from "../../game/input/directionalInput";
import { startKeyUp } from "../../game/match/controls";
import { Phase, humanActive, humanPresent, participantLeft, setParticipants, updateConnectedHumans } from "../../game/match/rules";
import { FRAME_SECONDS } from "../../game/presentation/fighterPose";
import { FLOOR_HEIGHT } from "../../game/presentation/arenaCamera";
import { type MapBuild, journalIngress } from "../../game/shell/build";
import { pausing } from "../../game/shell/pauseBarrier";
import type { RollbackPlayback } from "../../game/shell/playback";
import { chooseScenarioCharacters } from "../../game/shell/scenarios";
import { cancelBindingCapture, initializeBindingSettings, useDefaultBindings } from "../../game/ui/bindingSettings";
import { f32 } from "wisp/src/sim/f32";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { EDITBOX_ENTER, EditboxIngress } from "../editboxJournal";
import { localParticipantSlot, traceTick, writeReadyMarker } from "./diagnostics";
import { callbackMatchTick } from "./frame";
import { clearAllInputs, clearParticipantInputs, currentComputerMask, currentHumanMask } from "./inputs";
import { INPUT_PREFIX, journalEpoch, publishMenu, serviceJournalEnd } from "./journal";
import {
  CHAT_CLOSED_PREFIX, PAUSE_REQUEST_PREFIX, chatClosedEvent, chatEntered, commitPauseAtFrame, pauseRequestEvent,
  receiveControlAckEvent, sendPauseCommit, serviceChat, serviceControlAck, servicePauseRequest,
} from "./journalPause";
import { KEY_DOWN, KEY_UP, Key, registerKey, removeKeyEvents, syncKeyEvents } from "./keyEvents";
import { onDevCommand, onDeveloperRestart, onDeveloperTrace, onKeyDown, onKeyUp, onProbeExport, onProbeStart } from "./keys";
import { panelActions } from "./menus";
import { PLAYER_FILE_RECEIVED, bindingFiles, playerFileReceived, playerFilesOwnerLeft, startPlayerFiles } from "./playerFiles";
import { makePreview } from "./preview";
import { PROBE_EXPORT, exportProbePage, probeBegin, probePresent } from "./responseProbe";
import { receiveInput, rollbackTick } from "./rollback";
import { type ShellState, activeRollback, createShellState, shellState } from "./state";
import { CONTROL_ACK_PREFIX } from "../../game/shell/pauseBarrier";
import { clearMatchEffects, createUi, recreateUi } from "./ui";
import { LASTING, announce, createStatusFrames, drawStage, lockArenaCamera, pauseMatchPresentation, renderPersistentPresentation, renderUi, setStatus } from "./view";
import { resultMessage } from "../../game/shell/messages";
import { fighterAt, isActive } from "../../game/sim/roster";

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

/** The build and rollback playback start() was given, until the deferred initialization uses them. */
interface PendingStart {
  readonly build: MapBuild;
  readonly playback: RollbackPlayback;
}

declare global {
  var __smashcraftShellStart: PendingStart | undefined;
}

/** One game callback. */
function gameTick(s: ShellState): void {
  const epoch = journalEpoch(s);
  const editbox = s.rollback?.journal?.editbox;
  editbox?.tick();
  if (epoch !== undefined) {
    serviceChat(s, epoch.rollback, epoch.journal);
    servicePauseRequest(s, epoch.rollback, epoch.journal);
    if (editbox !== undefined && s.game.phase !== Phase.match) serviceJournalEnd(s, epoch.rollback, epoch.journal);
  }
  const rollback = activeRollback(s);
  probeBegin(s.probe, s.runtime.simulationFrame, rollback?.schedule.speculativeFrame() ?? -1, rollback?.schedule.knownThrough() ?? -1, s.game.phase);
  traceTick(s);
  for (const slot of PARTICIPANT_SLOTS) {
    const participant = s.participants[slot];
    if (participant.appliedBindingRevision === participant.bindings.revision) continue;
    clearParticipantInputs(s, slot);
    participant.appliedBindingRevision = participant.bindings.revision;
  }
  s.status.seconds = Math.max(0.0, f32(s.status.seconds - FRAME_SECONDS));
  if (rollback !== undefined && s.game.phase === Phase.match) {
    const { journal } = rollback;
    if (journal !== undefined) serviceControlAck(s, rollback, journal);
    rollbackTick(s, rollback);
    if (journal !== undefined) {
      sendPauseCommit(s, rollback, journal);
      commitPauseAtFrame(s, rollback, journal);
    }
  } else if (s.game.phase === Phase.match && !s.session.paused) callbackMatchTick(s);
  if (s.game.phase !== Phase.match) clearAllInputs(s);
  else for (const slot of PARTICIPANT_SLOTS) clearPulse(s.participants[slot].keys.directions);
  syncKeyEvents(s);
  renderPersistentPresentation(s);
  lockArenaCamera(s);
  renderUi(s);
  const journal = s.rollback?.journal;
  if (editbox !== undefined && journal !== undefined) {
    const { barrier } = journal;
    editbox.updatePauseHint(s.session.paused, barrier.request !== undefined, pausing(barrier));
  }
  publishMenu(s);
  const local = localParticipantSlot(s);
  if (s.probe !== undefined && local !== undefined) {
    const confirmed = s.participants[local].body !== undefined && isActive(s.world, local) && fighterAt(s.world, local).shield.raised;
    const predictedWorld = rollback?.speculative.world;
    const predicted = predictedWorld !== undefined && isActive(predictedWorld, local);
    probePresent(s.probe, confirmed, predicted && fighterAt(predictedWorld, local).shield.raised, predicted ? rollback?.speculative.runtime.poses[local].selectionSerial ?? -1 : -1);
  }
  writeReadyMarker(s);
}

function playerLeft(s: ShellState): void {
  const slot = GetPlayerId(GetTriggerPlayer());
  playerFilesOwnerLeft(slot);
  if (!humanPresent(s.game, slot)) return;
  const wasMatch = s.game.phase === Phase.match;
  participantLeft(s.game, slot, s.world);
  clearAllInputs(s);
  startKeyUp(s.session, slot);
  if (isParticipantSlot(slot)) cancelBindingCapture(s.participants[slot].bindings);
  if (s.rollback !== undefined) s.rollback.active = false;
  if (wasMatch) {
    clearMatchEffects(s);
    s.session.paused = false;
    pauseMatchPresentation(s, false);
    setStatus(s, resultMessage(s.game), LASTING);
  } else if (s.game.phase === Phase.characterMenu || s.game.phase === Phase.stageMenu) {
    s.game.phase = Phase.characterMenu;
    const humans = currentHumanMask(s.game.departedMask);
    if (isParticipantMask(humans)) {
      updateConnectedHumans(s.game, humans);
      makePreview(s);
    }
    announce(s, "A player left. Choose the next match.");
  }
  removeKeyEvents(s);
  syncKeyEvents(s);
}

/** A trigger for one key with a modifier (2: Ctrl) from every human, run by name. */
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

/** Every trigger and timer, created once. */
function createTriggers(s: ShellState): void {
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
  syncKeyEvents(s);
  const { rollback } = s;
  if (rollback !== undefined) syncTrigger(s, INPUT_PREFIX, INPUT, true);
  if (rollback?.journal !== undefined) syncTrigger(s, CONTROL_ACK_PREFIX, CONTROL_ACK, true);
  if (rollback?.journal?.editbox !== undefined) {
    syncTrigger(s, PAUSE_REQUEST_PREFIX, PAUSE_REQUEST, true);
    syncTrigger(s, CHAT_CLOSED_PREFIX, CHAT_CLOSED, true);
  }
  if (s.build.devConsole) {
    const chat = CreateTrigger();
    for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerChatEvent(chat, Player(slot), "-dev ", false);
    TriggerAddAction(chat, trampoline(DEV_COMMAND));
  }
  const leave = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) TriggerRegisterPlayerEvent(leave, Player(slot), EVENT_PLAYER_LEAVE);
  TriggerAddAction(leave, trampoline(PLAYER_LEFT));
  TimerStart(CreateTimer(), FRAME_SECONDS, true, trampoline(TICK));
}

/** The playable map's center, with the floor FLOOR_HEIGHT above the ground there. */
function worldOrigin(): { x: number; y: number; z: number } {
  const center = GetRectCenter(GetPlayableMapRect());
  const origin = { x: GetLocationX(center), y: GetLocationY(center), z: GetLocationZ(center) + FLOOR_HEIGHT };
  RemoveLocation(center);
  return origin;
}

/** Custom frames and fonts need the running game UI, so initialization waits for the first timer. */
function initialize(): void {
  DestroyTimer(GetExpiredTimer());
  const pending = globalThis.__smashcraftShellStart;
  if (pending === undefined || shellState() !== undefined) return;
  globalThis.__smashcraftShellStart = undefined;
  const { build } = pending;
  const origin = worldOrigin();
  BlzHideOriginFrames(true);
  // The panels' frame templates come from this table of contents.
  if (!BlzLoadTOCFile("war3mapImported\\SmashcraftHUD.toc")) DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, "Smashcraft's menus could not load. Restart the game.");
  BlzEnableSelections(false, false);
  EnableUserControl(true);
  FogEnable(false);
  FogMaskEnable(false);
  const s = createShellState(build, {
    origin, frames: createStatusFrames(build), persistence: bindingFiles, playback: pending.playback,
    editbox: journalIngress(build) === "editbox" ? new EditboxIngress() : undefined,
  });
  setParticipants(s.game, currentHumanMask(0), currentComputerMask());
  chooseScenarioCharacters(build.scenario, s.game);
  createUi(s, panelActions());
  drawStage(s);
  CameraSetSmoothingFactor(0.0);
  SetTimeOfDay(12.0);
  SetTimeOfDayScale(0.0);
  SetSkyModel("Environment\\Sky\\LordaeronSummerSky\\LordaeronSummerSky.mdl");
  startPlayerFiles();
  makePreview(s);
  lockArenaCamera(s);
  renderUi(s);
  createTriggers(s);
  for (const participant of s.participants) {
    if (humanActive(s.game, participant.slot)) initializeBindingSettings(participant.bindings);
    else useDefaultBindings(participant.bindings);
  }
}

/** Runs a handler on the shell's state once it exists. */
function withShell(handler: (s: ShellState) => void): () => void {
  return () => {
    const s = shellState();
    if (s !== undefined) handler(s);
  };
}

/** Registers every shell callback; after a hot reload, also rebinds retained UI objects. */
export function installShell(): void {
  on(INIT, initialize);
  on(TICK, withShell(gameTick));
  on(KEY_DOWN, withShell(onKeyDown));
  on(KEY_UP, withShell(onKeyUp));
  on(INPUT, withShell(receiveInput));
  on(CONTROL_ACK, withShell(receiveControlAckEvent));
  on(PAUSE_REQUEST, withShell(pauseRequestEvent));
  on(CHAT_CLOSED, withShell(chatClosedEvent));
  on(EDITBOX_ENTER, withShell(chatEntered));
  on(DEV_COMMAND, withShell(onDevCommand));
  on(PLAYER_LEFT, withShell(playerLeft));
  on(RESTART, withShell(onDeveloperRestart));
  on(TRACE, withShell(onDeveloperTrace));
  on(PROBE_START, withShell(s => onProbeStart(s, false)));
  on(PROBE_EDGES, withShell(s => onProbeStart(s, true)));
  on(PROBE_DUMP, withShell(onProbeExport));
  on(PROBE_EXPORT, withShell(s => { if (s.probe !== undefined) exportProbePage(s.probe); }));
  on(PLAYER_FILE_RECEIVED, playerFileReceived);
  const s = shellState();
  if (s?.ui !== undefined) recreateUi(s, panelActions());
}

/** Starts the shell once, when the map starts. */
export function startShell(build: MapBuild, playback: RollbackPlayback): void {
  globalThis.__smashcraftShellStart = { build, playback };
  TimerStart(CreateTimer(), 0.0, false, trampoline(INIT));
}
