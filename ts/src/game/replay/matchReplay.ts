// Full-match replays (smashcraft:docs/design/client.md, "Full-match replays").
// Every client records its confirmed match as the moment recorder sees it:
// each segment's starting state as record text, every frame's rows
// run-length encoded from the moment's ring, and a replay checksum every two
// seconds and at each segment's end. A segment ends wherever the shell
// changes the match between frames (a pause, a player leaving); the next
// starts from the state the change left. The recorder only reads confirmed
// state, and spreads its work so no callback writes a whole state's text:
// each frame extends the rows' current run, and a checkpoint copies the match
// on its frame and folds one fighter a callback after it (#168).
//
// The shell (smashcraft:ts/src/platform/shell/replays.ts) writes the lines in
// part files while the match runs and a manifest at its end; joinReplay
// gives the replay `bun wisp replay` and the client play.
import { at } from "wisp/src/runtime/lookup";
import { lineTokens, parseRecord, recordTokens } from "wisp/src/runtime/recordText";
import { type Repro, type ReproResult, reproLines } from "wisp/src/runtime/repro";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type FrameControls, createFrameControls } from "../match/controls";
import { createMatchFrameInput } from "../match/frameInput";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import { type MatchState, Phase } from "../match/rules";
import { isScenario } from "../shell/build";
import { Character } from "../sim/codes";
import { type Fighter } from "../sim/fighter";
import { authoredTuning } from "../sim/tuning";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import {
  type FrameRows, type FrameScratch, KEYED_BY_ACTION, type MomentInput, type MomentRecorder, ROW_FRAMES, SNAPSHOT_FRAMES,
  readRun, runCallbackFrame, runToken, sameFrameRows, runNetworkFrame, savedState, section, wholeNumber,
} from "./moment";
import { parseReplayHeader } from "./replayFormat";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "./snapshot";
export * from "./replayFormat";

/** Frames between checkpoints: two seconds, as the moment's snapshots. */
export const CHECKPOINT_FRAMES = SNAPSHOT_FRAMES;
/** Pending lines that make the shell write a part. */
export const PART_LINES = 48;
/** Record-text tokens a callback writes of a segment's starting state. */
const STATE_TOKENS_PER_CALLBACK = 240;
/** Records nested this deep in a starting state are written as one piece. */
const STATE_PIECE_DEPTH = 2;

// ---------------------------------------------------------------- checksum

/** A prime whose square fits Warcraft's 32-bit integers. */
const MODULUS = 46337;
const TWO_23 = 8388608.0;
const TWO_24 = 16777216.0;

/**
 * The replay checksum folds every number and boolean of each active fighter,
 * its sub-records and their own (not its authored tuning), each projectile,
 * the match's own fields and the frame, as a sum of terms over their names:
 * the order Lua visits fields in doesn't change it, and a change in any one
 * value always does. About a thousandth of the canonical checksum's cost, so
 * a match can check it every two seconds within the frame-cost gate (#48).
 */
interface Lanes {
  first: number;
  second: number;
}

const KEY_HASHES: Record<string, number> = {};

function keyHash(key: string): number {
  const known = KEY_HASHES[key];
  if (known !== undefined) return known;
  let hash = 0;
  for (let index = 0; index < key.length; index++) hash = floorMod(hash * 31 + key.charCodeAt(index) + 1, MODULUS);
  KEY_HASHES[key] = hash;
  return hash;
}

const isDigitCode = (code: number) => code >= 48 && code <= 57;

/** A field name: Lua gives array and integer keys as numbers, Bun as digits. */
function fieldName(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && !isDigitCode(key.charCodeAt(0));
}

/** One term per lane for an integer below 2^24 in magnitude under name hash `key`. */
function foldInteger(lanes: Lanes, key: number, value: number): void {
  const low = floorMod(value, MODULUS);
  const high = floorMod(floorDiv(value, MODULUS) * 31 + low, MODULUS);
  lanes.first = floorMod(lanes.first + (key + 1) * (low + 1), MODULUS);
  lanes.second = floorMod(lanes.second + (floorMod(key * 7 + 3, MODULUS) + 1) * (high + 1), MODULUS);
}

/** A number's exact binary32 value: whole numbers as themselves, others as exponent and 24-bit significand. */
function foldNumber(lanes: Lanes, key: number, value: number): void {
  if (value !== value) {
    foldInteger(lanes, key, -1);
    return;
  }
  const whole = Math.floor(value);
  if (whole === value && whole < TWO_24 && whole > -TWO_24) {
    foldInteger(lanes, key, whole);
    return;
  }
  let magnitude = value < 0 ? -value : value;
  if (magnitude * 2.0 === magnitude) {
    foldInteger(lanes, floorMod(key + 1, MODULUS), value < 0 ? -2 : 2);
    return;
  }
  // Scaling by powers of two is exact, so Bun and Lua reach the same significand.
  let exponent = 0;
  while (magnitude >= TWO_24 * 256.0) {
    magnitude *= 0.00390625;
    exponent += 8;
  }
  while (magnitude >= TWO_24) {
    magnitude *= 0.5;
    exponent++;
  }
  while (magnitude < TWO_23 * 0.00390625) {
    magnitude *= 256.0;
    exponent -= 8;
  }
  while (magnitude < TWO_23) {
    magnitude *= 2.0;
    exponent--;
  }
  const significand = Math.floor(magnitude);
  foldInteger(lanes, floorMod(key + (exponent + 400) * 101, MODULUS), value < 0 ? -significand : significand);
}

function foldValue(lanes: Lanes, key: number, value: unknown, depth: number): void {
  if (typeof value === "number") foldNumber(lanes, key, value);
  else if (typeof value === "boolean") foldInteger(lanes, floorMod(key + 17, MODULUS), value ? 1 : 0);
  else if (typeof value === "object" && value !== null && depth < 2) foldFields(lanes, key, value, depth + 1);
}

const isFields = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null;
/** Parsed arrays are Lua tables that need not start at index 1, so any table is indexed as one (moment.ts). */
const isSavedList = (value: unknown): value is unknown[] => typeof value === "object" && value !== null;
const CHARACTERS: readonly number[] = Object.values(Character);
const isCharacter = (value: number): value is Character => CHARACTERS.includes(value);

/** Each named field of `record` under the parent's name hash `parent`. */
function foldFields(lanes: Lanes, parent: number, record: unknown, depth: number): void {
  if (!isFields(record)) return;
  const fields = record;
  for (const key in fields) {
    if (!fieldName(key) || (depth === 0 && key === "tuning")) continue;
    foldValue(lanes, floorMod(parent * 31 + keyHash(key), MODULUS), fields[key], depth);
  }
}

function foldFighter(lanes: Lanes, slot: number, fighter: Readonly<Fighter>): void {
  const base = floorMod(slot * 977 + 13, MODULUS);
  foldFields(lanes, base, fighter, 0);
  const projectiles = fighter.projectiles;
  for (let index = 0; index < projectiles.length; index++) {
    foldFields(lanes, floorMod(base * 31 + index + 5, MODULUS), at(projectiles, index), 1);
  }
}

/** The checksum's terms after the fighters': the match's fields and the frame. */
function foldMatchAndFrame(lanes: Lanes, match: Readonly<MatchState>, runtime: Readonly<PacingAndPresentation>): string {
  foldFields(lanes, 3, match, 1);
  foldInteger(lanes, 5, runtime.simulationFrame);
  return `${lanes.first}:${lanes.second}`;
}

/** The replay checksum of a confirmed match: "first:second". */
export function replayChecksum(world: Readonly<Roster>, match: Readonly<MatchState>, runtime: Readonly<PacingAndPresentation>): string {
  const lanes: Lanes = { first: 0, second: 0 };
  foldInteger(lanes, 1, world.mask);
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) foldFighter(lanes, slot, fighterAt(world, slot));
  return foldMatchAndFrame(lanes, match, runtime);
}

/**
 * A state's replay checksum as a snapshot holds it: copied into `scratch`
 * first, as the canonical checksum is, so fields a snapshot doesn't keep
 * never count.
 */
function checksumVia(scratch: ReplayState, state: Readonly<ReplayState>): string {
  copyReplayState(scratch, state);
  return replayChecksum(scratch.world, scratch.match, scratch.runtime);
}

// ---------------------------------------------------------------- state text

/** A piece of a starting state's text: tokens as they are, or one field's record text. */
type StatePiece = string | { readonly record: Readonly<Record<string, unknown>>; readonly name: string };

function hasIntegerKeys(record: object): boolean {
  for (const key in record) if (!fieldName(key)) return true;
  return false;
}

/**
 * A fighter's authored tuning (its kit), immutable and shared: a replay
 * names it by the fighter's character instead of writing it, as it is most
 * of a fighter's text.
 */
const AUTHORED_FIELD = "tuning";

/** The pieces of a record's fields, records nested above STATE_PIECE_DEPTH opened field by field; `skip` names one left out. */
function statePieces(pieces: StatePiece[], record: unknown, depth: number, skip = ""): void {
  if (!isFields(record)) return;
  for (const name in record) {
    if (!fieldName(name) || name === skip) continue;
    const value = record[name];
    if (depth < STATE_PIECE_DEPTH && isFields(value) && !Array.isArray(value) && !hasIntegerKeys(value)) {
      pieces.push(`${name}{`);
      statePieces(pieces, value, depth + 1);
      pieces.push("}");
    } else pieces.push({ record, name });
  }
}

/**
 * The pieces of what a moment saves (moment.ts, savedView): the mask, the
 * active fighters, the match, the command buffers and the pacing and
 * presentation, as record text the moment's reader takes.
 */
function savedStatePieces(state: Readonly<ReplayState>): StatePiece[] {
  const pieces: StatePiece[] = [`mask=${state.world.mask}`, "fighters["];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(state.world, slot)) continue;
    pieces.push(`${slot}{`);
    statePieces(pieces, fighterAt(state.world, slot), 1, AUTHORED_FIELD);
    pieces.push("}");
  }
  pieces.push("]", "match{");
  statePieces(pieces, state.match, 1);
  pieces.push("}");
  pieces.push({ record: { commands: state.controls.commands }, name: "commands" });
  pieces.push("runtime{");
  statePieces(pieces, state.runtime, 1);
  pieces.push("}");
  return pieces;
}

/** A piece's tokens; undefined when a field can't be written as record text. */
function pieceTokens(piece: StatePiece): readonly string[] | undefined {
  if (typeof piece === "string") return [piece];
  const field: Record<string, unknown> = {};
  field[piece.name] = piece.record[piece.name];
  return recordTokens(field, KEYED_BY_ACTION);
}

// ---------------------------------------------------------------- recording

/**
 * A segment's starting state being written as text: its checksum and pieces
 * in the first callback after the segment starts, then a few pieces a
 * callback, so the frame that starts it pays only for the copy.
 */
interface StateText {
  /** The index in the pending lines of the segment line, whose checksum the first step fills in. */
  readonly segmentLine: number;
  pieces: readonly StatePiece[] | undefined;
  next: number;
  readonly tokens: string[];
}

export interface MatchReplayRecorder {
  /** Whether a replay is being recorded; it stays open until finishMatchReplay. */
  open: boolean;
  /** The frame after which the current segment starts. */
  segmentStart: number;
  /** The last frame whose rows are in the lines. */
  encoded: number;
  /** The last frame the match ran. */
  last: number;
  /** The current segment ended: the shell changed the match after its last frame. */
  ended: boolean;
  /** The replay checksum of the match on its last frame, once the segment ended. */
  checksum: string;
  /** Preallocated: the current segment's starting state, while its text is written. */
  readonly start: ReplayState;
  /** Preallocated: checksums copy the match here. */
  readonly scratch: ReplayState;
  /** Preallocated: a checkpoint's match, folded a fighter a callback while `checkpoint` is set. */
  readonly checkpointState: ReplayState;
  checkpoint: PendingCheckpoint | undefined;
  /** The last frame whose rows are in `runs` or the current run. */
  scanned: number;
  /** Tokens of the rows' finished runs since the last encoded frame. */
  runs: string[];
  /** The current run: the ring position of its first frame, and its frames; 0 for none. */
  runIndex: number;
  runCount: number;
  text: StateText | undefined;
  /** Lines not yet written to a part. */
  lines: string[];
  /** Parts written so far. */
  parts: number;
  /** Whether the replay's state could not be written as record text. */
  failed: boolean;
}

/** A checkpoint whose checksum is being folded: its frame, the lanes so far, and the next fighter slot to fold. */
interface PendingCheckpoint {
  readonly frame: number;
  readonly lanes: Lanes;
  slot: number;
}

export function createMatchReplayRecorder(): MatchReplayRecorder {
  return {
    open: false, segmentStart: 0, encoded: 0, last: 0, ended: false, checksum: "",
    start: createReplaySnapshot(), scratch: createReplaySnapshot(), checkpointState: createReplaySnapshot(), checkpoint: undefined,
    scanned: 0, runs: [], runIndex: 0, runCount: 0, text: undefined, lines: [], parts: 0, failed: false,
  };
}

const inputLine = (input: MomentInput) => (input.kind === "network" ? "input network" : `input callback ${input.scenario}`);

/** Writes every remaining piece of the starting state's text. */
function finishStateText(recorder: MatchReplayRecorder): void {
  while (recorder.text !== undefined) continueStateText(recorder, Number.MAX_SAFE_INTEGER);
}

/** Up to `budget` more tokens of the starting state's text; its lines once all are written. */
function continueStateText(recorder: MatchReplayRecorder, budget: number): void {
  const text = recorder.text;
  if (text === undefined) return;
  let pieces = text.pieces;
  if (pieces === undefined) {
    recorder.lines[text.segmentLine] = `segment ${recorder.segmentStart} ${checksumVia(recorder.scratch, recorder.start)}`;
    pieces = savedStatePieces(recorder.start);
    text.pieces = pieces;
    if (budget < Number.MAX_SAFE_INTEGER) return;
  }
  let written = 0;
  while (text.next < pieces.length && written < budget) {
    const tokens = pieceTokens(at(pieces, text.next));
    text.next++;
    if (tokens === undefined) {
      recorder.failed = true;
      continue;
    }
    for (const token of tokens) text.tokens.push(token);
    written += tokens.length;
  }
  if (text.next < pieces.length) return;
  recorder.text = undefined;
  finishCheckpoint(recorder);
  for (const line of section("state", text.tokens)) recorder.lines.push(line);
}

/** Starts a segment from the live match: its first line, its starting state captured for writing as text. */
function beginSegment(recorder: MatchReplayRecorder, start: number, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  finishStateText(recorder);
  finishCheckpoint(recorder);
  captureReplaySnapshot(recorder.start, world, match, controls, runtime);
  recorder.segmentStart = start;
  recorder.encoded = start;
  recorder.scanned = start;
  recorder.runs = [];
  recorder.runCount = 0;
  recorder.last = start;
  recorder.ended = false;
  recorder.text = { segmentLine: recorder.lines.length, pieces: undefined, next: 0, tokens: [] };
  recorder.lines.push("segment");
}

/** What beginMatchReplayFrame did. */
export const enum ReplayBegin {
  none,
  /** A new replay: the shell names it before it writes a part. */
  opened,
  /** A new segment of the open replay. */
  segment,
}

/**
 * Before the match runs `frame`, with the moment recorder as it was before
 * beginMomentFrame: wherever the moment starts its record again, the replay
 * starts a segment, and on a match's first frame (or with none open) a new
 * replay. The caller finishes an open replay before a new one opens.
 */
export function beginMatchReplayFrame(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, frame: number, input: MomentInput, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): ReplayBegin {
  const restart = moment.last === undefined || moment.ended || frame !== moment.last + 1;
  if (!restart) return ReplayBegin.none;
  if (recorder.open && frame !== 1) {
    endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
    beginSegment(recorder, frame - 1, world, match, controls, runtime);
    return ReplayBegin.segment;
  }
  recorder.open = true;
  recorder.parts = 0;
  recorder.failed = false;
  recorder.checksum = "";
  recorder.lines = [inputLine(input)];
  beginSegment(recorder, frame - 1, world, match, controls, runtime);
  return ReplayBegin.opened;
}

/** Extends the rows' runs through `last` from the moment's ring; false when the ring no longer holds a frame's rows. */
function scanRows(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, last: number): boolean {
  for (let frame = recorder.scanned + 1; frame <= last; frame++) {
    const index = floorMod(frame, ROW_FRAMES);
    if (moment.rowFrames[index] !== frame) return false;
    if (recorder.runCount > 0 && sameFrameRows(moment, recorder.runIndex, index)) recorder.runCount++;
    else {
      if (recorder.runCount > 0) recorder.runs.push(runToken(moment, recorder.runIndex, recorder.runCount));
      recorder.runIndex = index;
      recorder.runCount = 1;
    }
    recorder.scanned = frame;
  }
  return true;
}

/** The rows of frames encoded + 1 through `last`, a token per run of equal frames; false when the ring no longer holds them all. */
function encodeRows(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, last: number): boolean {
  if (last <= recorder.encoded) return true;
  if (!scanRows(recorder, moment, last)) return false;
  finishCheckpoint(recorder);
  if (recorder.runCount > 0) recorder.runs.push(runToken(moment, recorder.runIndex, recorder.runCount));
  recorder.runCount = 0;
  for (const line of section("rows", recorder.runs)) recorder.lines.push(line);
  recorder.runs = [];
  recorder.encoded = last;
  return true;
}

/** Folds the pending checkpoint's next fighter, or its match and frame and writes its line; true while more remains. */
function stepCheckpoint(recorder: MatchReplayRecorder): boolean {
  const checkpoint = recorder.checkpoint;
  if (checkpoint === undefined) return false;
  const { world, match, runtime } = recorder.checkpointState;
  while (checkpoint.slot < PARTICIPANT_SLOTS.length && !isActive(world, checkpoint.slot)) checkpoint.slot++;
  if (checkpoint.slot < PARTICIPANT_SLOTS.length) {
    foldFighter(checkpoint.lanes, checkpoint.slot, fighterAt(world, checkpoint.slot));
    checkpoint.slot++;
    return true;
  }
  recorder.checkpoint = undefined;
  recorder.lines.push(`checkpoint ${checkpoint.frame} ${foldMatchAndFrame(checkpoint.lanes, match, runtime)}`);
  return false;
}

/** Writes the pending checkpoint's line now: before any other line, so lines keep their order. */
function finishCheckpoint(recorder: MatchReplayRecorder): void {
  while (stepCheckpoint(recorder));
}

/** After the match ran `frame` and the moment recorded its rows: every two seconds of the segment, its rows and a checkpoint. */
export function matchReplayFrameRan(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, frame: number, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  if (!recorder.open || recorder.ended) return;
  recorder.last = frame;
  if (floorMod(frame - recorder.segmentStart, CHECKPOINT_FRAMES) !== 0) {
    if (!scanRows(recorder, moment, frame)) recorder.failed = true;
    return;
  }
  if (!encodeRows(recorder, moment, frame)) {
    recorder.failed = true;
    return;
  }
  // The same checksum checksumVia gives, its fighters folded on the callbacks after this frame.
  copyReplayState(recorder.checkpointState, { world, match, controls, runtime });
  const lanes: Lanes = { first: 0, second: 0 };
  foldInteger(lanes, 1, recorder.checkpointState.world.mask);
  recorder.checkpoint = { frame, lanes, slot: 0 };
}

/**
 * Before the shell changes the match between frames (with the moment's
 * keepMomentEnd), and at its result: the segment's rows and its last frame's
 * checkpoint. The match as it stands is the one its last frame left.
 */
export function endMatchReplaySegment(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  if (!recorder.open || recorder.ended) return;
  recorder.ended = true;
  finishCheckpoint(recorder);
  if (!encodeRows(recorder, moment, recorder.last)) recorder.failed = true;
  recorder.checksum = checksumVia(recorder.scratch, { world, match, controls, runtime });
  if (recorder.last > recorder.segmentStart && floorMod(recorder.last - recorder.segmentStart, CHECKPOINT_FRAMES) === 0) return;
  recorder.lines.push(`checkpoint ${recorder.last} ${recorder.checksum}`);
}

/** Every callback: the pending checkpoint's next fighter and the next tokens of a starting state's text. */
export function continueMatchReplay(recorder: MatchReplayRecorder): void {
  stepCheckpoint(recorder);
  continueStateText(recorder, STATE_TOKENS_PER_CALLBACK);
}

/** Whether the open replay is done: its match left play (a pause keeps it open) and its text is written. */
export function matchReplayDone(recorder: Readonly<MatchReplayRecorder>, match: Readonly<MatchState>): boolean {
  return recorder.open && recorder.text === undefined && match.phase !== Phase.match;
}

/** Takes the pending lines for a part: when PART_LINES are waiting, or all of them with `all`. */
export function takeMatchReplayPart(recorder: MatchReplayRecorder, all: boolean): readonly string[] | undefined {
  if (recorder.lines.length === 0 || (!all && recorder.lines.length < PART_LINES)) return undefined;
  const lines = recorder.lines;
  recorder.lines = [];
  recorder.parts++;
  return lines;
}

/**
 * Closes the open replay after its last part; its manifest, or undefined for
 * one that recorded no frame or failed. Ends a segment the shell didn't.
 */
export function finishMatchReplay(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): { readonly frame: number; readonly checksum: string } | undefined {
  if (!recorder.open) return undefined;
  endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
  finishStateText(recorder);
  recorder.open = false;
  return recorder.failed || recorder.last === 0 ? undefined : { frame: recorder.last, checksum: recorder.checksum };
}

// ---------------------------------------------------------------- replay

export interface ReplaySegment {
  readonly start: number;
  readonly startChecksum: string;
  readonly state: ReplayState;
  /** Frames start + 1 onward, in order. */
  readonly frames: readonly FrameRows[];
  readonly checkpoints: ReadonlyMap<number, string>;
}

export interface ParsedReplay {
  readonly build: string;
  readonly version: string;
  readonly serial: number;
  readonly input: MomentInput;
  readonly segments: readonly ReplaySegment[];
  /** The last frame and the replay checksum there. */
  readonly frame: number;
  readonly checksum: string;
}

interface SegmentText {
  readonly start: number;
  readonly startChecksum: string;
  readonly stateLines: string[];
  readonly frames: FrameRows[];
  readonly checkpoints: Map<number, string>;
}

/** Gives each saved fighter its character's authored tuning, which the replay leaves out. */
function restoreTuning(record: Readonly<Record<string, unknown>>): void {
  const fighters = record.fighters;
  if (!isSavedList(fighters)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = fighters[slot];
    if (!isFields(fighter) || typeof fighter.character !== "number" || !isCharacter(fighter.character)) continue;
    fighters[slot] = { ...fighter, tuning: authoredTuning(fighter.character) };
  }
}

/** A joined replay's lines, parsed; or what is wrong with them. */
export function parseReplay(lines: readonly string[]): ParsedReplay | string {
  const header = parseReplayHeader(lines);
  if (typeof header === "string") return header;
  if (header.parts !== undefined) return "this is a replay's manifest: join it with its parts first";
  let input: MomentInput | undefined;
  const texts: SegmentText[] = [];
  for (const line of header.repro.lines.slice(2)) {
    const space = line.indexOf(" ");
    const word = space < 0 ? line : line.substring(0, space);
    const rest = space < 0 ? "" : line.substring(space + 1);
    const [first, second] = rest.split(" ");
    const segment = texts[texts.length - 1];
    if (word === "input") {
      if (rest === "network") input = { kind: "network" };
      else if (first === "callback" && second !== undefined && isScenario(second)) input = { kind: "callback", scenario: second };
      else return `unknown input "${rest}"`;
    } else if (word === "segment") {
      const start = wholeNumber(first);
      if (start === undefined || second === undefined) return "malformed segment line";
      const previous = texts[texts.length - 1];
      if (previous !== undefined && start !== previous.start + previous.frames.length) return `the segment at frame ${start} doesn't follow the one before`;
      texts.push({ start, startChecksum: second, stateLines: [], frames: [], checkpoints: new Map() });
    } else if (segment === undefined) return `"${word}" before the first segment`;
    else if (word === "state") segment.stateLines.push(rest);
    else if (word === "rows") {
      for (const token of lineTokens([rest])) if (!readRun(token, segment.frames)) return `malformed rows "${token}"`;
    } else if (word === "checkpoint") {
      const frame = wholeNumber(first);
      if (frame === undefined || second === undefined) return "malformed checkpoint line";
      segment.checkpoints.set(frame, second);
    } else return `unknown line "${word}"`;
  }
  if (input === undefined) return "the replay names no input";
  if (texts.length === 0) return "the replay has no segment";
  const segments: ReplaySegment[] = [];
  for (const text of texts) {
    const record = parseRecord(lineTokens(text.stateLines));
    if (record !== undefined) restoreTuning(record);
    const state = record === undefined ? undefined : savedState(record);
    if (state === undefined) return `the state at frame ${text.start} is malformed`;
    segments.push({ start: text.start, startChecksum: text.startChecksum, state, frames: text.frames, checkpoints: text.checkpoints });
  }
  const last = at(segments, segments.length - 1);
  const frame = last.start + last.frames.length;
  if (frame !== header.repro.frame) return `the replay's rows end on frame ${frame}, not the ${header.repro.frame} it names`;
  return { build: header.repro.build, version: header.version, serial: header.serial, input, segments, frame, checksum: header.repro.checksum };
}

/** Runs one saved frame on `state`, as the match ran it. */
export function runReplayFrame(state: ReplayState, input: MomentInput, scratch: FrameScratch, saved: FrameRows, frame: number): boolean {
  return input.kind === "network" ? runNetworkFrame(state, scratch, saved, frame) : runCallbackFrame(state, input.scenario, scratch, saved, frame);
}

export const createFrameScratch = (): FrameScratch => ({ frameInput: createMatchFrameInput(), produced: createFrameControls() });

/** A replayed state's replay checksum, copied into `scratch` first. */
export const replayStateChecksum = checksumVia;

/** What replaying a whole match reached. */
export interface MatchReplayResult extends ReproResult {
  /** Recorded checksums the replay reached, and how many it was to reach. */
  readonly reached: number;
  readonly recorded: number;
}

/** Replays every segment from its state, checking every recorded checksum on the way. */
export function replayMatch(lines: readonly string[]): MatchReplayResult {
  const replay = parseReplay(lines);
  if (typeof replay === "string") return { checksum: "", frames: 0, problems: [replay], reached: 0, recorded: 0 };
  const problems: string[] = [];
  const state = createReplaySnapshot();
  const checksums = createReplaySnapshot();
  const scratch = createFrameScratch();
  let frames = 0;
  let reached = 0;
  let recorded = 1;
  const check = (frame: number, expected: string) => {
    const actual = checksumVia(checksums, state);
    if (actual === expected) reached++;
    else if (problems.length < 8) problems.push(`frame ${frame} replays to checksum ${actual}; the game recorded ${expected}`);
  };
  for (const segment of replay.segments) {
    copyReplayState(state, segment.state);
    recorded += 1 + segment.checkpoints.size;
    check(segment.start, segment.startChecksum);
    for (let index = 0; index < segment.frames.length; index++) {
      const frame = segment.start + index + 1;
      if (!runReplayFrame(state, replay.input, scratch, at(segment.frames, index), frame)) {
        problems.push(`frame ${frame} could not run`);
        return { checksum: checksumVia(checksums, state), frames, problems, reached, recorded };
      }
      frames++;
      const expected = segment.checkpoints.get(frame);
      if (expected !== undefined) check(frame, expected);
    }
  }
  check(replay.frame, replay.checksum);
  return { checksum: checksumVia(checksums, state), frames, problems, reached, recorded };
}

/** `wisp repro`'s shape (wisp:src/runtime/repro.ts) for a joined replay, so Wisp's simulated clients can run it. */
export function replayRepro(repro: Repro): ReproResult {
  return replayMatch(reproLines(repro, repro.lines));
}
