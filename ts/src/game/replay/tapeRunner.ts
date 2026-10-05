// Runs a decoded tape through match rules, recorded frame execution and the
// replay history, printing the canonical replay state after each operation.
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type FrameControls, createFrameControls } from "../match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame, resetMatchFrameInput, type MatchFrameInput } from "../match/frameInput";
import {
  confirmRematch, createMatchState, fighterMask, requestStageSelect, requestStart, selectCharacter, selectStage,
  setParticipants, setStocks, setTimeLimit, updateConnectedHumans,
} from "../match/rules";
import { createReplayRuntimeState, resetPoses } from "../match/runtime";
import { initializeMatchFighters, matchSpawnX } from "../match/step";
import { createFighter } from "../sim/fighter";
import { copyControls, createRoster, isActive, neutralControls } from "../sim/roster";
import type { FighterPose } from "../presentation/fighterPose";
import { canonicalReal, canonicalState } from "./canonical";
import { ReplayCorrections, ReplayHistory } from "./history";
import { REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";
import { type TapeOperation, applyControls } from "./tape";

export type TapeResult =
  | { readonly ok: true; readonly frames: number }
  | { readonly ok: false; readonly line: number; readonly message: string };

/** Fighter presentation, which the replay checksum leaves out, in the canonical field form. */
function poseFields(slot: number, pose: Readonly<FighterPose>): string {
  const p = `|pose[${slot}].`;
  const { motion } = pose;
  return `${p}animation=${pose.animation}${p}jumpAnimationRemaining=${pose.jumpAnimationRemaining}`
    + `${p}doubleJumpAnimation=${pose.doubleJumpAnimation ? 1 : 0}${p}landingAnimationRate=${canonicalReal(pose.landingAnimationRate)}`
    + `${p}clipIndex=${pose.clipIndex ?? -1}${p}clipName=${pose.clipName}${p}clipTime=${canonicalReal(pose.clipTime)}`
    + `${p}rate=${canonicalReal(pose.rate)}${p}selectionSerial=${pose.selectionSerial}`
    + `${p}motion=${motion.motion}${p}transitionRemaining=${motion.transitionRemaining}`
    + `${p}respawnRemaining=${motion.respawnRemaining}${p}escapeRemaining=${motion.escapeRemaining}`
    + `${p}ledgeCatchRemaining=${motion.ledgeCatchRemaining}${p}ledgeJump=${motion.ledgeJump ? 1 : 0}`;
}

/** One tape's match, inputs and history; a generator steps it one operation at a time. */
export interface TapeSession {
  readonly live: ReplayState;
  readonly history: ReplayHistory;
  readonly corrections: ReplayCorrections;
  readonly observed: ReplayState;
  readonly row: MatchFrameInput;
  readonly correction: MatchFrameInput;
  readonly produced: FrameControls;
  epoch: number;
}

export function createTapeSession(): TapeSession {
  return {
    live: { world: createRoster(0), match: createMatchState(), controls: createFrameControls(), runtime: createReplayRuntimeState() },
    history: new ReplayHistory(), corrections: new ReplayCorrections(), observed: createReplaySnapshot(),
    row: createMatchFrameInput(), correction: createMatchFrameInput(), produced: createFrameControls(), epoch: 0,
  };
}

const NEUTRAL = neutralControls();

/** The canonical replay state followed by each fighter's pose. */
function recordState({ live, observed }: TapeSession): string {
  copyReplayState(observed, live);
  let poses = "";
  for (const slot of PARTICIPANT_SLOTS) if (isActive(live.world, slot)) poses += poseFields(slot, live.runtime.poses[slot]);
  return `${canonicalState(observed)}${poses}`;
}

// The pure part of starting a match in the game: fresh fighters, runtime and history epoch.
function startMatch(session: TapeSession): boolean {
  const { match, world, controls, runtime } = session.live;
  world.mask = fighterMask(match);
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(world, slot)) {
      const x = matchSpawnX(slot);
      world.fighters[slot] = createFighter(match.characterChoices[slot], x, x < 0 ? 1 : -1);
    }
    copyControls(controls.inputs[slot], NEUTRAL);
    clearAttackBuffer(controls.commands[slot]);
    runtime.botAttackDelays[slot] = 0.0;
  }
  runtime.simulationFrame = 0;
  resetPoses(runtime);
  initializeMatchFighters(match, world);
  session.epoch++;
  return session.history.beginEpoch(session.epoch, 1, REPLAY_MAX_CORRECTION_FRAMES) && session.corrections.beginEpoch(session.epoch);
}

function clearProduced({ produced }: TapeSession): void {
  for (const slot of PARTICIPANT_SLOTS) {
    copyControls(produced.inputs[slot], NEUTRAL);
    clearAttackBuffer(produced.commands[slot]);
  }
}

function runFrame(session: TapeSession, frame: number, predicted: boolean): string | undefined {
  const { live, history, row, produced, epoch } = session;
  const { match, world, controls, runtime } = live;
  if (!captureFrame(row, frame, world.mask, produced, runtime)) return `capture refused frame ${frame}`;
  if (!(predicted ? history.saveSpeculative(epoch, row, live) : history.save(epoch, row, live))) return `history refused frame ${frame}`;
  if (!executeMatchFrame(row, match, world, controls, runtime, frame)) return `execution refused frame ${frame}`;
  clearProduced(session);
  return undefined;
}

/** Replaces a frame with the inputs given since, as a one-row batch: the earliest replayed frame, "unchanged" or "rejected". */
function correctFrame(session: TapeSession, frame: number): string {
  const { live, history, corrections, correction, produced, epoch } = session;
  resetMatchFrameInput(correction);
  corrections.clear();
  const captured = captureFrame(correction, frame, live.world.mask, produced, live.runtime) && corrections.add(correction);
  clearProduced(session);
  return captured ? `${history.correct(epoch, corrections, live)}` : "rejected";
}

const flag = (value: boolean) => (value ? "1" : "0");

/** Performs one operation: its record's result field, or a refusal. */
function perform(session: TapeSession, operation: TapeOperation): { result: string } | { refused: string } | undefined {
  const { live, history, produced, epoch } = session;
  const game = live.match;
  switch (operation.kind) {
    case "input":
      applyControls(produced.inputs[operation.slot], operation.controls);
      for (const attack of operation.attacks) queueAttack(produced.commands[operation.slot], attack);
      return undefined;
    case "frame":
    case "predict": {
      const refused = runFrame(session, operation.frame, operation.kind === "predict");
      return refused === undefined ? { result: `${operation.frame}` } : { refused };
    }
    case "correct":
      return { result: correctFrame(session, operation.frame) };
    case "rollback":
      return operation.last === live.runtime.simulationFrame && history.replay(epoch, operation.first, operation.last, live)
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
      if (started && !startMatch(session)) return { refused: `history refused epoch ${session.epoch}` };
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
    if (operation.kind === "frame" || operation.kind === "predict") frames++;
  }
  return { ok: true, frames };
}
