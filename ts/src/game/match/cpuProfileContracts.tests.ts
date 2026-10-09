
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
import { CPU_PROFILES, type CpuOpponentId, type CpuTier } from "./cpuProfiles";
import { replayChecksum } from "../replay/matchReplay";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";
import { sweep } from "../../runtime/sweep";

const NEUTRAL = neutralControls();


function computerMatch(opponent: CpuOpponentId, tier: CpuTier, seed: number) {
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = 0;
  match.timeLimitMinutes = 0;
  for (const slot of [0, 1] as const) {
    match.cpuOpponents[slot] = opponent;
    match.cpuResolvedOpponents[slot] = opponent;
    match.cpuTiers[slot] = tier;
  }
  match.matchSeed = seed;
  const state: ReplayState = {
    world: createRoster(3, [createFighter(Character.rifleman, -200.0, 1), createFighter(Character.rifleman, 200.0, -1)]),
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

const checksumAfter = (opponent: CpuOpponentId, tier: CpuTier, seed: number): string => {
  const game = computerMatch(opponent, tier, seed);
  game.run(300);
  return stateChecksum(game.state);
};

test("the same seed and named profile play the same match; changed seed or profile changes it [invariant]", () => {
  const played = checksumAfter("wren", "intermediate", 3);
  assertEquals(checksumAfter("wren", "intermediate", 3), played);
  assertFalse(checksumAfter("wren", "intermediate", 4) === played);
  assertFalse(checksumAfter("ember", "expert", 3) === played);
});

sweep("150 named profile and seed combinations replay restored gameplay with zero state differences [spec #184] [invariant]", () => {
  let restored = 0;
  for (const profile of CPU_PROFILES) for (let seed = 0; seed < 5; seed++) {
    const game = computerMatch(profile.opponent, profile.tier, seed);
    game.run(90);
    const saved = createReplaySnapshot();
    copyReplayState(saved, game.state);
    assertTrue(saved.runtime.botMemory.history.length > 0);
    game.run(30);
    const ahead = createReplaySnapshot();
    copyReplayState(ahead, game.state);
    copyReplayState(game.state, saved);
    assertEquals(game.state.match.cpuOpponents[0], profile.opponent);
    assertEquals(game.state.match.cpuResolvedOpponents[0], profile.opponent);
    assertEquals(game.state.match.cpuTiers[0], profile.tier);
    game.run(30);
    assertEquals(firstStateDifference(ahead, game.state), undefined);
    restored++;
  }
  assertEquals(restored, 150);
});

test("selected identity, resolved identity and tier each affect canonical state, replay checksum and field differences [spec #184]", () => {
  const expected = createReplaySnapshot();
  const changed = createReplaySnapshot();
  const checksum = (state: ReplayState) => replayChecksum(state.world, state.match, state.runtime);
  const mutations: readonly ((state: ReplayState) => void)[] = [
    state => { state.match.cpuOpponents[0] = "random"; },
    state => { state.match.cpuTiers[0] = "expert"; },
    state => { state.match.cpuResolvedOpponents[0] = "ember"; },
  ];
  const paths = ["match.slot0.cpuOpponent", "match.slot0.cpuTier", "match.slot0.cpuResolvedOpponent"];
  for (let index = 0; index < mutations.length; index++) {
    copyReplayState(changed, expected);
    const mutate = mutations[index];
    if (mutate === undefined) throw new Error("missing CPU state mutation");
    mutate(changed);
    assertTrue(stateChecksum(expected) !== stateChecksum(changed));
    assertTrue(checksum(expected) !== checksum(changed));
    assertEquals(firstStateDifference(expected, changed), paths[index]);
  }
});
