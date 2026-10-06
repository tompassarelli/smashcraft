// Computer levels and the match seed (smashcraft:docs/design/cpu-levels.md):
// the same seed and levels play the same match, another seed or level plays
// another, and a restored snapshot replays the computers' decisions exactly.
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { copyControls, createRoster, isActive, neutralControls } from "../sim/roster";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import { CPU_LEVEL_MAX, CPU_LEVEL_MIN, cpuSkill, isCpuLevel, nextMatchSeed } from "./cpuLevel";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState, requestStart, setCpuLevel, setParticipants } from "./rules";

const NEUTRAL = neutralControls();

/** Archer against Rifleman on the first stage, both computers at `levels` under `seed`. */
function computerMatch(levels: readonly [number, number], seed: number) {
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.timeLimitMinutes = 0;
  match.cpuLevels[0] = levels[0];
  match.cpuLevels[1] = levels[1];
  match.matchSeed = seed;
  const state: ReplayState = {
    world: createRoster(3, [createFighter(Character.archer, -200.0, 1), createFighter(Character.rifleman, 200.0, -1)]),
    match, controls: createFrameControls(), runtime: createPacingAndPresentation(),
  };
  const produced = createFrameControls();
  const row = createMatchFrameInput();
  const run = (frames: number) => {
    for (let n = 0; n < frames; n++) {
      const frame = state.runtime.simulationFrame + 1;
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(state.world, slot)) continue;
        copyControls(produced.inputs[slot], NEUTRAL);
        clearAttackBuffer(produced.commands[slot]);
        produceComputerInput(state.match, state.world, state.runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
      }
      assertTrue(captureFrame(row, frame, state.world.mask, produced, state.runtime));
      assertTrue(executeMatchFrame(row, state.match, state.world, state.controls, state.runtime, frame));
    }
  };
  return { state, run };
}

const checksumAfter = (levels: readonly [number, number], seed: number, frames: number): string => {
  const game = computerMatch(levels, seed);
  game.run(frames);
  return stateChecksum(game.state);
};

test("the same seed and levels play the same match; another seed or level plays another", () => {
  const played = checksumAfter([5, 5], 3, 900);
  assertEquals(checksumAfter([5, 5], 3, 900), played);
  assertFalse(checksumAfter([5, 5], 4, 900) === played);
  assertFalse(checksumAfter([9, 1], 3, 900) === played);
});

test("a restored snapshot replays the computers' decisions to the same state", () => {
  const game = computerMatch([7, 2], 11);
  game.run(300);
  const saved = createReplaySnapshot();
  copyReplayState(saved, game.state);
  game.run(300);
  const ahead = createReplaySnapshot();
  copyReplayState(ahead, game.state);
  copyReplayState(game.state, saved);
  assertEquals(game.state.match.cpuLevels[1], 2);
  assertEquals(game.state.match.matchSeed, 11);
  game.run(300);
  assertEquals(firstStateDifference(ahead, game.state), undefined);
});

test("levels run 1 to 9, harder at every step, and a level is set only for a computer at fighter selection", () => {
  assertFalse(isCpuLevel(0));
  assertFalse(isCpuLevel(10));
  assertFalse(isCpuLevel(4.5));
  for (let level = CPU_LEVEL_MIN + 1; level <= CPU_LEVEL_MAX; level++) {
    const easier = cpuSkill(level - 1);
    const harder = cpuSkill(level);
    assertTrue(harder.reactionFrames < easier.reactionFrames);
    assertTrue(harder.attackPause < easier.attackPause);
    assertTrue(harder.defendTenths >= easier.defendTenths);
    assertTrue(harder.misplay <= easier.misplay && harder.idle <= easier.idle);
    assertTrue(harder.diTenths >= easier.diTenths && harder.grabMashFrames <= easier.grabMashFrames);
    assertTrue(harder.techMiss * easier.techOutOf <= easier.techMiss * harder.techOutOf);
  }
  const game = createMatchState();
  setParticipants(game, 0b001, 0b100);
  setCpuLevel(game, 0, 2, 3);
  assertEquals(game.cpuLevels[2], 3);
  setCpuLevel(game, 0, 1, 3);
  assertEquals(game.cpuLevels[1], CPU_LEVEL_MAX);
  setCpuLevel(game, 0, 2, 10);
  assertEquals(game.cpuLevels[2], 3);
  game.phase = Phase.match;
  setCpuLevel(game, 0, 2, 5);
  assertEquals(game.cpuLevels[2], 3);
});

test("the first match plays seed 0 and each later match the next seed", () => {
  const game = createMatchState();
  setParticipants(game, 0b001, 0b010);
  game.characterReadiness[0] = true;
  game.phase = Phase.stageMenu;
  assertTrue(requestStart(game, 0));
  assertEquals(game.matchSeed, 0);
  game.matchFrame = 120;
  game.phase = Phase.stageMenu;
  assertTrue(requestStart(game, 0));
  assertEquals(game.matchSeed, nextMatchSeed(0));
});
