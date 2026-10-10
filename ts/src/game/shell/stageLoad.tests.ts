import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, setParticipants } from "../match/rules";
import { beginStageLoad, stageReported } from "./stageLoad";

function twoPlayers() {
  const game = createMatchState();
  setParticipants(game, 0b011, 0b100);
  game.phase = Phase.stageMenu;
  game.stageChoice = 11;
  return game;
}

test("the match waits for every present player's report of this stage; computers send none [k3 measure #129]", () => {
  const load = beginStageLoad(twoPlayers(), 1);
  assertEquals(load.waiting, 0b011);
  assertFalse(stageReported(load, 0, "11"));
  assertEquals(stageReported(load, 1, "3"), false, "a report of another stage doesn't count");
  assertEquals(stageReported(load, 2, "11"), false, "a slot the load doesn't wait for doesn't count");
  assertTrue(stageReported(load, 1, "11"));
});
