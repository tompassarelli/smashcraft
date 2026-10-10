




import type { CryGate } from "../../game/presentation/hurtVoice";
import type { StageLoad } from "../../game/shell/stageLoad";
import type { CameraExtreme } from "../../game/presentation/arenaCamera";
import type { Action } from "../../game/input/actions";
import { type KeyboardCapture, keyboardCapture } from "../../game/input/keyboardCapture";
import { PARTICIPANT_SLOTS, type ParticipantInputs, type ParticipantSlot, type Slots, participantActive, participantInputs } from "../../game/input/participants";
import { type PlayerKeys, playerKeys } from "../../game/input/playerKeys";
import type { InputPacket } from "../../game/input/wire";
import { type FrameControls, type MatchControls, createBufferedFrameControls, createFrameControls, createMatchControls } from "../../game/match/controls";
import { type MatchFrameInput, createMatchFrameInput } from "../../game/match/frameInput";
import { type PacingAndPresentation, createPacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { BOT_HISTORY_FRAMES, reserveBotObservations } from "../../game/match/botPerception";
import { REPLAY_HISTORY_CAPACITY, REPLAY_MAX_CORRECTION_FRAMES } from "../../game/replay/limits";
import { type MatchState, REMATCH_COUNTDOWN_SECONDS, createMatchState } from "../../game/match/rules";
import { matchSpawnX } from "../../game/match/step";
import { createMatchCamera, type MatchCamera } from "../../game/sim/matchCamera";
import type { FixedDelay } from "../../game/netcode/fixedSchedule";
import { type NetDelay, createNetDelay } from "./netDelay";
import { InputBatch } from "../../game/netcode/inputBatch";
import type { KeyboardMailbox } from "../../game/netcode/journal/keyboard";
import type { MatchLifecycle } from "../../game/netcode/journal/lifecycle";
import type { JournalInputSource } from "../../game/netcode/journal/source";
import { DEFAULT_BATCH, OutgoingInput } from "../../game/netcode/journal/transport";
import { PENDING_CAPACITY, ShadowInputSchedule } from "../../game/netcode/shadowSchedule";
import type { WorldOrigin } from "../../game/render/effects";
import { type ModelSoundCursor, ORIGINAL_MODEL_SOUNDS, createModelSoundCursor } from "../../game/render/modelSounds";
import { type MomentRecorder, createMomentRecorder, keepMomentEnd } from "../../game/replay/moment";
import { type MatchReplayRecorder, createMatchReplayRecorder } from "../../game/replay/matchReplay";
import { type ReplayState, createReplaySnapshot } from "../../game/replay/snapshot";
import { type JournalIngress, type MapBuild, type ShadowInputMode, isShadow } from "../../game/shell/build";
import type { DevSettings } from "../../game/shell/devSettings";
import type { MenuPhase } from "../../game/shell/journalFiles";
import { type PauseBarrier, pauseBarrier } from "../../game/shell/pauseBarrier";
import type { RollbackPlayback, SpeculativeMatch } from "../../game/shell/playback";
import type { DownState, GrabAction, LedgeState, ShieldBreak, SpecialAction } from "../../game/sim/codes";
import { createFighter } from "../../game/sim/fighter";
import { type Roster, createRoster } from "../../game/sim/roster";
import { type BindingPersistence, type BindingSettings, createBindingSettings } from "../../game/ui/bindingSettings";
import type { EditboxIngress } from "../editboxJournal";
import { type ResponseProbe, createResponseProbe } from "./responseProbe";
import { type InputTrace, inputTrace } from "./trace";
import type { UiObjects } from "./ui";
import type { NativePadCapture } from "./analogPad";


export interface FighterBody {
  readonly unit: unit;
  dizzy: effect | undefined;

  renderedSelection: number;

  cry?: CryGate;
}


export interface FrameObservation {
  out: boolean;
  holding: boolean;
  actionable: boolean;
  attack: number;
  jump: number;
  down: DownState;
  shieldBreak: number;
  breakState: ShieldBreak;
  ledge: LedgeState;
  special: SpecialAction;
  grab: GrabAction;
  di: number;
  damage: number;
  form: number;
  ground: number;
  facing: number;
  shieldRaised: boolean;
  shieldTiltX: number;
  shieldTiltZ: number;
}

interface Participant {
  readonly slot: ParticipantSlot;

  body: FighterBody | undefined;

  pooled: boolean;

  readonly keys: PlayerKeys;

  readonly capture: KeyboardCapture;
  readonly bindings: BindingSettings;
  appliedBindingRevision: number | undefined;
  lastInputAction: Action | undefined;

  lastNormalStyle: number | undefined;
  readonly before: FrameObservation;
}


interface CaptureStamp {
  traced: boolean;
  callback: number;
  seconds: number;
}


export interface KeyboardRollback {
  readonly capture: KeyboardCapture;

  outgoing: InputBatch;
  nextSend: number;
  lastTarget: number | undefined;
  readonly stamps: CaptureStamp[];
  readonly pairedSends: boolean;
}


export interface Journal {
  readonly ingress: JournalIngress;

  source: JournalInputSource | undefined;
  failed: boolean;
  readonly outgoing: OutgoingInput;

  readyMask: number;

  keyboardMask: number;

  readyWait: number;

  readonly keys: KeyboardCapture;

  keyClock: number;

  keyStop: number | undefined;

  keyAnswered: PauseBarrier["request"];

  readonly keyPacket: InputPacket;
  startSent: boolean;
  lifecycle: MatchLifecycle | undefined;
  endSent: boolean;
  endReceived: boolean;
  quiescent: boolean;
  readonly chatRequested: Slots<boolean>;
  readonly chatSerial: Slots<number>;
  readonly barrier: PauseBarrier;
  readonly editbox: EditboxIngress | undefined;




  readonly setAside: string[];
  mailbox: KeyboardMailbox | undefined;
}


export interface Rollback {
  readonly mode: ShadowInputMode;

  active: boolean;
  epoch: number;

  delay: FixedDelay;
  window: number;

  batch: number;
  readonly net: NetDelay;
  readonly schedule: ShadowInputSchedule;
  readonly playback: RollbackPlayback;
  readonly speculative: SpeculativeMatch;
  readonly seed: ReplayState;
  readonly accepted: ParticipantInputs;
  sendFailed: boolean;
  readonly keyboard: KeyboardRollback | undefined;
  readonly journal: Journal | undefined;

  stalled: number;

  waitingFor: number;





  predictionHeld: boolean;






  knownBefore: number;

  repairedFrames: number;
}

export interface StatusFrames {
  readonly help: framehandle;
  readonly notice: framehandle;
}

interface StatusLine {
  text: string;

  seconds: number;
}


interface MomentSaves {
  readonly recorder: MomentRecorder;

  saved: number;

  notice: number;
}

export const momentSaves = (): MomentSaves => ({ recorder: createMomentRecorder(), saved: 0, notice: 0.0 });

/** Keeps the moment recorder's end at the shell's current frame. */
export function keepShellMomentEnd(s: ShellState): void {
  keepMomentEnd(s.moment.recorder, s.world, s.game, s.controls, s.runtime);
}


export interface ReplayRecording {
  readonly recorder: MatchReplayRecorder;

  serial: number;

  recordSerial: number | undefined;
}

export const replayRecording = (): ReplayRecording => ({ recorder: createMatchReplayRecorder(), serial: 0, recordSerial: undefined });


interface KeyEvents {
  down: trigger | undefined;
  up: trigger | undefined;

  escapeOnly: boolean;
}

export interface ShellState {
  pauseCamera?: import("./pauseCamera").PauseCamera | undefined;
  pauseMenu?: { choice: number; shown: boolean; title: boolean };
  titleAwaitRelease?: boolean;
  trainingHints?: boolean;
  pauseSelection?: MatchState;
  pauseKeysHeld?: number[];
  menuPublication?: { phase: MenuPhase; ticks: number };
  readonly pad: NativePadCapture | undefined;

  menuFrames?: number;
  readonly camera: MatchCamera;
  cameraTween?: boolean;

  resumePresentationUntil?: number | undefined;
  readonly build: MapBuild;

  readonly origin: WorldOrigin;
  game: MatchState;

  world: Roster;
  controls: FrameControls;

  readonly produced: FrameControls;
  runtime: PacingAndPresentation;

  ownedConfirmed?: ReplayState | undefined;

  readonly session: MatchControls;
  readonly frameInput: MatchFrameInput;
  readonly participants: Slots<Participant>;
  readonly status: StatusLine;
  readonly frames: StatusFrames;
  readonly stageDecks: effect[];

  readonly stageDeckParts: effect[];

  drawnStage: number;
  stageCannon: effect | undefined;

  stageLava: effect | undefined;
  stageWind: effect[];
  stageHydra?: effect[];
  stageScenery: effect[] | undefined;
  shadowLightsRaised: boolean;

  viewExtreme: CameraExtreme | undefined;

  ui: UiObjects | undefined;
  readonly sounds: ModelSoundCursor;
  readonly dev: DevSettings;
  devReceipts: number;
  promoHudHidden?: boolean;
  readonly trace: InputTrace;
  readonly probe: ResponseProbe | undefined;
  readonly rollback: Rollback | undefined;
  readonly keyEvents: KeyEvents;
  readyMarkerWritten: boolean;
  restartRequested: boolean;

  readonly diagnostic: ReplayState;

  moment: MomentSaves;

  replay: ReplayRecording;

  stageLoad?: StageLoad | undefined;
}

declare global {
  var __smashcraftShell: ShellState | undefined;
  var __smashcraftPlaytest: { request: string | undefined; looked: number; sent: boolean; cancelled: boolean } | undefined;
}

export const playtestProgress = () => (globalThis.__smashcraftPlaytest ??= { request: undefined, looked: 0, sent: false, cancelled: false });


export function cancelPendingPlaytest(): void {
  playtestProgress().cancelled = true;
}

export function shellState(): ShellState | undefined {
  return globalThis.__smashcraftShell;
}

export function shell(): ShellState {
  const state = globalThis.__smashcraftShell;
  if (state === undefined) throw new Error("shell used before start");
  return state;
}

function observation(): FrameObservation {
  return { out: false, holding: false, actionable: false, attack: 0, jump: 0, down: 0, shieldBreak: 0, breakState: 0, ledge: 0, special: 0, grab: 0, di: 0, damage: 0, form: 0, ground: 0, facing: 0, shieldRaised: false, shieldTiltX: 0.0, shieldTiltZ: 0.0 };
}

function participant(slot: ParticipantSlot, persistence: BindingPersistence): Participant {
  return {
    slot, body: undefined, pooled: false, keys: playerKeys(), capture: keyboardCapture(), bindings: createBindingSettings(slot, persistence),
    appliedBindingRevision: undefined, lastInputAction: undefined, lastNormalStyle: undefined, before: observation(),
  };
}


function speculativeRoster(): Roster {
  return createRoster(3, PARTICIPANT_SLOTS.map(slot => createFighter(slot === 0 ? 1 : slot === 1 ? 2 : slot === 2 ? 3 : 5, matchSpawnX(slot), slot === 0 || slot === 2 ? 1 : -1)));
}

function journal(ingress: JournalIngress, editbox: EditboxIngress | undefined): Journal {
  const keys = keyboardCapture();
  return {
    ingress, source: undefined, failed: false, outgoing: new OutgoingInput(), readyMask: 0, keyboardMask: 0, readyWait: 0, keys,
    keyClock: 0, keyStop: undefined, keyAnswered: undefined, keyPacket: { epoch: 0, firstFrame: 1, rows: [keys.row] }, startSent: false, lifecycle: undefined,
    endSent: false, endReceived: false, quiescent: false, chatRequested: [false, false, false, false], chatSerial: [0, 0, 0, 0],
    barrier: pauseBarrier(), editbox, setAside: [], mailbox: undefined,
  };
}

function rollback(mode: ShadowInputMode, playback: RollbackPlayback, editbox: EditboxIngress | undefined): Rollback {
  return {
    mode, active: false, epoch: 0, delay: mode.delay, window: mode.rollback, batch: DEFAULT_BATCH, net: createNetDelay(mode.rollback),
    schedule: new ShadowInputSchedule(), playback,
    speculative: { world: speculativeRoster(), game: createMatchState(), controls: createBufferedFrameControls(), runtime: createPacingAndPresentation() },
    seed: createReplaySnapshot(), accepted: participantInputs(), sendFailed: false,
    keyboard: mode.kind === "keyboard"
      ? {
        capture: keyboardCapture(), outgoing: new InputBatch(0), nextSend: 1, lastTarget: undefined, pairedSends: mode.pairedSends,
        stamps: Array.from({ length: PENDING_CAPACITY }, () => ({ traced: false, callback: 0, seconds: 0.0 })),
      }
      : undefined,
    journal: mode.kind === "journal" ? journal(mode.ingress, editbox) : undefined,
    stalled: 0, waitingFor: 0, predictionHeld: false, knownBefore: 0, repairedFrames: 0,
  };
}

interface ShellSetup {
  readonly origin: WorldOrigin;
  readonly frames: StatusFrames;
  readonly persistence: BindingPersistence;
  readonly playback: RollbackPlayback;

  readonly editbox: EditboxIngress | undefined;
}


export function createShellState(build: MapBuild, setup: ShellSetup): ShellState {
  const { input } = build;
  const { persistence } = setup;
  const state: ShellState = {
    pad: build.analogPad === undefined ? undefined : { calibration: { first: undefined, last: undefined }, packet: undefined, mouseEvents: 0, syncEvents: 0, startedAt: 0.0, rows: [], mouse: [] },
    camera: createMatchCamera(),
    build, origin: setup.origin, game: createMatchState(), world: createRoster(0), controls: createBufferedFrameControls(),
    produced: createFrameControls(), runtime: createPacingAndPresentation(), session: createMatchControls(),
    frameInput: createMatchFrameInput(),
    participants: [participant(0, persistence), participant(1, persistence), participant(2, persistence), participant(3, persistence)],
    status: { text: "", seconds: 0.0 }, frames: setup.frames, stageDecks: [], stageDeckParts: [], drawnStage: 0, stageCannon: undefined, stageLava: undefined, stageWind: [], stageScenery: undefined, shadowLightsRaised: false, viewExtreme: undefined, ui: undefined,
    sounds: createModelSoundCursor(ORIGINAL_MODEL_SOUNDS),
    dev: { rollback: isShadow(input) ? input.rollback : 6, delay: isShadow(input) ? input.delay : 3, batch: DEFAULT_BATCH, rematchSeconds: REMATCH_COUNTDOWN_SECONDS }, devReceipts: 0,
    trace: inputTrace(build.responseProbe || build.inputProfile === "native-driver" ? 2048 : 256),
    probe: build.responseProbe ? createResponseProbe(build.id) : undefined,
    rollback: isShadow(input) ? rollback(input, setup.playback, setup.editbox) : undefined,
    keyEvents: { down: undefined, up: undefined, escapeOnly: false }, readyMarkerWritten: false, restartRequested: false,
    diagnostic: createReplaySnapshot(), moment: momentSaves(), replay: replayRecording(),
  };

  const moments = state.moment.recorder;
  reserveBotObservations(state.runtime.botMemory,
    BOT_HISTORY_FRAMES * (moments.snapshots.length + 4) + REPLAY_HISTORY_CAPACITY + 2 * REPLAY_MAX_CORRECTION_FRAMES);
  globalThis.__smashcraftShell = state;
  return state;
}


export function activeRollback(state: Readonly<ShellState>): Rollback | undefined {
  return state.rollback?.active === true ? state.rollback : undefined;
}

export function localSlot(): number {
  return GetPlayerId(GetLocalPlayer());
}


export function playsOnKeyboard(journal: Readonly<Journal> | undefined, slot: number): boolean {
  return journal !== undefined && participantActive(journal.keyboardMask, slot);
}
