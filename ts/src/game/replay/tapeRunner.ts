// Runs a decoded tape through match rules, recorded frame execution and
// replay, printing the canonical replay state after each operation, as
// smashcraft:tools/tape-oracle/TapeOracle.wurst does for the Wurst build.
import { imod } from "../../sim/intMath";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type FrameControls, createFrameControls } from "../match/controls";
import { captureFrame, copyMatchFrameInput, createMatchFrameInput, executeMatchFrame, resetMatchFrameInput, type MatchFrameInput } from "../match/frameInput";
import {
  type MatchState, confirmRematch, createMatchState, fighterMask, requestStageSelect, requestStart, selectCharacter, selectStage,
  setParticipants, setStocks, setTimeLimit, updateConnectedHumans,
} from "../match/rules";
import { type ReplayRuntimeState, createReplayRuntimeState, resetPoses } from "../match/runtime";
import { initializeMatchFighters, matchSpawnX } from "../match/step";
import { createFighter } from "../sim/fighter";
import { type Roster, copyControls, createRoster, isActive, neutralControls } from "../sim/roster";
import type { FighterPose } from "../presentation/fighterPose";
import { canonicalReal, canonicalState } from "./canonical";
import { REPLAY_HISTORY_CAPACITY } from "./limits";
import { captureReplaySnapshot, createReplaySnapshot, restoreReplaySnapshot, type ReplaySnapshot } from "./snapshot";
import { type TapeOperation, applyControls } from "./tape";

export type TapeResult =
  | { readonly ok: true; readonly frames: number }
  | { readonly ok: false; readonly line: number; readonly message: string };

/**
 * Before-frame snapshots and executed rows of the current epoch, kept the way
 * Wurst ReplayHistory keeps them. Stands in for the TypeScript ReplayHistory
 * until the replay layer provides one.
 */
interface TapeHistory {
  readonly snapshots: ReplaySnapshot[];
  readonly rows: MatchFrameInput[];
  nextFrame: number;
  count: number;
}

function createTapeHistory(): TapeHistory {
  const snapshots: ReplaySnapshot[] = [];
  const rows: MatchFrameInput[] = [];
  for (let index = 0; index < REPLAY_HISTORY_CAPACITY; index++) {
    snapshots.push(createReplaySnapshot());
    rows.push(createMatchFrameInput());
  }
  return { snapshots, rows, nextFrame: 1, count: 0 };
}

function historySlot<T>(values: readonly T[], frame: number): T {
  const value = values[imod(frame, REPLAY_HISTORY_CAPACITY)];
  if (value === undefined) throw new Error(`history has no slot for frame ${frame}`);
  return value;
}

function retained(history: TapeHistory, frame: number): boolean {
  return frame >= history.nextFrame - history.count && frame < history.nextFrame && historySlot(history.rows, frame).frame === frame;
}

/** Fighter presentation, which the replay checksum leaves out, in the canonical field form. */
function poseFields(slot: number, pose: Readonly<FighterPose>): string {
  const p = `|pose[${slot}].`;
  const { motion } = pose;
  return `${p}animation=${pose.animation}${p}jumpAnimationRemaining=${pose.jumpAnimationRemaining}`
    + `${p}doubleJumpAnimation=${pose.doubleJumpAnimation ? 1 : 0}${p}landingAnimationRate=${canonicalReal(pose.landingAnimationRate)}`
    + `${p}clipIndex=${pose.clipIndex}${p}clipName=${pose.clipName}${p}clipTime=${canonicalReal(pose.clipTime)}`
    + `${p}rate=${canonicalReal(pose.rate)}${p}selectionSerial=${pose.selectionSerial}`
    + `${p}motion=${motion.motion}${p}transitionRemaining=${motion.transitionRemaining}`
    + `${p}respawnRemaining=${motion.respawnRemaining}${p}escapeRemaining=${motion.escapeRemaining}`
    + `${p}ledgeCatchRemaining=${motion.ledgeCatchRemaining}${p}ledgeJump=${motion.ledgeJump ? 1 : 0}`;
}

/** One tape's match, inputs and history; a generator steps it one operation at a time. */
export interface TapeSession {
  readonly game: MatchState;
  readonly world: Roster;
  readonly controls: FrameControls;
  readonly runtime: ReplayRuntimeState;
  readonly history: TapeHistory;
  readonly observed: ReplaySnapshot;
  readonly row: MatchFrameInput;
  readonly produced: FrameControls;
}

export function createTapeSession(): TapeSession {
  return {
    game: createMatchState(), world: createRoster(0), controls: createFrameControls(), runtime: createReplayRuntimeState(),
    history: createTapeHistory(), observed: createReplaySnapshot(), row: createMatchFrameInput(), produced: createFrameControls(),
  };
}

const NEUTRAL = neutralControls();

/** The canonical replay state followed by each fighter's pose. */
function recordState({ game, world, controls, runtime, observed }: TapeSession): string {
  captureReplaySnapshot(observed, world, game, controls, runtime);
  let poses = "";
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) poses += poseFields(slot, runtime.poses[slot]);
  return `${canonicalState(observed)}${poses}`;
}

// The pure part of starting a match in the game: fresh fighters, runtime and history epoch.
function startMatch({ game, world, controls, runtime, history }: TapeSession): void {
  world.mask = fighterMask(game);
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(world, slot)) {
      const x = matchSpawnX(slot);
      world.fighters[slot] = createFighter(game.characterChoices[slot], x, x < 0 ? 1 : -1);
    }
    copyControls(controls.inputs[slot], NEUTRAL);
    clearAttackBuffer(controls.commands[slot]);
    runtime.botAttackDelays[slot] = 0.0;
  }
  runtime.simulationFrame = 0;
  resetPoses(runtime);
  initializeMatchFighters(game, world);
  history.nextFrame = 1;
  history.count = 0;
  for (const recorded of history.rows) resetMatchFrameInput(recorded);
}

function runFrame(session: TapeSession, frame: number): string | undefined {
  const { game, world, controls, runtime, history, row, produced } = session;
  if (!captureFrame(row, frame, world.mask, produced, runtime)) return `capture refused frame ${frame}`;
  if (frame !== history.nextFrame || runtime.simulationFrame !== frame - 1) return `history refused frame ${frame}`;
  captureReplaySnapshot(historySlot(history.snapshots, frame), world, game, controls, runtime);
  copyMatchFrameInput(historySlot(history.rows, frame), row);
  history.nextFrame++;
  history.count = Math.min(history.count + 1, REPLAY_HISTORY_CAPACITY);
  if (!executeMatchFrame(row, game, world, controls, runtime, frame)) return `execution refused frame ${frame}`;
  for (const slot of PARTICIPANT_SLOTS) {
    copyControls(produced.inputs[slot], NEUTRAL);
    clearAttackBuffer(produced.commands[slot]);
  }
  return undefined;
}

function replay({ game, world, controls, runtime, history }: TapeSession, first: number, last: number): boolean {
  if (first > last || last !== runtime.simulationFrame) return false;
  for (let frame = first; frame <= last; frame++) if (!retained(history, frame)) return false;
  restoreReplaySnapshot(historySlot(history.snapshots, first), world, game, controls, runtime);
  for (let frame = first; frame <= last; frame++) {
    if (!executeMatchFrame(historySlot(history.rows, frame), game, world, controls, runtime, frame)) return false;
  }
  return true;
}

const flag = (value: boolean) => (value ? "1" : "0");

/** Performs one operation: its record's result field, or a refusal. */
function perform(session: TapeSession, operation: TapeOperation): { result: string } | { refused: string } | undefined {
  const { game, produced } = session;
  switch (operation.kind) {
    case "input":
      applyControls(produced.inputs[operation.slot], operation.controls);
      for (const attack of operation.attacks) queueAttack(produced.commands[operation.slot], attack);
      return undefined;
    case "frame": {
      const refused = runFrame(session, operation.frame);
      return refused === undefined ? { result: `${operation.frame}` } : { refused };
    }
    case "rollback":
      return replay(session, operation.first, operation.last)
        ? { result: `${operation.first}..${operation.last}` }
        : { refused: `history refused replay ${operation.first}..${operation.last}` };
    case "participants":
      setParticipants(game, operation.humans, operation.computers);
      return { result: "-" };
    case "character":
      selectCharacter(game, operation.slot, operation.value);
      return { result: "-" };
    case "stage":
      selectStage(game, operation.slot, operation.value);
      return { result: "-" };
    case "stocks":
      setStocks(game, operation.slot, operation.value);
      return { result: "-" };
    case "time":
      setTimeLimit(game, operation.slot, operation.value);
      return { result: "-" };
    case "stage-select":
      return { result: flag(requestStageSelect(game, operation.slot)) };
    case "start": {
      const started = requestStart(game, operation.slot);
      if (started) startMatch(session);
      return { result: flag(started) };
    }
    case "rematch": {
      const confirmed = confirmRematch(game, operation.slot);
      if (confirmed) updateConnectedHumans(game, game.humanMask);
      return { result: flag(confirmed) };
    }
  }
}

/**
 * Performs one operation and, unless it is input, emits its record:
 * "LINE OPERATION RESULT STATE". Returns the refusal, if any.
 */
export function performTapeOperation(session: TapeSession, operation: TapeOperation, emit?: (record: string) => void): string | undefined {
  const outcome = perform(session, operation);
  if (outcome === undefined) return undefined;
  if ("refused" in outcome) return outcome.refused;
  if (emit !== undefined) emit(`${operation.line} ${operation.kind} ${outcome.result} ${recordState(session)}`);
  return undefined;
}

/** Runs every operation in order, stopping at the first one the rules or history refuse. */
export function runTape(operations: readonly TapeOperation[], emit: (record: string) => void): TapeResult {
  const session = createTapeSession();
  let frames = 0;
  for (const operation of operations) {
    const refused = performTapeOperation(session, operation, emit);
    if (refused !== undefined) return { ok: false, line: operation.line, message: refused };
    if (operation.kind === "frame") frames++;
  }
  return { ok: true, frames };
}
