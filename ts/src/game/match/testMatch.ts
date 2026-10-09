

import { assertTrue } from "wisp/src/runtime/testing";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { type Roster, createRoster, isActive } from "../sim/roster";
import { type FrameControls, createFrameControls } from "./controls";
import { type MatchFrameInput, captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { type PacingAndPresentation, createPacingAndPresentation } from "./pacingAndPresentation";
import { type MatchState, Phase, createMatchState, requestStart, setHumanMask } from "./rules";
import type { ReplayState } from "../replay/snapshot";

export interface TestMatch {
  readonly world: Roster;
  readonly game: MatchState;
  readonly inputs: FrameControls;
  readonly runtime: PacingAndPresentation;
  readonly row: MatchFrameInput;
}


export function testMatch(mask: number, character: Character): TestMatch {
  const world = createRoster(mask);
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) world.fighters[slot] = createFighter(character, -240.0 + slot * 150.0, 1);
  const game = createMatchState();
  setHumanMask(game, mask);
  game.phase = Phase.match;
  game.timeLimitMinutes = 0;
  return { world, game, inputs: createFrameControls(), runtime: createPacingAndPresentation(), row: createMatchFrameInput() };
}


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


export function replayState({ world, game, inputs, runtime }: TestMatch): ReplayState {
  return { world, match: game, controls: inputs, runtime };
}






export function startAtGo(game: MatchState, slot: number): boolean {
  const started = requestStart(game, slot);
  game.startHold = 0;
  return started;
}
