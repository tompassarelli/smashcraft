import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, computerActive, createMatchState, fighterMask, humanFighterActive, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { parsePlaytestRequest, playtestRequest, preparePlaytest } from "./playtest";

test("a playtest request line names its computers' slots and nothing else parses", () => {
  assertEquals(playtestRequest(0b100, "flint", "advanced"), "PLAY v=3 computers=4 opponent=flint difficulty=advanced");
  const parsed = parsePlaytestRequest("PLAY v=3 computers=4 opponent=flint difficulty=advanced");
  assertEquals(parsed?.computers, 0b100);
  assertEquals(parsed?.tier, "advanced");
  assertEquals(parsePlaytestRequest("PLAY v=3 computers=0 opponent=flint difficulty=advanced"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=3 computers=16 opponent=flint difficulty=advanced"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=3 computers=04 opponent=flint difficulty=advanced"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=3 computers=4"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=3 computers=4 opponent=flint difficulty=impossible"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=3 computers=4 opponent=nobody difficulty=advanced"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=1 computers=4"), undefined);
  assertEquals(parsePlaytestRequest("-dev quick"), undefined);
});

test("a playtest adds a computer as Player 3 to one human and starts on the default stage with the menus' stocks", () => {
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

test("a playtest replaces a slot left waiting for a human and refuses a slot a human holds or any phase but fighter selection", () => {
  const waiting = createMatchState();
  // Slot C's tag clicked once: HMN, with nobody there.
  setParticipants(waiting, 0b001, 0);
  waiting.humanFighterMask = 0b101;
  assertTrue(preparePlaytest(waiting, { computers: 0b100, opponent: "wren", tier: "expert" }));
  assertFalse(humanFighterActive(waiting, 2));
  assertTrue(computerActive(waiting, 2));
  const held = createMatchState();
  setParticipants(held, 0b011, 0);
  assertFalse(preparePlaytest(held, { computers: 0b010, opponent: "wren", tier: "expert" }));
  assertEquals(held.phase, Phase.characterMenu);
  const playing = createMatchState();
  setParticipants(playing, 0b001, 0);
  playing.phase = Phase.match;
  assertFalse(preparePlaytest(playing, { computers: 0b100, opponent: "wren", tier: "expert" }));
  const stage = createMatchState();
  setParticipants(stage, 0b001, 0);
  stage.phase = Phase.stageMenu;
  assertFalse(preparePlaytest(stage, { computers: 0b100, opponent: "wren", tier: "expert" }));
});
