import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, computerActive, createMatchState, fighterMask, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { preparePlaytest } from "./playtest";

test("a playtest adds a computer as Player 3 to one human and starts on the default stage with the menus' stocks [spec wisp#14]", () => {
  const game = createMatchState();
  setParticipants(game, 0b001, 0);
  game.stageChoice = 1;
  assertTrue(preparePlaytest(game, { computers: 0b100, opponent: "flint", tier: "advanced" }));
  assertEquals(game.cpuTiers[2], "advanced");
  // The match itself starts once every client has loaded the stage (platform/shell/stageLoad.ts).
  assertEquals(game.phase, Phase.stageMenu);
  assertEquals(fighterMask(game), 0b101);
  assertTrue(computerActive(game, 2));
  assertEquals(game.characterChoices[0], Character.archer);
  assertEquals(game.stageChoice, 2);
  assertEquals(game.stockCount, 3);
  assertFalse(game.practice);
});
