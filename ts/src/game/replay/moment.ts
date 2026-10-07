// A moment of play for `bun wisp repro` (wisp:docs/repro.md). Every client
// keeps the last ten to twelve seconds of its confirmed match: a snapshot
// every two seconds and each human's input row for every frame since the
// oldest. A player saves the latest snapshot at least ten seconds back and
// every row since; replayRepro restores that snapshot and runs the rows
// through the frame executor the match ran, to the checksum the game recorded.
import { at } from "wisp/src/runtime/lookup";
import { lineTokens, parseRecord, recordTokens, tokenLines } from "wisp/src/runtime/recordText";
import { REPRO_LINE_WIDTH, type Repro, type ReproResult } from "wisp/src/runtime/repro";
import { floorMod } from "wisp/src/sim/intMath";
import { adaptInput } from "../input/adapter";
import { type AttackBuffer, clearAttackBuffer } from "../input/attackBuffer";
import { INPUT_ROW_NUMBERS, type InputRow, emptyInput, loadInputNumbers, storeInputNumbers } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type ParticipantInputs, type Slots, participantActive } from "../input/participants";
import { type FrameControls, createFrameControls } from "../match/controls";
import { padDecimal } from "../netcode/journal/decimal";
import { type MatchFrameInput, captureFrame, captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import { type MatchState, computerActive } from "../match/rules";
import { type MapBuild, type Scenario, isScenario, isShadow } from "../shell/build";
import { produceScenarioComputerInput } from "../shell/scenarios";
import { type Fighter, PROJECTILE_CAPACITY } from "../sim/fighter";
import type { AuthoredSpecial, FighterSpecials, SpecialPlacement, SpecialProjectile } from "../sim/heroSpecials";
import { type Roster, createRoster, fighterAt, isActive } from "../sim/roster";
import { authoredTuning } from "../sim/tuning";
import { fighterSpecialsCanonical, specialPlacementCanonical, specialProjectileCanonical, stateChecksum } from "./canonical";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "./snapshot";

/** Frames between snapshots: two seconds. */
export const SNAPSHOT_FRAMES = 120;
const SNAPSHOTS = 6;
/** A moment starts at the latest snapshot at least this many frames, ten seconds, before its end. */
export const MOMENT_FRAMES = 600;
/** Frames of rows each slot keeps: every frame since the oldest snapshot. */
export const ROW_FRAMES = SNAPSHOT_FRAMES * SNAPSHOTS;
/** Characters before a line's tokens: its section word and a space. */
const SECTION_WIDTH = 6;

/** How the match's frames got their controls: synchronized rows, or keys adapted on the game callback, with the build's scenario. */
export type MomentInput = { readonly kind: "network" } | { readonly kind: "callback"; readonly scenario: Scenario };

/** A controller helper's journal record asking to save a moment: "JM1" and the epoch in ten digits. */
const MOMENT_REQUEST = "JM1";
export const momentRequest = (epoch: number) => `${MOMENT_REQUEST}${padDecimal(epoch, 10)}`;
export const isMomentRequest = (wire: string) => wire.startsWith(MOMENT_REQUEST);

export const momentInput = (build: Readonly<MapBuild>): MomentInput => (isShadow(build.input) ? { kind: "network" } : { kind: "callback", scenario: build.scenario });

/**
 * A save in progress. Its checksums and the snapshot's text each take a few
 * milliseconds of Lua, so continueMomentSave does one per frame; what the
 * record would overwrite meanwhile is copied when the save begins.
 */
interface MomentSave {
  readonly input: MomentInput;
  readonly start: number;
  readonly last: number;
  /** The snapshots after the start, by ring position; a position the record reuses meanwhile is left out. */
  readonly checkpoints: readonly number[];
  readonly checkpointFrames: readonly number[];
  /** The rows, encoded when the save began. */
  readonly rows: readonly string[];
  readonly lines: string[];
  checksum: string;
  step: number;
}

export interface MomentRecorder {
  /** Preallocated: the match keeps one every two seconds. */
  readonly snapshots: ReplayState[];
  /** The frame after which each snapshot holds the match; -1 for none since the record started. */
  readonly snapshotFrames: number[];
  nextSnapshot: number;
  /** Preallocated: per slot, INPUT_ROW_NUMBERS numbers for each kept frame, at its frame modulo ROW_FRAMES. */
  readonly rows: Slots<number[]>;
  /** The frame each ring position holds, and the slots with a row for it. */
  readonly rowFrames: number[];
  readonly rowMasks: number[];
  /** The last frame the match ran; every frame since the record started ran in order. */
  last: number | undefined;
  /**
   * The match as the last frame left it, once the shell changed it between
   * frames (a pause or a match end clears the attack buffers): the moment ends
   * there, and the next frame starts the record again.
   */
  end: ReplayState;
  ended: boolean;
  /** Preallocated: a save's starting snapshot and final match, copied when it begins. */
  saveStart: ReplayState;
  saveEnd: ReplayState;
  save: MomentSave | undefined;
}

function filled(count: number, value: number): number[] {
  const numbers: number[] = [];
  for (let index = 0; index < count; index++) numbers.push(value);
  return numbers;
}

export function createMomentRecorder(): MomentRecorder {
  const snapshots: ReplayState[] = [];
  for (let index = 0; index < SNAPSHOTS; index++) snapshots.push(createReplaySnapshot());
  const ring = () => filled(ROW_FRAMES * INPUT_ROW_NUMBERS, 0);
  return {
    snapshots, snapshotFrames: filled(SNAPSHOTS, -1), nextSnapshot: 0,
    rows: [ring(), ring(), ring(), ring()], rowFrames: filled(ROW_FRAMES, -1), rowMasks: filled(ROW_FRAMES, 0), last: undefined,
    end: createReplaySnapshot(), ended: false, saveStart: createReplaySnapshot(), saveEnd: createReplaySnapshot(), save: undefined,
  };
}

/**
 * Back to createMomentRecorder's state. Snapshots keep only the slots a match
 * plays, so a slot an earlier match used (a computer) would stay in later
 * moments' starting states; `-dev reset` starts from new storage instead.
 */
export function resetMomentRecorder(recorder: MomentRecorder): void {
  for (let index = 0; index < SNAPSHOTS; index++) recorder.snapshots[index] = createReplaySnapshot();
  recorder.snapshotFrames.fill(-1);
  recorder.nextSnapshot = 0;
  for (const ring of recorder.rows) ring.fill(0);
  recorder.rowFrames.fill(-1);
  recorder.rowMasks.fill(0);
  recorder.last = undefined;
  recorder.end = createReplaySnapshot();
  recorder.ended = false;
  recorder.saveStart = createReplaySnapshot();
  recorder.saveEnd = createReplaySnapshot();
  recorder.save = undefined;
}

/**
 * Before the match runs `frame`: a frame out of order (a new match), or the
 * first after the shell changed the match between frames, starts the record
 * again; every two seconds the match is kept as it stands.
 */
export function beginMomentFrame(recorder: MomentRecorder, frame: number, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  const restart = recorder.last === undefined || recorder.ended || frame !== recorder.last + 1;
  if (restart) {
    recorder.snapshotFrames.fill(-1);
    recorder.last = undefined;
    recorder.ended = false;
  } else if (floorMod(frame - 1, SNAPSHOT_FRAMES) !== 0) return;
  const index = recorder.nextSnapshot;
  captureReplaySnapshot(at(recorder.snapshots, index), world, match, controls, runtime);
  recorder.snapshotFrames[index] = frame - 1;
  recorder.nextSnapshot = floorMod(index + 1, SNAPSHOTS);
}

function claimRows(recorder: MomentRecorder, frame: number): number {
  const index = floorMod(frame, ROW_FRAMES);
  if (recorder.rowFrames[index] !== frame) {
    recorder.rowFrames[index] = frame;
    recorder.rowMasks[index] = 0;
  }
  return index;
}

/** The row a human's fighter runs on `frame`, as the match adapts it. */
export function recordMomentRow(recorder: MomentRecorder, frame: number, slot: number, row: Readonly<InputRow>): void {
  const index = claimRows(recorder, frame);
  storeInputNumbers(at(recorder.rows, slot), index * INPUT_ROW_NUMBERS, row);
  recorder.rowMasks[index] = at(recorder.rowMasks, index) | (1 << slot);
}

/** After the match ran `frame`, with every row recorded. */
export function momentFrameRan(recorder: MomentRecorder, frame: number): void {
  claimRows(recorder, frame);
  recorder.last = frame;
}

/** Before the shell changes the match between frames: the moment keeps the match as its last frame left it. */
export function keepMomentEnd(recorder: MomentRecorder, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  if (recorder.last === undefined || recorder.ended) return;
  captureReplaySnapshot(recorder.end, world, match, controls, runtime);
  recorder.ended = true;
}

/** The state's checksum as the shell computes the confirmed match's: captured into scratch storage first. */
export function checksumOf(scratch: ReplayState, state: Readonly<ReplayState>): string {
  copyReplayState(scratch, state);
  return stateChecksum(scratch);
}

/**
 * The fields a snapshot holds that are keyed by action number (a kit's normals,
 * throws and attack poses), which the record text keeps by key; recordTokens
 * throws naming any other integer-keyed field.
 */
export const KEYED_BY_ACTION = ["attacks", "normals", "throws"];

/** What a snapshot saves: the active fighters, the match, the command buffers and the pacing and presentation. */
function savedView(state: Readonly<ReplayState>): object {
  const fighters: (Fighter | undefined)[] = [];
  for (const slot of PARTICIPANT_SLOTS) if (isActive(state.world, slot)) fighters[slot] = fighterAt(state.world, slot);
  return { mask: state.world.mask, fighters, match: state.match, commands: state.controls.commands, runtime: state.runtime };
}

/** Reused for each row's numbers, so a full-match replay's rows allocate only their text. */
const ROW_TEXT = filled(INPUT_ROW_NUMBERS, 0);

/** One frame's rows: its mask, then each of those slots' numbers. */
function frameRowText(recorder: MomentRecorder, index: number): string {
  const mask = at(recorder.rowMasks, index);
  const slots: string[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!participantActive(mask, slot)) continue;
    const base = index * INPUT_ROW_NUMBERS;
    const numbers = recorder.rows[slot];
    for (let field = 0; field < INPUT_ROW_NUMBERS; field++) ROW_TEXT[field] = at(numbers, base + field);
    slots.push(ROW_TEXT.join(","));
  }
  return `${mask}:${slots.join("/")}`;
}

/** Whether two ring positions hold the same slots' rows with the same numbers. */
export function sameFrameRows(recorder: MomentRecorder, first: number, second: number): boolean {
  const mask = at(recorder.rowMasks, first);
  if (mask !== at(recorder.rowMasks, second)) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!participantActive(mask, slot)) continue;
    const numbers = recorder.rows[slot];
    for (let field = 0; field < INPUT_ROW_NUMBERS; field++) {
      if (numbers[first * INPUT_ROW_NUMBERS + field] !== numbers[second * INPUT_ROW_NUMBERS + field]) return false;
    }
  }
  return true;
}

/** A run of `count` frames whose rows equal ring position `index`'s, as a rows token. */
export const runToken = (recorder: MomentRecorder, index: number, count: number): string => `${count}:${frameRowText(recorder, index)}`;

/** Rows of frames start + 1 through last, a token per run of equal frames; text only at each run's end. */
export function rowTokens(recorder: MomentRecorder, start: number, last: number): string[] {
  const tokens: string[] = [];
  let run = floorMod(start + 1, ROW_FRAMES);
  let count = 1;
  for (let frame = start + 2; frame <= last; frame++) {
    const index = floorMod(frame, ROW_FRAMES);
    if (sameFrameRows(recorder, run, index)) {
      count++;
      continue;
    }
    tokens.push(runToken(recorder, run, count));
    run = index;
    count = 1;
  }
  if (last > start) tokens.push(runToken(recorder, run, count));
  return tokens;
}

/** The snapshot a moment ending on `last` starts at: the latest at least MOMENT_FRAMES back, or the oldest of a younger match. */
function startSnapshot(recorder: MomentRecorder, last: number): number | undefined {
  const target = last - MOMENT_FRAMES;
  let chosen: number | undefined;
  for (let index = 0; index < SNAPSHOTS; index++) {
    const frame = at(recorder.snapshotFrames, index);
    if (frame < 0 || frame > last || last - frame > ROW_FRAMES) continue;
    const best = chosen === undefined ? undefined : at(recorder.snapshotFrames, chosen);
    if (best === undefined || (frame <= target ? best > target || frame > best : best > target && frame < best)) chosen = index;
  }
  return chosen;
}

export const section = (word: string, tokens: readonly string[]) => tokenLines(tokens, REPRO_LINE_WIDTH - SECTION_WIDTH).map(line => `${word} ${line}`);

/**
 * Begins saving the moment that ends on the last frame the match ran, with
 * `world`, `match`, `controls` and `runtime` the live match. False, starting
 * nothing, before a frame ran or while another save runs.
 */
export function beginMomentSave(recorder: MomentRecorder, input: MomentInput, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): boolean {
  const last = recorder.last;
  const chosen = last === undefined ? undefined : startSnapshot(recorder, last);
  if (recorder.save !== undefined || last === undefined || chosen === undefined) return false;
  const start = at(recorder.snapshotFrames, chosen);
  for (let frame = start + 1; frame <= last; frame++) if (recorder.rowFrames[floorMod(frame, ROW_FRAMES)] !== frame) return false;
  copyReplayState(recorder.saveStart, at(recorder.snapshots, chosen));
  if (recorder.ended) copyReplayState(recorder.saveEnd, recorder.end);
  else captureReplaySnapshot(recorder.saveEnd, world, match, controls, runtime);
  const checkpoints: number[] = [];
  for (let index = 0; index < SNAPSHOTS; index++) {
    const frame = at(recorder.snapshotFrames, index);
    if (frame > start && frame <= last) checkpoints.push(index);
  }
  checkpoints.sort((a, b) => at(recorder.snapshotFrames, a) - at(recorder.snapshotFrames, b));
  recorder.save = {
    input, start, last, checkpoints, checkpointFrames: checkpoints.map(index => at(recorder.snapshotFrames, index)),
    rows: section("rows", rowTokens(recorder, start, last)), lines: [input.kind === "network" ? "input network" : `input callback ${input.scenario}`],
    checksum: "", step: 0,
  };
  return true;
}

/** A finished save: the game's lines of the moment, its last frame and the match's checksum there. */
interface SavedMoment {
  readonly lines: readonly string[];
  readonly frame: number;
  readonly checksum: string;
}

/**
 * One frame's part of the save in progress: one checksum, or the snapshot's
 * text; the finished moment once every part is done. `scratch` takes checksum
 * copies.
 */
export function continueMomentSave(recorder: MomentRecorder, scratch: ReplayState): SavedMoment | undefined {
  const { save } = recorder;
  if (save === undefined) return undefined;
  const step = save.step++;
  const checkpoint = step - 2;
  if (step === 0) save.checksum = checksumOf(scratch, recorder.saveEnd);
  else if (step === 1) save.lines.push(`start ${save.start} ${checksumOf(scratch, recorder.saveStart)}`);
  else if (checkpoint < save.checkpoints.length) {
    const index = at(save.checkpoints, checkpoint);
    const frame = at(save.checkpointFrames, checkpoint);
    if (recorder.snapshotFrames[index] === frame) save.lines.push(`checkpoint ${frame} ${checksumOf(scratch, at(recorder.snapshots, index))}`);
  } else {
    recorder.save = undefined;
    const state = recordTokens(savedView(recorder.saveStart), KEYED_BY_ACTION);
    if (state === undefined) return undefined;
    return { lines: [...save.lines, ...section("state", state), ...save.rows], frame: save.last, checksum: save.checksum };
  }
  return undefined;
}

// ---------------------------------------------------------------- replay

/** A frame's saved rows. */
export interface FrameRows {
  readonly mask: number;
  readonly rows: ParticipantInputs;
}

interface Moment {
  readonly input: MomentInput;
  readonly start: number;
  readonly startChecksum: string;
  readonly checkpoints: ReadonlyMap<number, string>;
  readonly state: ReplayState;
  /** Frames start + 1 onward, in order. */
  readonly frames: readonly FrameRows[];
}

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;
/** Decoded arrays are Lua tables that need not start at index 1, so any table is indexed as one. */
const isList = (value: unknown): value is readonly unknown[] => isObject(value);
const isFighter = (value: unknown): value is Fighter => isObject(value) && "character" in value && typeof value.character === "number" && "motion" in value && isObject(value.motion);
const isMatch = (value: unknown): value is MatchState => isObject(value) && "phase" in value && typeof value.phase === "number" && "characterChoices" in value && isObject(value.characterChoices);
const isRuntime = (value: unknown): value is PacingAndPresentation => isObject(value) && "simulationFrame" in value && typeof value.simulationFrame === "number" && "poses" in value && isObject(value.poses);

function isCommands(value: unknown): value is Slots<AttackBuffer> {
  if (!isList(value)) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    const buffer = value[slot];
    if (!isObject(buffer) || !("graceFrames" in buffer) || typeof buffer.graceFrames !== "number") return false;
  }
  return true;
}

/** Every projectile and placement a hero kit authors, by its canonical text. */
function authoredParts(specials: Readonly<FighterSpecials>, projectiles: Map<string, SpecialProjectile>, placements: Map<string, SpecialPlacement>): void {
  const projectile = (spec: SpecialProjectile | undefined) => {
    if (spec !== undefined) projectiles.set(specialProjectileCanonical(spec, ""), spec);
  };
  const move = (special: AuthoredSpecial | undefined): void => {
    if (special === undefined) return;
    for (const spec of special.projectiles ?? []) projectile(spec);
    projectile(special.burst?.from);
    projectile(special.burst?.into);
    if (special.placement !== undefined) {
      placements.set(specialPlacementCanonical(special.placement, ""), special.placement);
      projectile(special.placement.shot);
    }
    for (const followUp of special.followUps ?? []) move(followUp.special);
  };
  for (const kit of [specials.neutral, specials.side, specials.up, specials.down]) {
    move(kit.ground);
    move(kit.air);
    move(kit.free);
    move(kit.recall);
    move(kit.marked?.special);
  }
}

/**
 * Decoded text holds a copy of a fighter's kit, in which a burst's `from` and
 * the orb it bursts are different objects, and the rules match a projectile
 * to its kit by identity (Frost Nova's burst, projectile limits). A fighter
 * whose kit equals its authored kit gets that kit back, and each live
 * projectile and placement its authored part.
 */
function rebindAuthoredKit(fighter: Fighter): void {
  const authored = authoredTuning(fighter.character).specials;
  if (authored === undefined || fighterSpecialsCanonical(fighter.tuning.specials) !== fighterSpecialsCanonical(authored)) return;
  fighter.tuning.specials = authored;
  const projectiles = new Map<string, SpecialProjectile>();
  const placements = new Map<string, SpecialPlacement>();
  authoredParts(authored, projectiles, placements);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) {
    const live = at(fighter.projectiles, i);
    if (live.spec !== undefined) live.spec = projectiles.get(specialProjectileCanonical(live.spec, "")) ?? live.spec;
  }
  const placed = fighter.placed.spec;
  if (placed !== undefined) fighter.placed.spec = placements.get(specialPlacementCanonical(placed, "")) ?? placed;
}

/** The snapshot's state, in records copyReplayState reads; undefined when a part is missing. */
export function savedState(record: Readonly<Record<string, unknown>>): ReplayState | undefined {
  const { mask, fighters, match, commands, runtime } = record;
  if (typeof mask !== "number" || !isList(fighters) || !isMatch(match) || !isCommands(commands) || !isRuntime(runtime)) return undefined;
  const world = createRoster(mask);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighters[slot];
    if (!isFighter(fighter)) return undefined;
    rebindAuthoredKit(fighter);
    world.fighters[slot] = fighter;
  }
  return { world, match, controls: { inputs: createFrameControls().inputs, commands }, runtime };
}

export const wholeNumber = (text: string | undefined) => {
  const value = Number(text);
  return text !== undefined && text.length > 0 && value === Math.floor(value) ? value : undefined;
};

/** The frames a run of saved rows stands for, appended to `frames`; false when malformed. */
export function readRun(token: string, frames: FrameRows[]): boolean {
  const [countText, maskText, slotsText = ""] = token.split(":");
  const count = wholeNumber(countText);
  const mask = wholeNumber(maskText);
  if (count === undefined || mask === undefined || count < 1 || mask < 0) return false;
  const rows: Slots<InputRow> = [emptyInput(), emptyInput(), emptyInput(), emptyInput()];
  const slotTexts = slotsText.length === 0 ? [] : slotsText.split("/");
  let next = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!participantActive(mask, slot)) continue;
    const numbers = (slotTexts[next] ?? "").split(",").map(text => wholeNumber(text) ?? Number.NaN);
    next++;
    const row = numbers.length === INPUT_ROW_NUMBERS && numbers.every(value => value === value) ? loadInputNumbers(numbers, 0) : undefined;
    if (row === undefined) return false;
    rows[slot] = row;
  }
  if (next !== slotTexts.length) return false;
  for (let frame = 0; frame < count; frame++) frames.push({ mask, rows });
  return true;
}

/** A repro's moment: its input, start, checkpoints, starting state and rows. */
export function parseMoment(lines: readonly string[], last: number): Moment | string {
  let input: MomentInput | undefined;
  let start: number | undefined;
  let startChecksum = "";
  const checkpoints = new Map<number, string>();
  const stateLines: string[] = [];
  const frames: FrameRows[] = [];
  for (const line of lines) {
    const space = line.indexOf(" ");
    const word = space < 0 ? line : line.substring(0, space);
    const rest = space < 0 ? "" : line.substring(space + 1);
    const [first, second] = rest.split(" ");
    if (word === "input") {
      if (rest === "network") input = { kind: "network" };
      else if (first === "callback" && second !== undefined && isScenario(second)) input = { kind: "callback", scenario: second };
      else return `unknown input "${rest}"`;
    } else if (word === "start" || word === "checkpoint") {
      const frame = wholeNumber(first);
      if (frame === undefined || second === undefined) return `malformed ${word} line`;
      if (word === "start") {
        start = frame;
        startChecksum = second;
      } else checkpoints.set(frame, second);
    } else if (word === "state") stateLines.push(rest);
    else if (word === "rows") {
      for (const token of lineTokens([rest])) if (!readRun(token, frames)) return `malformed rows "${token}"`;
    } else return `unknown line "${word}"`;
  }
  if (input === undefined || start === undefined) return "the moment names no input or start";
  if (frames.length !== last - start) return `the moment saves ${frames.length} frames of rows, not the ${last - start} from frame ${start} to ${last}`;
  const record = parseRecord(lineTokens(stateLines));
  const state = record === undefined ? undefined : savedState(record);
  if (state === undefined) return "the saved state is malformed";
  return { input, start, startChecksum, checkpoints, state, frames };
}

/** The scratch records a replayed frame produces its controls in. */
export interface FrameScratch {
  readonly frameInput: MatchFrameInput;
  readonly produced: FrameControls;
}

/**
 * A callback match's frame, as smashcraft:ts/src/platform/shell/frame.ts
 * runs it: humans' rows adapted, the computers' controls chosen, captured,
 * then executed.
 */
export function runCallbackFrame(state: ReplayState, scenario: Scenario, scratch: FrameScratch, saved: FrameRows, frame: number): boolean {
  const { world, match, controls, runtime } = state;
  const { frameInput, produced } = scratch;
  for (const slot of PARTICIPANT_SLOTS) {
    if (participantActive(saved.mask, slot) && isActive(world, slot)) adaptInput(saved.rows[slot], fighterAt(world, slot), frame, produced.inputs[slot], produced.commands[slot]);
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (computerActive(match, slot) && isActive(world, slot)) produceScenarioComputerInput(scenario, match, world, runtime, produced, slot, frame);
  }
  if (!captureFrame(frameInput, frame, world.mask, produced, runtime)) return false;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) clearAttackBuffer(produced.commands[slot]);
  return executeMatchFrame(frameInput, match, world, controls, runtime, frame);
}

/** A rollback match's confirmed frame: every human's accepted row, as the shell's stepConfirmed runs it. */
export function runNetworkFrame(state: ReplayState, scratch: FrameScratch, saved: FrameRows, frame: number): boolean {
  const { world, match, controls, runtime } = state;
  return captureNetworkFrame(scratch.frameInput, frame, saved.rows, world, saved.mask)
    && executeMatchFrame(scratch.frameInput, match, world, controls, runtime, frame);
}

/** `wisp repro`'s replay of a saved moment: the snapshot restored, then each saved frame run, to the last frame's checksum. */
export function replayRepro(repro: Repro): ReproResult {
  const moment = parseMoment(repro.lines, repro.frame);
  if (typeof moment === "string") return { checksum: "", frames: 0, problems: [moment] };
  const problems: string[] = [];
  const state = createReplaySnapshot();
  const checksums = createReplaySnapshot();
  copyReplayState(state, moment.state);
  const restored = checksumOf(checksums, state);
  if (restored !== moment.startChecksum) problems.push(`the snapshot of frame ${moment.start} restores to checksum ${restored}; the game recorded ${moment.startChecksum}`);
  const scratch: FrameScratch = { frameInput: createMatchFrameInput(), produced: createFrameControls() };
  let frames = 0;
  let diverged = false;
  for (const saved of moment.frames) {
    const frame = moment.start + frames + 1;
    const ran = moment.input.kind === "network" ? runNetworkFrame(state, scratch, saved, frame) : runCallbackFrame(state, moment.input.scenario, scratch, saved, frame);
    if (!ran) {
      problems.push(`frame ${frame} could not run`);
      break;
    }
    frames++;
    const recorded = moment.checkpoints.get(frame);
    if (recorded === undefined || diverged) continue;
    const replayed = checksumOf(checksums, state);
    if (replayed === recorded) continue;
    diverged = true;
    problems.push(`frame ${frame} replays to checksum ${replayed}; the game recorded ${recorded}`);
  }
  return { checksum: checksumOf(checksums, state), frames, problems };
}

