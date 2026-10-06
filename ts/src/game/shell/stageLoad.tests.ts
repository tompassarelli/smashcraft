import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, setParticipants } from "../match/rules";
import { STAGE_LOAD_TIMEOUT_FRAMES, STAGE_SETTLE_FRAMES, StageLoadStep, beginStageLoad, stageReported, tickStageLoad } from "./stageLoad";

function twoPlayers() {
  const game = createMatchState();
  setParticipants(game, 0b011, 0b100);
  game.phase = Phase.stageMenu;
  game.stageChoice = 11;
  return game;
}

test("each client reports its drawn stage once, after it settles", () => {
  const load = beginStageLoad(twoPlayers(), 0);
  const steps: StageLoadStep[] = [];
  for (let frame = 0; frame < STAGE_SETTLE_FRAMES + 5; frame++) steps.push(tickStageLoad(load));
  assertEquals(steps.filter(step => step === StageLoadStep.report).length, 1);
  assertEquals(steps.indexOf(StageLoadStep.report), STAGE_SETTLE_FRAMES - 1);
});

test("the match waits for every present player's report of this stage; computers send none", () => {
  const load = beginStageLoad(twoPlayers(), 1);
  assertEquals(load.waiting, 0b011);
  assertFalse(stageReported(load, 0, "11"));
  assertEquals(stageReported(load, 1, "3"), false, "a report of another stage doesn't count");
  assertEquals(stageReported(load, 2, "11"), false, "a slot the load doesn't wait for doesn't count");
  assertTrue(stageReported(load, 1, "11"));
});

test("a client that never reports holds the match for at most ten seconds", () => {
  const load = beginStageLoad(twoPlayers(), 0);
  stageReported(load, 0, "11");
  let frames = 0;
  while (tickStageLoad(load) !== StageLoadStep.start) frames++;
  assertEquals(frames + 1, STAGE_LOAD_TIMEOUT_FRAMES);
  assertEquals(STAGE_LOAD_TIMEOUT_FRAMES, 600);
});
