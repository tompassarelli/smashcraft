





import { at } from "wisp/src/runtime/lookup";
import { lineTokens, parseRecord, recordTokens, tokenLines } from "wisp/src/runtime/recordText";
import { REPRO_LINE_WIDTH, type Repro, type ReproInspection, type ReproResult } from "wisp/src/runtime/repro";
import { floorMod } from "wisp/src/sim/intMath";
import { adaptInput } from "../input/adapter";
import { type AttackBuffer, clearAttackBuffer } from "../input/attackBuffer";
import { INPUT_ROW_NUMBERS, type InputRow, emptyInput, loadInputNumbers, storeInputNumbers } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type ParticipantInputs, type Slots, participantActive } from "../input/participants";
import { type FrameControls, createFrameControls } from "../match/controls";
import { type SavedBotStrategy, restoredBotStrategy, savedBotStrategy } from "../match/botStrategy";
import { settleBotMemoryChecksums } from "../match/botPerception";
import { padDecimal } from "../netcode/journal/decimal";
import { type MatchFrameInput, captureFrame, captureNetworkFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import type { PacingAndPresentation } from "../match/pacingAndPresentation";
import { type MatchState, computerActive } from "../match/rules";
import { type MapBuild, type Scenario, isScenario, isShadow } from "../shell/build";
import { produceScenarioComputerInput } from "../shell/scenarios";
import { type Fighter, placedObject, PROJECTILE_CAPACITY } from "../sim/fighter";
import { mutableProjectile } from "../sim/fighterProjectiles";
import { initializeInfluenceOperands } from "../sim/influenceOperands";
import type { AuthoredSpecial, FighterSpecials, SpecialPlacement, SpecialProjectile } from "../sim/heroSpecials";
import { type Roster, createRoster, fighterAt, isActive } from "../sim/roster";
import { authoredTuning } from "../sim/tuning";
import { canonicalState, fighterSpecialsCanonical, specialPlacementCanonical, specialProjectileCanonical, stateChecksum } from "./canonical";
import { type ReplayState, captureReplaySnapshot, copyReplayState, createReplaySnapshot } from "./snapshot";


export const SNAPSHOT_FRAMES = 120;
const SNAPSHOTS = 6;

export const MOMENT_FRAMES = 600;

export const ROW_FRAMES = SNAPSHOT_FRAMES * SNAPSHOTS;

const SECTION_WIDTH = 6;


export type MomentInput = { readonly kind: "network" } | { readonly kind: "callback"; readonly scenario: Scenario };


const MOMENT_REQUEST = "JM1";
export const momentRequest = (epoch: number) => `${MOMENT_REQUEST}${padDecimal(epoch, 10)}`;
export const isMomentRequest = (wire: string) => wire.startsWith(MOMENT_REQUEST);

export const momentInput = (build: Readonly<MapBuild>): MomentInput => (isShadow(build.input) ? { kind: "network" } : { kind: "callback", scenario: build.scenario });






interface MomentSave {
  readonly input: MomentInput;
  readonly start: number;
  readonly last: number;

  readonly checkpoints: readonly number[];
  readonly checkpointFrames: readonly number[];

  readonly rows: readonly string[];
  readonly lines: string[];
  checksum: string;
  step: number;
}

export interface MomentRecorder {

  readonly snapshots: ReplayState[];

  readonly snapshotFrames: number[];
  nextSnapshot: number;

  readonly rows: Slots<number[]>;

  readonly rowFrames: number[];
  readonly rowMasks: number[];

  last: number | undefined;





  end: ReplayState;
  ended: boolean;

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


export function recordMomentRow(recorder: MomentRecorder, frame: number, slot: number, row: Readonly<InputRow>): void {
  const index = claimRows(recorder, frame);
  storeInputNumbers(at(recorder.rows, slot), index * INPUT_ROW_NUMBERS, row);
  recorder.rowMasks[index] = at(recorder.rowMasks, index) | (1 << slot);
}


export function momentFrameRan(recorder: MomentRecorder, frame: number): void {
  claimRows(recorder, frame);
  recorder.last = frame;
}


export function keepMomentEnd(recorder: MomentRecorder, world: Readonly<Roster>, match: Readonly<MatchState>, controls: Readonly<FrameControls>, runtime: Readonly<PacingAndPresentation>): void {
  if (recorder.last === undefined || recorder.ended) return;
  captureReplaySnapshot(recorder.end, world, match, controls, runtime);
  recorder.ended = true;
}


export function checksumOf(scratch: ReplayState, state: Readonly<ReplayState>): string {
  copyReplayState(scratch, state);
  return stateChecksum(scratch);
}






export const KEYED_BY_ACTION = ["attacks", "normals", "throws"];


type SavedRuntime = Omit<PacingAndPresentation, "botStrategies"> & { readonly botStrategies: Slots<SavedBotStrategy> };

export function savedRuntime(runtime: Readonly<PacingAndPresentation>): SavedRuntime {
  settleBotMemoryChecksums(runtime.botMemory);
  const strategies = runtime.botStrategies;
  return { ...runtime, botStrategies: [savedBotStrategy(strategies[0]), savedBotStrategy(strategies[1]), savedBotStrategy(strategies[2]), savedBotStrategy(strategies[3])] };
}

export function savedView(state: Readonly<ReplayState>) {
  const fighters: (Fighter | undefined)[] = [];
  for (const slot of PARTICIPANT_SLOTS) if (isActive(state.world, slot)) fighters[slot] = fighterAt(state.world, slot);
  return { mask: state.world.mask, fighters, match: state.match, commands: state.controls.commands, runtime: savedRuntime(state.runtime) };
}


const ROW_TEXT = filled(INPUT_ROW_NUMBERS, 0);


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


export const runToken = (recorder: MomentRecorder, index: number, count: number): string => `${count}:${frameRowText(recorder, index)}`;


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


interface SavedMoment {
  readonly lines: readonly string[];
  readonly frame: number;
  readonly checksum: string;
}






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

  readonly frames: readonly FrameRows[];
}

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;
// Decoded Lua arrays need not start at index 1; index them as tables.
const isList = (value: unknown): value is readonly unknown[] => isObject(value);
const isFighter = (value: unknown): value is Fighter => isObject(value) && "character" in value && typeof value.character === "number" && "motion" in value && isObject(value.motion);
const isMatch = (value: unknown): value is MatchState => isObject(value) && "phase" in value && typeof value.phase === "number" && "characterChoices" in value && isObject(value.characterChoices);
const isRuntime = (value: unknown): value is SavedRuntime => isObject(value) && "simulationFrame" in value && typeof value.simulationFrame === "number" && "poses" in value && isObject(value.poses);

function isCommands(value: unknown): value is Slots<AttackBuffer> {
  if (!isList(value)) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    const buffer = value[slot];
    if (!isObject(buffer) || !("graceFrames" in buffer) || typeof buffer.graceFrames !== "number") return false;
  }
  return true;
}


function authoredParts(specials: Readonly<FighterSpecials>, projectiles: Map<string, SpecialProjectile>, placements: Map<string, SpecialPlacement>): void {
  const projectile = (spec: SpecialProjectile | undefined) => {
    if (spec !== undefined) projectiles.set(specialProjectileCanonical(spec, ""), spec);
  };
  const move = (special: AuthoredSpecial | undefined): void => {
    if (special === undefined) return;
    move(special.ex);
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
    move(kit.recall);
    move(kit.marked?.special);
  }
}








function rebindAuthoredKit(fighter: Fighter): void {
  const authored = authoredTuning(fighter.character).specials;
  if (authored === undefined || fighterSpecialsCanonical(fighter.tuning.specials) !== fighterSpecialsCanonical(authored)) return;
  fighter.tuning.specials = authored;
  const projectiles = new Map<string, SpecialProjectile>();
  const placements = new Map<string, SpecialPlacement>();
  authoredParts(authored, projectiles, placements);
  for (let i = 0; i < PROJECTILE_CAPACITY; i++) {
    const live = at(fighter.projectiles, i);
    if (live.spec !== undefined) mutableProjectile(fighter, i).spec = projectiles.get(specialProjectileCanonical(live.spec, "")) ?? live.spec;
  }
  for (let index = 0; index <= fighter.pack.length; index++) {
    const animal = placedObject(fighter, index);
    const placed = animal.spec;
    if (placed !== undefined) animal.spec = placements.get(specialPlacementCanonical(placed, "")) ?? placed;
  }
}


export function savedState(record: Readonly<Record<string, unknown>>): ReplayState | undefined {
  const { mask, fighters, match, commands, runtime } = record;
  if (typeof mask !== "number" || !isList(fighters) || !isMatch(match) || !isCommands(commands) || !isRuntime(runtime)) return undefined;
  const world = createRoster(mask);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighters[slot];
    if (!isFighter(fighter)) return undefined;
    rebindAuthoredKit(fighter);
    initializeInfluenceOperands(fighter);
    world.fighters[slot] = fighter;
  }
  const strategies = runtime.botStrategies;
  return { world, match, controls: { inputs: createFrameControls().inputs, commands }, runtime: { ...runtime,
    botStrategies: [restoredBotStrategy(strategies[0]), restoredBotStrategy(strategies[1]), restoredBotStrategy(strategies[2]), restoredBotStrategy(strategies[3])],
  } };
}

export const wholeNumber = (text: string | undefined) => {
  const value = Number(text);
  return text !== undefined && text.length > 0 && value === Math.floor(value) ? value : undefined;
};


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


export interface FrameScratch {
  readonly frameInput: MatchFrameInput;
  readonly produced: FrameControls;
}






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


export function runNetworkFrame(state: ReplayState, scratch: FrameScratch, saved: FrameRows, frame: number): boolean {
  const { world, match, controls, runtime } = state;
  return captureNetworkFrame(scratch.frameInput, frame, saved.rows, world, saved.mask)
    && executeMatchFrame(scratch.frameInput, match, world, controls, runtime, frame);
}


function replayMoment(repro: Repro, requested?: number): { readonly result: ReproResult; readonly inspection?: ReproInspection } {
  const moment = parseMoment(repro.lines, repro.frame);
  if (typeof moment === "string") return { result: { checksum: "", frames: 0, problems: [moment] } };
  if (requested !== undefined && (requested !== Math.floor(requested) || requested < moment.start || requested > repro.frame)) return { result: { checksum: "", frames: 0, problems: [`frame ${requested} is outside the saved interval ${moment.start}..${repro.frame}`] } };
  const problems: string[] = [];
  const state = createReplaySnapshot();
  const checksums = createReplaySnapshot();
  copyReplayState(state, moment.state);
  const restored = checksumOf(checksums, state);
  if (restored !== moment.startChecksum) problems.push(`the snapshot of frame ${moment.start} restores to checksum ${restored}; the game recorded ${moment.startChecksum}`);
  let inspection: ReproInspection | undefined;
  const capture = (frame: number): void => {
    if (frame !== requested) return;
    const checksum = checksumOf(checksums, state);
    const canonical = canonicalState(checksums);
    const fields: { path: string; value: string }[] = [];
    for (const token of canonical.split("|")) {
      const equals = token.indexOf("=");
      if (equals >= 0) fields.push({ path: token.substring(0, equals), value: token.substring(equals + 1) });
    }
    inspection = { frame, checksum, state: canonical, fields };
  };
  capture(moment.start);
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
    capture(frame);
    const recorded = moment.checkpoints.get(frame);
    if (recorded === undefined || diverged) continue;
    const replayed = checksumOf(checksums, state);
    if (replayed === recorded) continue;
    diverged = true;
    problems.push(`frame ${frame} replays to checksum ${replayed}; the game recorded ${recorded}`);
  }
  const result = { checksum: checksumOf(checksums, state), frames, problems };
  return inspection === undefined ? { result } : { result, inspection };
}


export function replayRepro(repro: Repro): ReproResult {
  return replayMoment(repro).result;
}


export function inspectRepro(repro: Repro, frame: number): ReproInspection | string {
  const { result, inspection } = replayMoment(repro, frame);
  if (result.problems.length > 0) return result.problems.join("; ");
  if (result.checksum !== repro.checksum) return `the replay reached checksum ${result.checksum}; the game recorded ${repro.checksum}`;
  return inspection ?? `frame ${frame} could not be inspected`;
}
