import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, computerActive, createMatchState, fighterMask, humanFighterActive, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { parsePlaytestRequest, playtestRequest, preparePlaytest } from "./playtest";

test("a playtest request line names its computers' slots and nothing else parses", () => {
  assertEquals(playtestRequest(0b100), "PLAY v=1 computers=4");
  assertEquals(parsePlaytestRequest("PLAY v=1 computers=4"), 0b100);
  assertEquals(parsePlaytestRequest("PLAY v=1 computers=0"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=1 computers=16"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=1 computers=04"), undefined);
  assertEquals(parsePlaytestRequest("PLAY v=2 computers=4"), undefined);
  assertEquals(parsePlaytestRequest("-dev quick"), undefined);
});

test("a playtest adds a computer as Player 3 to one human and starts on the default stage with the menus' stocks", () => {
  const game = createMatchState();
  setParticipants(game, 0b001, 0);
  game.stageChoice = 1;
  assertTrue(preparePlaytest(game, 0b100));
  assertEquals(game.phase, Phase.match);
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
  assertTrue(preparePlaytest(waiting, 0b100));
  assertFalse(humanFighterActive(waiting, 2));
  assertTrue(computerActive(waiting, 2));
  const held = createMatchState();
  setParticipants(held, 0b011, 0);
  assertFalse(preparePlaytest(held, 0b010));
  assertEquals(held.phase, Phase.characterMenu);
  const playing = createMatchState();
  setParticipants(playing, 0b001, 0);
  playing.phase = Phase.match;
  assertFalse(preparePlaytest(playing, 0b100));
  const stage = createMatchState();
  setParticipants(stage, 0b001, 0);
  stage.phase = Phase.stageMenu;
  assertFalse(preparePlaytest(stage, 0b100));
});
