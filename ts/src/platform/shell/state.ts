// The native shell's state. Everything a running match needs lives in one
// global record, so a hot reload keeps the match and the new bundle's code
// works on it. Handles are owned by the record that destroys them; the UI and
// renderer objects keep the code they were created with, so a reload
// recreates them (ui.ts).
import type { CryGate } from "../../game/presentation/hurtVoice";
import type { StageLoad } from "../../game/shell/stageLoad";
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
import { InputBatch } from "../../game/netcode/inputBatch";
import type { KeyboardMailbox } from "../../game/netcode/journal/keyboard";
import type { MatchLifecycle } from "../../game/netcode/journal/lifecycle";
import type { JournalInputSource } from "../../game/netcode/journal/source";
import { DEFAULT_BATCH, OutgoingInput } from "../../game/netcode/journal/transport";
import { ShadowInputSchedule } from "../../game/netcode/shadowSchedule";
import type { WorldOrigin } from "../../game/render/effects";
import { type ModelSoundCursor, ORIGINAL_MODEL_SOUNDS, createModelSoundCursor } from "../../game/render/modelSounds";
import { type MomentRecorder, createMomentRecorder } from "../../game/replay/moment";
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

/** The unit a fighter animates when no pool presents it, and its dizzy mark. */
export interface FighterBody {
  readonly unit: unit;
  dizzy: effect | undefined;
  /** The pose selection the unit last played. */
  renderedSelection: number;
  /** When its hero may cry out; created on first use, so a body retained across a reload gains it. */
  cry?: CryGate;
}

/** What a fighter was before a frame, compared after it to announce and trace changes. */
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
  /** Present while the slot has a fighter on the stage or in the preview. */
  body: FighterBody | undefined;
  /** The pool presents this match's fighter, and the unit stays hidden. */
  pooled: boolean;
  /** Keys from synchronized key events, for menus and callback matches. */
  readonly keys: PlayerKeys;
  /** The callback match's sampler of those keys. */
  readonly capture: KeyboardCapture;
  readonly bindings: BindingSettings;
  appliedBindingRevision: number | undefined;
  lastInputAction: Action | undefined;
  /** The attack style the last callback-match press queued. */
  lastNormalStyle: number | undefined;
  readonly before: FrameObservation;
}

/** Stamps of the local rows waiting in a keyboard batch, for the trace. */
interface CaptureStamp {
  traced: boolean;
  callback: number;
  seconds: number;
}

/** Keyboard rollback: the keys polled each callback, and the rows waiting to be sent. */
export interface KeyboardRollback {
  readonly capture: KeyboardCapture;
  /** Built per epoch. */
  outgoing: InputBatch;
  lastTarget: number | undefined;
  readonly stamps: [CaptureStamp, CaptureStamp];
  readonly pairedSends: boolean;
}

/** Journal input: the helper's rows for this client, their transport and the barriers every human crosses. */
export interface Journal {
  readonly ingress: JournalIngress;
  /** Opened per epoch. */
  source: JournalInputSource | undefined;
  failed: boolean;
  readonly outgoing: OutgoingInput;
  /** Humans whose helper is ready this epoch, or who play it on the keyboard. */
  readyMask: number;
  /** Humans who play this epoch on the keyboard because their helper never reported ready. */
  keyboardMask: number;
  /** Callbacks this epoch has waited for the local helper to report ready. */
  readyWait: number;
  /** The local player's keys while they play on the keyboard. */
  readonly keys: KeyboardCapture;
  /** The last frame the local keyboard's clock has reached: one more each running callback. */
  keyClock: number;
  /** While a pause is prepared or in effect, the frame the local keyboard's rows stop before. */
  keyStop: number | undefined;
  /** The pause round the local keyboard answered last; it answers each round once. */
  keyAnswered: PauseBarrier["request"];
  /** Preallocated: the packet that carries the local keyboard's next row. */
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
  mailbox: KeyboardMailbox | undefined;
}

/** Rollback input: synchronized rows, the confirmed cursor, and a speculative match for presentation. */
export interface Rollback {
  readonly mode: ShadowInputMode;
  /** False until an epoch starts, and after a player leaves it. */
  active: boolean;
  epoch: number;
  /** Settings fixed for the running epoch. */
  delay: FixedDelay;
  window: number;
  /** Callbacks per synchronized input message. */
  batch: number;
  readonly schedule: ShadowInputSchedule;
  readonly playback: RollbackPlayback;
  readonly speculative: SpeculativeMatch;
  readonly seed: ReplayState;
  readonly accepted: ParticipantInputs;
  sendFailed: boolean;
  readonly keyboard: KeyboardRollback | undefined;
  readonly journal: Journal | undefined;
  /** Consecutive callbacks the match has waited for players' input; local presentation. */
  stalled: number;
  /** Humans every client names while the match waits for their input; 0 while it runs. */
  waitingFor: number;
  /**
   * Prediction stopped at a remote row R frames behind it, and a keyboard
   * press still awaits capture or journal rows have not drained. The response
   * probe reports presses captured then apart (#60).
   */
  predictionHeld: boolean;
}

export interface StatusFrames {
  readonly help: framehandle;
  readonly notice: framehandle;
  /** Only a build with the developer console has the developer line. */
  readonly developer: framehandle | undefined;
}

interface StatusLine {
  text: string;
  /** Seconds the text stays; long for messages that wait for the players. */
  seconds: number;
}

/** The confirmed match's recent moments, which this client's player can save for `bun wisp repro`. */
interface MomentSaves {
  readonly recorder: MomentRecorder;
  /** Moments this client saved, which names the next file. */
  saved: number;
  /** Seconds the player still sees that their moment was saved; local presentation. */
  notice: number;
}

export const momentSaves = (): MomentSaves => ({ recorder: createMomentRecorder(), saved: 0, notice: 0.0 });

/** The match being recorded as a replay (replays.ts). */
export interface ReplayRecording {
  readonly recorder: MatchReplayRecorder;
  /** The open replay's serial. */
  serial: number;
  /** The serial the match's record takes, until it is written. */
  recordSerial: number | undefined;
}

export const replayRecording = (): ReplayRecording => ({ recorder: createMatchReplayRecorder(), serial: 0, recordSerial: undefined });

/** Key triggers for every key, which exist only while keys drive menus or a callback match. */
interface KeyEvents {
  down: trigger | undefined;
  up: trigger | undefined;
}

export interface ShellState {
  menuPublication?: { phase: MenuPhase; ticks: number };
  readonly pad: NativePadCapture | undefined;
  /** Synchronized menu callbacks salt the random stage draw; retained across reloads. */
  menuFrames?: number;
  readonly camera: MatchCamera;
  readonly build: MapBuild;
  /** The world point the simulation's origin maps to: stage center and floor height. */
  readonly origin: WorldOrigin;
  readonly game: MatchState;
  /** The confirmed match: the only state synchronized decisions read. */
  readonly world: Roster;
  readonly controls: FrameControls;
  /** Callback matches adapt keys into these before a frame captures them. */
  readonly produced: FrameControls;
  readonly runtime: PacingAndPresentation;
  /** Pause and Start keys; outside replay state, so rollback never undoes a pause. */
  readonly session: MatchControls;
  readonly frameInput: MatchFrameInput;
  readonly participants: Slots<Participant>;
  readonly status: StatusLine;
  readonly frames: StatusFrames;
  readonly stageDecks: effect[];
  /** The stage whose decks and cannon are drawn. */
  drawnStage: number;
  stageCannon: effect | undefined;
  stageScenery: effect[] | undefined;
  /** Menus, HUD and renderers; retained and rebound on hot reload. */
  ui: UiObjects | undefined;
  readonly sounds: ModelSoundCursor;
  readonly dev: DevSettings;
  devReceipts: number;
  readonly trace: InputTrace;
  readonly probe: ResponseProbe | undefined;
  readonly rollback: Rollback | undefined;
  readonly keyEvents: KeyEvents;
  readyMarkerWritten: boolean;
  restartRequested: boolean;
  /** Checksums capture the confirmed match here. */
  readonly diagnostic: ReplayState;
  /** Assigned again when a reload finds a match from a bundle without it. */
  moment: MomentSaves;
  /** Assigned again when a reload finds a match from a bundle without it. */
  replay: ReplayRecording;
  /** The stage-loading screen between the start press and the match (stageLoad.ts). */
  stageLoad?: StageLoad | undefined;
}

declare global {
  var __smashcraftShell: ShellState | undefined;
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

/** Four fighters in stable slots, which each epoch's seed overwrites before any frame runs. */
function speculativeRoster(): Roster {
  return createRoster(3, PARTICIPANT_SLOTS.map(slot => createFighter(slot === 3 ? 0 : slot, matchSpawnX(slot), slot === 0 || slot === 2 ? 1 : -1)));
}

function journal(ingress: JournalIngress, editbox: EditboxIngress | undefined): Journal {
  const keys = keyboardCapture();
  return {
    ingress, source: undefined, failed: false, outgoing: new OutgoingInput(), readyMask: 0, keyboardMask: 0, readyWait: 0, keys,
    keyClock: 0, keyStop: undefined, keyAnswered: undefined, keyPacket: { epoch: 0, firstFrame: 1, rows: [keys.row] }, startSent: false, lifecycle: undefined,
    endSent: false, endReceived: false, quiescent: false, chatRequested: [false, false, false, false], chatSerial: [0, 0, 0, 0],
    barrier: pauseBarrier(), editbox, mailbox: undefined,
  };
}

function rollback(mode: ShadowInputMode, playback: RollbackPlayback, editbox: EditboxIngress | undefined): Rollback {
  return {
    mode, active: false, epoch: 0, delay: mode.delay, window: mode.rollback, batch: DEFAULT_BATCH,
    schedule: new ShadowInputSchedule(), playback,
    speculative: { world: speculativeRoster(), game: createMatchState(), controls: createBufferedFrameControls(), runtime: createPacingAndPresentation() },
    seed: createReplaySnapshot(), accepted: participantInputs(), sendFailed: false,
    keyboard: mode.kind === "keyboard"
      ? {
        capture: keyboardCapture(), outgoing: new InputBatch(0), lastTarget: undefined, pairedSends: mode.pairedSends,
        stamps: [{ traced: false, callback: 0, seconds: 0.0 }, { traced: false, callback: 0, seconds: 0.0 }],
      }
      : undefined,
    journal: mode.kind === "journal" ? journal(mode.ingress, editbox) : undefined,
    stalled: 0, waitingFor: 0, predictionHeld: false,
  };
}

interface ShellSetup {
  readonly origin: WorldOrigin;
  readonly frames: StatusFrames;
  readonly persistence: BindingPersistence;
  readonly playback: RollbackPlayback;
  /** The edit box, created on every client, when the build reads journal text from one. */
  readonly editbox: EditboxIngress | undefined;
}

/** Builds the shell's record once, on every client, after the game UI exists. */
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
    status: { text: "", seconds: 0.0 }, frames: setup.frames, stageDecks: [], drawnStage: 0, stageCannon: undefined, stageScenery: undefined, ui: undefined,
    sounds: createModelSoundCursor(ORIGINAL_MODEL_SOUNDS),
    dev: { rollback: isShadow(input) ? input.rollback : 6, delay: isShadow(input) ? input.delay : 3, batch: DEFAULT_BATCH, rematchSeconds: REMATCH_COUNTDOWN_SECONDS }, devReceipts: 0,
    trace: inputTrace(build.responseProbe || build.inputProfile === "native-driver" ? 2048 : 256),
    probe: build.responseProbe ? createResponseProbe(build.id) : undefined,
    rollback: isShadow(input) ? rollback(input, setup.playback, setup.editbox) : undefined,
    keyEvents: { down: undefined, up: undefined }, readyMarkerWritten: false, restartRequested: false,
    diagnostic: createReplaySnapshot(), moment: momentSaves(), replay: replayRecording(),
  };
  // Live history, every saved-moment owner, rollback and correction storage.
  const moments = state.moment.recorder;
  reserveBotObservations(state.runtime.botMemory,
    BOT_HISTORY_FRAMES * (moments.snapshots.length + 4) + REPLAY_HISTORY_CAPACITY + 2 * REPLAY_MAX_CORRECTION_FRAMES);
  globalThis.__smashcraftShell = state;
  return state;
}

/** The rollback session while an epoch runs. */
export function activeRollback(state: Readonly<ShellState>): Rollback | undefined {
  return state.rollback?.active === true ? state.rollback : undefined;
}

export function localSlot(): number {
  return GetPlayerId(GetLocalPlayer());
}

/** Whether the player in slot plays this journal epoch on the keyboard; every client knows it. */
export function playsOnKeyboard(journal: Readonly<Journal> | undefined, slot: number): boolean {
  return journal !== undefined && participantActive(journal.keyboardMask, slot);
}
