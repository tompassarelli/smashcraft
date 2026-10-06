import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle } from "../sim/codes";
import { BLADEMASTER_MOVES } from "../sim/heroes/blademasterMoves";
import { MOUNTAIN_KING_MOVES } from "../sim/heroes/mountainKingMoves";
import { fighterAt } from "../sim/roster";
import { stateChecksum } from "./canonical";
import { firstStateDifference } from "./difference";
import { copyReplayState, createReplaySnapshot } from "./snapshot";

test("rollback restores authored hero moves and diagnoses changed timing geometry and damage", () => {
  const live = createReplaySnapshot();
  const saved = createReplaySnapshot();
  const f = fighterAt(live.world, 0);
  const original = stateChecksum(live);
  f.tuning.moves = BLADEMASTER_MOVES;
  const authored = stateChecksum(live);
  assertTrue(authored !== original);
  copyReplayState(saved, live);
  f.tuning.moves = MOUNTAIN_KING_MOVES;
  assertEquals(firstStateDifference(saved, live), "fighter[0].moves");
  copyReplayState(live, saved);
  assertEquals(f.tuning.moves, BLADEMASTER_MOVES);
  assertEquals(stateChecksum(live), authored);
  assertEquals(firstStateDifference(saved, live), undefined);
  const move = BLADEMASTER_MOVES.normals[AttackStyle.forwardSmash];
  assertTrue(move !== undefined);
  if (move === undefined) return;
  const region = move.regions[0];
  assertTrue(region !== undefined);
  if (region === undefined) return;
  for (const changed of [
    { ...move, totalFrames: move.totalFrames + 1 },
    { ...move, regions: [{ ...region, hit: { ...region.hit, maxX: region.hit.maxX + 1.0 } }, ...move.regions.slice(1)] },
    { ...move, regions: [{ ...region, hit: { ...region.hit, effect: { ...region.hit.effect, damage: region.hit.effect.damage + 1.0 } } }, ...move.regions.slice(1)] },
  ]) {
    f.tuning.moves = { ...BLADEMASTER_MOVES, normals: { ...BLADEMASTER_MOVES.normals, [AttackStyle.forwardSmash]: changed } };
    assertTrue(stateChecksum(live) !== authored);
    assertEquals(firstStateDifference(saved, live), "fighter[0].moves");
  }
  copyReplayState(live, saved);
  f.tuning.moves = undefined;
  assertEquals(stateChecksum(live), original);
  copyReplayState(live, saved);
  assertEquals(stateChecksum(live), authored);
});
