













import { at } from "wisp/src/runtime/lookup";
import { lineTokens, parseRecord, recordTokens } from "wisp/src/runtime/recordText";
import { type Repro, type ReproResult, reproLines } from "wisp/src/runtime/repro";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type FrameControls, createFrameControls } from "../match/controls";
import { createMatchFrameInput } from "../match/frameInput";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import { type MatchState, Phase } from "../match/rules";
import { CPU_OPPONENT_CHOICES, CPU_OPPONENT_IDS, CPU_TIERS } from "../match/cpuProfiles";
import { isScenario } from "../shell/build";
import { Character } from "../sim/codes";
import { type Fighter } from "../sim/fighter";
import { authoredTuning } from "../sim/tuning";
import { botStrategyValues } from "../match/botStrategy";
import { settleObservationChecksum } from "../match/botPerception";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import {
  type FrameRows, type FrameScratch, KEYED_BY_ACTION, type MomentInput, type MomentRecorder, ROW_FRAMES, SNAPSHOT_FRAMES,
  readRun, runCallbackFrame, runToken, sameFrameRows, runNetworkFrame, savedRuntime, savedState, section, wholeNumber,
} from "./moment";
import { parseReplayHeader } from "./replayFormat";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "./snapshot";
import { describeDigestDifference, digestDifference, frameDigest } from "./frameDigest";
import { type Lanes, MODULUS, fieldName, foldFields, foldInteger, foldNumber, foldValue, isFields, keyHash } from "./replayFold";
export * from "./replayFormat";


export const CHECKPOINT_FRAMES = SNAPSHOT_FRAMES;

export const PART_LINES = 48;

const STATE_TOKENS_PER_CALLBACK = 240;

const STATE_PIECE_DEPTH = 2;

const STATE_LIST_MINIMUM = 8;



// Parsed Lua arrays need not start at index 1; index them as tables.
const isSavedList = (value: unknown): value is unknown[] => typeof value === "object" && value !== null;
const CHARACTERS: readonly number[] = Object.values(Character);
const isCharacter = (value: number): value is Character => CHARACTERS.includes(value);









function foldFighter(lanes: Lanes, slot: number, fighter: Readonly<Fighter>): void {
  const base = floorMod(slot * 977 + 13, MODULUS);
  foldFields(lanes, base, fighter, 0);
  const projectiles = fighter.projectiles;
  for (let index = 0; index < projectiles.length; index++) {
    foldFields(lanes, floorMod(base * 31 + index + 5, MODULUS), at(projectiles, index), 1);
  }
}


function foldMatchAndFrame(lanes: Lanes, match: Readonly<MatchState>, runtime: Readonly<PacingAndPresentation>): string {
  foldFields(lanes, 3, match, 1);
  foldInteger(lanes, 5, runtime.simulationFrame);
  const memory = runtime.botMemory;
  foldInteger(lanes, 7, memory.history.length);
  for (let index = 0; index < memory.history.length; index++) {
    const sample = at(memory.history, index);
    settleObservationChecksum(sample);
    const base = floorMod(11 + index * 977, MODULUS);
    foldInteger(lanes, base, sample.frame);
    foldInteger(lanes, base + 1, sample.checksumFirst);
    foldInteger(lanes, base + 2, sample.checksumSecond);
  }
  for (const slot of PARTICIPANT_SLOTS) {
    const base = 19 + slot * 977;
    foldNumber(lanes, base, runtime.botAttackDelays[slot]);
    foldInteger(lanes, base + 1, memory.directions[slot]);
    foldInteger(lanes, base + 2, memory.directionFrames[slot]);
    foldInteger(lanes, base + 3, CPU_OPPONENT_CHOICES.indexOf(match.cpuOpponents[slot]));
    foldInteger(lanes, base + 4, CPU_TIERS.indexOf(match.cpuTiers[slot]));
    foldInteger(lanes, base + 5, CPU_OPPONENT_IDS.indexOf(match.cpuResolvedOpponents[slot]));
    const strategy = runtime.botStrategies[slot];
    if (strategy.observedFrame >= 0) {
      const values = botStrategyValues(strategy);
      for (let index = 0; index < values.length; index++) foldInteger(lanes, floorMod(base + 6 + index * 31, MODULUS), at(values, index));
    }
  }
  return `${lanes.first}:${lanes.second}`;
}


export function replayChecksum(world: Readonly<Roster>, match: Readonly<MatchState>, runtime: Readonly<PacingAndPresentation>): string {
  const lanes: Lanes = { first: 0, second: 0 };
  foldInteger(lanes, 1, world.mask);
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) foldFighter(lanes, slot, fighterAt(world, slot));
  return foldMatchAndFrame(lanes, match, runtime);
}






function checksumVia(scratch: ReplayState, state: Readonly<ReplayState>): string {
  copyReplayState(scratch, state);
  return replayChecksum(scratch.world, scratch.match, scratch.runtime);
}




type StatePiece = string | { readonly record: Readonly<Record<string, unknown>>; readonly name: string };

function hasIntegerKeys(record: object): boolean {
  for (const key in record) if (!fieldName(key)) return true;
  return false;
}






const AUTHORED_FIELD = "tuning";


function statePieces(pieces: StatePiece[], record: unknown, depth: number, skip = ""): void {
  if (!isFields(record)) return;
  for (const name in record) {
    if (!fieldName(name) || name === skip) continue;
    const value = record[name];
    if (depth < STATE_PIECE_DEPTH && isFields(value) && !Array.isArray(value) && !hasIntegerKeys(value)) {
      pieces.push(`${name}{`);
      statePieces(pieces, value, depth + 1);
      pieces.push("}");
    } else if (recordList(name, value)) {

      pieces.push(`${name}[`);
      for (let index = 0; index < value.length; index++) {
        pieces.push(`${index}{`);
        statePieces(pieces, value[index], STATE_PIECE_DEPTH);
        pieces.push("}");
      }
      pieces.push("]");
    } else pieces.push({ record, name });
  }
}


function recordList(name: string, value: unknown): value is readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value) || value.length < STATE_LIST_MINIMUM || KEYED_BY_ACTION.includes(name)) return false;
  for (let index = 0; index < value.length; index++) {
    const element: unknown = value[index];
    if (!isFields(element) || Array.isArray(element) || hasIntegerKeys(element)) return false;
  }
  return true;
}







function savedStatePieces(pieces: StatePiece[], state: Readonly<ReplayState>, slot: number): void {
  if (slot === 0) pieces.push(`mask=${state.world.mask}`, "fighters[");
  if (slot < PARTICIPANT_SLOTS.length) {
    if (!isActive(state.world, slot)) return;
    pieces.push(`${slot}{`);
    statePieces(pieces, fighterAt(state.world, slot), 1, AUTHORED_FIELD);
    pieces.push("}");
    return;
  }
  pieces.push("]", "match{");
  statePieces(pieces, state.match, 1);
  pieces.push("}");
  pieces.push({ record: { commands: state.controls.commands }, name: "commands" });
  pieces.push("runtime{");
  statePieces(pieces, savedRuntime(state.runtime), 1);
  pieces.push("}");
}


function pieceTokens(piece: StatePiece): readonly string[] | undefined {
  if (typeof piece === "string") return [piece];
  const field: Record<string, unknown> = {};
  field[piece.name] = piece.record[piece.name];
  return recordTokens(field, KEYED_BY_ACTION);
}








interface StateText {

  readonly segmentLine: number;

  fold: PendingFold | undefined;

  slot: number;
  readonly gathered: StatePiece[];
  pieces: readonly StatePiece[] | undefined;
  next: number;
  readonly tokens: string[];
}

export interface MatchReplayRecorder {

  open: boolean;

  segmentStart: number;

  encoded: number;

  last: number;

  ended: boolean;

  checksum: string;

  readonly start: ReplayState;

  readonly scratch: ReplayState;

  readonly checkpointState: ReplayState;
  checkpoint: PendingCheckpoint | undefined;

  scanned: number;

  runs: string[];

  runIndex: number;
  runCount: number;
  text: StateText | undefined;

  digests: string[];

  lines: string[];

  parts: number;

  failed: boolean;
}


const CHECKPOINT_FIELDS_PER_CALLBACK = 6;


interface PendingFold {
  readonly lanes: Lanes;
  slot: number;
  fields: readonly string[] | undefined;
  field: number;
  projectile: number;
}


interface PendingCheckpoint extends PendingFold {
  readonly frame: number;
}

function beginFold(world: Readonly<Roster>): PendingFold {
  const lanes: Lanes = { first: 0, second: 0 };
  foldInteger(lanes, 1, world.mask);
  return { lanes, slot: 0, fields: undefined, field: 0, projectile: 0 };
}


function stepFold(fold: PendingFold, world: Readonly<Roster>): boolean {
  while (fold.slot < PARTICIPANT_SLOTS.length && !isActive(world, fold.slot)) fold.slot++;
  if (fold.slot >= PARTICIPANT_SLOTS.length) return false;
  const fighter = fighterAt(world, fold.slot);
  const base = floorMod(fold.slot * 977 + 13, MODULUS);
  const fields = fold.fields ?? Object.keys(fighter);
  fold.fields = fields;
  let remaining = CHECKPOINT_FIELDS_PER_CALLBACK;
  if (isFields(fighter)) {
    while (fold.field < fields.length && remaining > 0) {
      const key = at(fields, fold.field++);
      if (fieldName(key) && key !== "tuning") foldValue(fold.lanes, floorMod(base * 31 + keyHash(key), MODULUS), fighter[key], 0);
      remaining--;
    }
  }
  while (fold.field === fields.length && fold.projectile < fighter.projectiles.length && remaining > 0) {
    const index = fold.projectile++;
    foldFields(fold.lanes, floorMod(base * 31 + index + 5, MODULUS), at(fighter.projectiles, index), 1);
    remaining--;
  }
  if (fold.field === fields.length && fold.projectile === fighter.projectiles.length) {
    fold.slot++;
    fold.fields = undefined;
    fold.field = 0;
    fold.projectile = 0;
  }
  return true;
}

export function createMatchReplayRecorder(): MatchReplayRecorder {
  return {
    open: false, segmentStart: 0, encoded: 0, last: 0, ended: false, checksum: "",
    start: createReplaySnapshot(), scratch: createReplaySnapshot(), checkpointState: createReplaySnapshot(), checkpoint: undefined,
    scanned: 0, runs: [], runIndex: 0, runCount: 0, text: undefined, digests: [], lines: [], parts: 0, failed: false,
  };
}

const inputLine = (input: MomentInput) => (input.kind === "network" ? "input network" : `input callback ${input.scenario}`);


function finishStateText(recorder: MatchReplayRecorder): void {
  while (recorder.text !== undefined) continueStateText(recorder, Number.MAX_SAFE_INTEGER);
}


function continueStateText(recorder: MatchReplayRecorder, budget: number): void {
  const text = recorder.text;
  if (text === undefined) return;
  const all = budget === Number.MAX_SAFE_INTEGER;

  const { world, match, runtime } = recorder.start;
  const fold = text.fold;
  if (fold !== undefined) {
    while (stepFold(fold, world)) if (!all) return;
    recorder.lines[text.segmentLine] = `segment ${recorder.segmentStart} ${foldMatchAndFrame(fold.lanes, match, runtime)}`;
    text.fold = undefined;
    if (!all) return;
  }
  let pieces = text.pieces;
  if (pieces === undefined) {
    while (text.slot <= PARTICIPANT_SLOTS.length) {
      savedStatePieces(text.gathered, recorder.start, text.slot++);
      if (!all) return;
    }
    pieces = text.gathered;
    text.pieces = pieces;
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


function beginSegment(recorder: MatchReplayRecorder, start: number, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  finishStateText(recorder);
  finishCheckpoint(recorder);
  captureReplaySnapshot(recorder.start, world, match, controls, runtime);
  recorder.segmentStart = start;
  recorder.encoded = start;
  recorder.scanned = start;
  recorder.runs = [];
  recorder.runCount = 0;
  recorder.digests = [];
  recorder.last = start;
  recorder.ended = false;
  recorder.text = { segmentLine: recorder.lines.length, fold: beginFold(recorder.start.world), slot: 0, gathered: [], pieces: undefined, next: 0, tokens: [] };
  recorder.lines.push("segment");
}


export const enum ReplayBegin {
  none,

  opened,

  segment,
}







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


function encodeRows(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, last: number): boolean {
  if (last <= recorder.encoded) return true;
  if (!scanRows(recorder, moment, last)) return false;
  finishCheckpoint(recorder);
  if (recorder.runCount > 0) recorder.runs.push(runToken(moment, recorder.runIndex, recorder.runCount));
  recorder.runCount = 0;
  for (const line of section("rows", recorder.runs)) recorder.lines.push(line);
  recorder.runs = [];
  if (recorder.digests.length > 0) for (const line of section("digests", recorder.digests)) recorder.lines.push(line);
  recorder.digests = [];
  recorder.encoded = last;
  return true;
}


function stepCheckpoint(recorder: MatchReplayRecorder): boolean {
  const checkpoint = recorder.checkpoint;
  if (checkpoint === undefined) return false;
  const { world, match, runtime } = recorder.checkpointState;
  if (stepFold(checkpoint, world)) return true;
  recorder.checkpoint = undefined;
  recorder.lines.push(`checkpoint ${checkpoint.frame} ${foldMatchAndFrame(checkpoint.lanes, match, runtime)}`);
  return false;
}


function finishCheckpoint(recorder: MatchReplayRecorder): void {
  while (stepCheckpoint(recorder));
}






export function matchReplayFrameRan(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, frame: number, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>, digest = false): void {
  if (!recorder.open || recorder.ended) return;
  recorder.last = frame;
  if (digest) recorder.digests.push(frameDigest(world, frame));
  if (floorMod(frame - recorder.segmentStart, CHECKPOINT_FRAMES) !== 0) {
    if (!scanRows(recorder, moment, frame)) recorder.failed = true;
    return;
  }
  if (!encodeRows(recorder, moment, frame)) {
    recorder.failed = true;
    return;
  }

  copyReplayState(recorder.checkpointState, { world, match, controls, runtime });
  recorder.checkpoint = { ...beginFold(recorder.checkpointState.world), frame };
}






export function endMatchReplaySegment(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  if (!recorder.open || recorder.ended) return;
  recorder.ended = true;
  finishCheckpoint(recorder);
  if (!encodeRows(recorder, moment, recorder.last)) recorder.failed = true;
  recorder.checksum = checksumVia(recorder.scratch, { world, match, controls, runtime });
  if (recorder.last > recorder.segmentStart && floorMod(recorder.last - recorder.segmentStart, CHECKPOINT_FRAMES) === 0) return;
  recorder.lines.push(`checkpoint ${recorder.last} ${recorder.checksum}`);
}


export function continueMatchReplay(recorder: MatchReplayRecorder): void {
  stepCheckpoint(recorder);
  continueStateText(recorder, STATE_TOKENS_PER_CALLBACK);
}


export function matchReplayDone(recorder: Readonly<MatchReplayRecorder>, match: Readonly<MatchState>): boolean {
  return recorder.open && recorder.text === undefined && match.phase !== Phase.match;
}


export function takeMatchReplayPart(recorder: MatchReplayRecorder, all: boolean): readonly string[] | undefined {
  if (recorder.lines.length === 0 || (!all && recorder.lines.length < PART_LINES)) return undefined;

  if (all) finishStateText(recorder);
  else if (recorder.text?.fold !== undefined) return undefined;
  const lines = recorder.lines;
  recorder.lines = [];
  recorder.parts++;
  return lines;
}





export function finishMatchReplay(recorder: MatchReplayRecorder, moment: Readonly<MomentRecorder>, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): { readonly frame: number; readonly checksum: string } | undefined {
  if (!recorder.open) return undefined;
  endMatchReplaySegment(recorder, moment, world, match, controls, runtime);
  finishStateText(recorder);
  recorder.open = false;
  return recorder.failed || recorder.last === 0 ? undefined : { frame: recorder.last, checksum: recorder.checksum };
}



export interface ReplaySegment {
  readonly start: number;
  readonly startChecksum: string;
  readonly state: ReplayState;

  readonly frames: readonly FrameRows[];

  readonly digests: readonly string[];
  readonly checkpoints: ReadonlyMap<number, string>;
}

export interface ParsedReplay {
  readonly build: string;
  readonly version: string;
  readonly serial: number;
  readonly input: MomentInput;
  readonly segments: readonly ReplaySegment[];

  readonly frame: number;
  readonly checksum: string;
}

interface SegmentText {
  readonly start: number;
  readonly startChecksum: string;
  readonly stateLines: string[];
  readonly frames: FrameRows[];
  readonly digests: string[];
  readonly checkpoints: Map<number, string>;
}


function restoreTuning(record: Readonly<Record<string, unknown>>): void {
  const fighters = record.fighters;
  if (!isSavedList(fighters)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    const fighter = fighters[slot];
    if (!isFields(fighter) || typeof fighter.character !== "number" || !isCharacter(fighter.character)) continue;
    fighters[slot] = { ...fighter, tuning: authoredTuning(fighter.character) };
  }
}


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
      texts.push({ start, startChecksum: second, stateLines: [], frames: [], digests: [], checkpoints: new Map() });
    } else if (segment === undefined) return `"${word}" before the first segment`;
    else if (word === "state") segment.stateLines.push(rest);
    else if (word === "rows") {
      for (const token of lineTokens([rest])) if (!readRun(token, segment.frames)) return `malformed rows "${token}"`;
    } else if (word === "digests") {
      for (const token of lineTokens([rest])) segment.digests.push(token);
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
    if (text.digests.length > 0 && text.digests.length !== text.frames.length) return `the segment at frame ${text.start} has ${text.digests.length} digests for ${text.frames.length} frames`;
    segments.push({ start: text.start, startChecksum: text.startChecksum, state, frames: text.frames, digests: text.digests, checkpoints: text.checkpoints });
  }
  const last = at(segments, segments.length - 1);
  const frame = last.start + last.frames.length;
  if (frame !== header.repro.frame) return `the replay's rows end on frame ${frame}, not the ${header.repro.frame} it names`;
  return { build: header.repro.build, version: header.version, serial: header.serial, input, segments, frame, checksum: header.repro.checksum };
}


export function runReplayFrame(state: ReplayState, input: MomentInput, scratch: FrameScratch, saved: FrameRows, frame: number): boolean {
  return input.kind === "network" ? runNetworkFrame(state, scratch, saved, frame) : runCallbackFrame(state, input.scenario, scratch, saved, frame);
}

export const createFrameScratch = (): FrameScratch => ({ frameInput: createMatchFrameInput(), produced: createFrameControls() });


export const replayStateChecksum = checksumVia;


export interface MatchReplayResult extends ReproResult {

  readonly reached: number;
  readonly recorded: number;

  readonly digests: number;
  readonly divergent: number;
}


export function replayMatch(lines: readonly string[]): MatchReplayResult {
  const replay = parseReplay(lines);
  if (typeof replay === "string") return { checksum: "", frames: 0, problems: [replay], reached: 0, recorded: 0, digests: 0, divergent: 0 };
  const problems: string[] = [];
  const state = createReplaySnapshot();
  const checksums = createReplaySnapshot();
  const scratch = createFrameScratch();
  let frames = 0;
  let reached = 0;
  let recorded = 1;
  let digests = 0;
  let divergent = 0;
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
        return { checksum: checksumVia(checksums, state), frames, problems, reached, recorded, digests, divergent };
      }
      frames++;
      const digest = segment.digests[index];
      if (digest !== undefined) {
        digests++;
        const replayed = frameDigest(state.world, frame);
        if (replayed !== digest) {

          if (divergent === 0) problems.unshift(`first divergent frame ${frame}: digest ${replayed}, the game recorded ${digest}: ${describeDigestDifference(digestDifference(state.world, frame, digest))}`);
          divergent++;
        }
      }
      const expected = segment.checkpoints.get(frame);
      if (expected !== undefined) check(frame, expected);
    }
  }
  check(replay.frame, replay.checksum);
  return { checksum: checksumVia(checksums, state), frames, problems, reached, recorded, digests, divergent };
}


export function replayRepro(repro: Repro): ReproResult {
  return replayMatch(reproLines(repro, repro.lines));
}
