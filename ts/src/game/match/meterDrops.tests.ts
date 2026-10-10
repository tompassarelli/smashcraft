import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { clearAttackBuffer } from "../input/attackBuffer";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { prepareQuickMatch } from "../shell/devSettings";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { ROSTER_MANA } from "../sim/mana";
import { copyControls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { testWorld } from "../sim/testWorld";
import { produceComputerInput, dropContest } from "./botPlay";
import { useMatchSeed } from "./botRandom";
import { createFrameControls } from "./controls";
import { CPU_TIERS } from "./cpuProfiles";
import { cpuSkill } from "./cpuSkill";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import {
  DROP_FIRST_SECONDS, DROP_INTERVAL_MAX_SECONDS, DROP_INTERVAL_MIN_SECONDS, DROP_METER, DROP_TELEGRAPH_FRAMES, dropTelegraphFrames,
  advanceMeterDrops, meterDropPoint, meterDropPoints, scheduleMeterDrops,
} from "./meterDrops";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setHumanCount, setParticipants } from "./rules";
import { stepMatch } from "./step";

function quickGame(seed: number, stage = 0) {
  const game = createMatchState();
  setHumanCount(game, 2);
  game.matchSeed = seed;
  assertTrue(prepareQuickMatch(game, stage));
  game.endless = true;
  return game;
}

test("the first drop telegraphs three seconds at centre stage and grants exactly one EX segment to the fighter touching it [spec #385]", () => {
  assertEquals(DROP_TELEGRAPH_FRAMES, 3 * MATCH_TICKS_PER_SECOND);
  assertEquals(DROP_METER, ROSTER_MANA.exCost);
  const on = quickGame(385);
  const off = quickGame(385);
  off.drops.on = false;
  scheduleMeterDrops(off);
  const spawn = on.drops.nextSpawnFrame;
  assertEquals(spawn, 1 + DROP_FIRST_SECONDS * MATCH_TICKS_PER_SECOND);
  assertEquals(on.drops.nextPoint, 0);
  assertEquals(meterDropPoint(on.stageChoice, 0).x, 0.0);
  assertEquals(dropTelegraphFrames(on.drops, spawn - DROP_TELEGRAPH_FRAMES - 1), undefined);
  assertEquals(dropTelegraphFrames(on.drops, spawn - DROP_TELEGRAPH_FRAMES), DROP_TELEGRAPH_FRAMES);
  assertEquals(dropTelegraphFrames(on.drops, spawn - 1), 1);
  assertEquals(off.drops.nextSpawnFrame, 0);
  const worlds = [on, off].map(() => testWorld(createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, 300.0, -1)));
  const controls = [createFrameControls(), createFrameControls()];
  const games = [on, off];
  for (let frame = 1; frame <= spawn; frame++) for (let index = 0; index < 2; index++) stepMatch(games[index] ?? on, worlds[index] ?? worlds[0]!, controls[index] ?? controls[0]!, frame);
  assertEquals(on.drops.pickupSerial, 1);
  assertEquals(on.drops.lastTaker, 0);
  assertEquals(fighterAt(worlds[0]!, 0).mana.points - fighterAt(worlds[1]!, 0).mana.points, DROP_METER);
  assertEquals(fighterAt(worlds[0]!, 1).mana.points, fighterAt(worlds[1]!, 1).mana.points);
  assertEquals(off.drops.spawnSerial, 0);
});

test("drops after the first rotate through each stage's fixed points 15–25 seconds after a pickup, the same for the same seed [spec #385] [invariant]", () => {
  for (const stage of STAGE_CATALOG) {
    const points = meterDropPoints(stage.id);
    for (let seed = 0; seed < 12; seed++) {
      const runs = [quickGame(seed, stage.id), quickGame(seed, stage.id)];
      const visited: number[][] = [[], []];
      for (let index = 0; index < 2; index++) {
        const game = runs[index] ?? runs[0]!;
        const taker = createFighter(Character.rifleman, 0.0, 1);
        const world = createRoster(1, [taker]);
        let draws = 0;
        for (let frame = 1; game.drops.pickupSerial < points.length + 2; frame++) {
          if (game.drops.draws !== draws) {
            draws = game.drops.draws;
            visited[index]?.push(game.drops.nextPoint);
            const wait = game.drops.nextSpawnFrame - game.matchFrame;
            if (draws > 1) assertTrue(wait >= DROP_INTERVAL_MIN_SECONDS * MATCH_TICKS_PER_SECOND && wait <= DROP_INTERVAL_MAX_SECONDS * MATCH_TICKS_PER_SECOND);
          }
          const point = meterDropPoint(stage.id, game.drops.point >= 0 ? game.drops.point : game.drops.nextPoint);
          taker.motion.x = point.x;
          taker.motion.z = point.z;
          game.matchFrame = frame;
          advanceMeterDrops(game, world);
        }
      }
      assertEquals(visited[0]?.join(","), visited[1]?.join(","), `${stage.name} seed ${seed}`);
      const order = visited[0] ?? [];
      assertEquals(order[0], 0);
      for (let index = 2; index < order.length; index++) assertEquals(order[index], floorMod((order[index - 1] ?? 0) + 1, points.length), `${stage.name} rotation`);
    }
  }
});

test("a match rule, training and configured runs keep drops off [spec #385]", () => {
  const off = createMatchState();
  setHumanCount(off, 2);
  off.drops.on = false;
  assertTrue(prepareQuickMatch(off));
  assertEquals(off.drops.nextSpawnFrame, 0);
  const training = quickGame(1);
  training.training = true;
  scheduleMeterDrops(training);
  assertEquals(training.drops.nextSpawnFrame, 0);
  const run = quickGame(1);
  run.run.active = true;
  scheduleMeterDrops(run);
  assertEquals(run.drops.nextSpawnFrame, 0);
});

test("seeded drops and pickups replay exactly from a match-start snapshot and from snapshots taken mid-telegraph [spec #385] [invariant]", () => {
  const live = createReplaySnapshot();
  live.match.phase = Phase.match;
  live.match.stageChoice = 0;
  live.match.endless = true;
  live.match.matchSeed = 385;
  fighterAt(live.world, 0).motion.x = 0.0;
  fighterAt(live.world, 1).motion.x = 300.0;
  scheduleMeterDrops(live.match);
  const seed = createReplaySnapshot();
  copyReplayState(seed, live);
  const pending = [createReplaySnapshot(), createReplaySnapshot()];
  const pendingFrames: number[] = [];
  const hashes: string[] = [];
  const frames = 75 * MATCH_TICKS_PER_SECOND;
  for (let frame = 1; frame <= frames; frame++) {
    if (pendingFrames.length < pending.length && dropTelegraphFrames(live.match.drops, frame) === MATCH_TICKS_PER_SECOND) {
      copyReplayState(pending[pendingFrames.length] ?? seed, live);
      pendingFrames.push(frame);
    }
    stepMatch(live.match, live.world, live.controls, frame);
    if (floorMod(frame, 300) === 0) hashes.push(stateChecksum(live));
  }
  assertTrue(live.match.drops.pickupSerial >= 3);
  assertEquals(pendingFrames.length, 2);
  const starts = [{ snapshot: seed, from: 1 }, ...pendingFrames.map((from, index) => ({ snapshot: pending[index] ?? seed, from }))];
  for (const { snapshot, from } of starts) {
    const replay = createReplaySnapshot();
    copyReplayState(replay, snapshot);
    const pickups = replay.match.drops.pickupSerial;
    for (let frame = from; frame <= frames; frame++) {
      stepMatch(replay.match, replay.world, replay.controls, frame);
      if (floorMod(frame, 300) !== 0) continue;
      assertEquals(stateChecksum(replay), hashes[floorDiv(frame, 300) - 1] ?? "missing", `from ${from}, frame ${frame}`);
      if (from > 1 && replay.match.drops.pickupSerial > pickups) break;
    }
    assertTrue(replay.match.drops.pickupSerial > pickups);
    if (from === 1) assertEquals(firstStateDifference(live, replay), undefined);
  }
});

test("computers contest drops by tier, after their own reaction to the telegraph [spec #385]", () => {
  const game = quickGame(7, 2);
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  game.drops.nextSpawnFrame = 1000;
  game.drops.nextPoint = 3;
  let previous = -1;
  for (const tier of CPU_TIERS) {
    const skill = cpuSkill("wren", tier);
    game.matchFrame = 1000 - DROP_TELEGRAPH_FRAMES + skill.contestDelay - 1;
    useMatchSeed(game.matchSeed);
    assertEquals(dropContest(game, fighter, 0, skill), -1, `${tier} before its delay`);
    game.matchFrame++;
    let contested = 0;
    for (let draw = 1; draw <= 200; draw++) {
      game.drops.draws = draw;
      if (dropContest(game, fighter, 0, skill) === 3) contested++;
    }
    useMatchSeed(0);
    assertTrue(contested >= previous);
    previous = contested;
    if (tier === "expert") assertEquals(contested, 200);
    if (tier === "rookie") assertTrue(contested > 0 && contested < 100);
  }
});

test("an expert computer climbs to a platform drop and takes it while its opponent stands away [spec #385]", () => {
  const game = createMatchState();
  setParticipants(game, 2, 1);
  game.phase = Phase.match;
  game.stageChoice = 2;
  game.endless = true;
  game.matchSeed = 3;
  game.cpuResolvedOpponents[0] = "wren";
  game.cpuTiers[0] = "expert";
  game.drops.nextSpawnFrame = DROP_TELEGRAPH_FRAMES + 1;
  game.drops.nextPoint = 1;
  game.drops.draws = 1;
  const world = testWorld(createFighter(Character.rifleman, 300.0, -1), createFighter(Character.rifleman, 550.0, -1));
  const controls = createFrameControls();
  const produced = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const neutral = neutralControls();
  for (let frame = 1; frame <= 600 && game.drops.pickupSerial === 0; frame++) {
    copyControls(produced.inputs[1], neutral);
    clearAttackBuffer(produced.commands[1]);
    produceComputerInput(game, world, runtime, 0, frame, produced.inputs[0], produced.commands[0]);
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, game, world, controls, runtime, frame));
  }
  assertEquals(game.drops.pickupSerial, 1);
  assertEquals(game.drops.lastTaker, 0);
});
