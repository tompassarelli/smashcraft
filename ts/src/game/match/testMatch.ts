// Test fixtures only: a match whose frames run through captured rows and the
// frame executor, as recorded play does.
import { assertTrue } from "waygate/src/runtime/testing";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { type Roster, createRoster, isActive } from "../sim/roster";
import { type FrameControls, createFrameControls } from "./controls";
import { type MatchFrameInput, captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { type MatchState, Phase, createMatchState, setHumanMask } from "./rules";
import { type ReplayRuntimeState, createReplayRuntimeState } from "./runtime";
import type { ReplayState } from "../replay/snapshot";

export interface TestMatch {
  readonly world: Roster;
  readonly game: MatchState;
  readonly inputs: FrameControls;
  readonly runtime: ReplayRuntimeState;
  readonly row: MatchFrameInput;
}

/** Human participants of one character, 150 apart from x = -240, in an untimed match. */
export function testMatch(mask: number, character: Character): TestMatch {
  const world = createRoster(mask);
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) world.fighters[slot] = createFighter(character, -240.0 + slot * 150.0, 1);
  const game = createMatchState();
  setHumanMask(game, mask);
  game.phase = Phase.match;
  game.timeLimitMinutes = 0;
  return { world, game, inputs: createFrameControls(), runtime: createReplayRuntimeState(), row: createMatchFrameInput() };
}

/** Captures the current inputs as the next frame's row. */
export function captureNext(match: TestMatch): void {
  const { row, world, inputs, runtime } = match;
  assertTrue(captureFrame(row, runtime.simulationFrame + 1, world.mask, inputs, runtime));
}

export function executeCaptured(match: TestMatch): void {
  const { row, game, world, inputs, runtime } = match;
  assertTrue(executeMatchFrame(row, game, world, inputs, runtime, runtime.simulationFrame + 1));
}

export function executeNext(match: TestMatch): void {
  captureNext(match);
  executeCaptured(match);
}

/** The match as replay state, for history saves, replays and snapshots. */
export function replayState({ world, game, inputs, runtime }: TestMatch): ReplayState {
  return { world, match: game, controls: inputs, runtime };
}
