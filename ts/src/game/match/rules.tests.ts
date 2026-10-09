

import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import { createFighter } from "../sim/fighter";
import { Character } from "../sim/codes";
import { createRoster, fighterAt } from "../sim/roster";
import { MATCH_TICKS_PER_SECOND, Phase, advanceClock, allCharactersReady, characterReady, confirmRematch, cpuSlot, createMatchState, cycleSlotMode, recallCharacter, requestStageSelect, requestStart, returnToCharacters, selectCharacter, selectCpuCharacter, selectStage, setCpuOpponent, setCpuTier, setHumanCount, setParticipants, setStocks, setTimeLimit } from "./rules";

function testSoloMatch() {
  const game = createMatchState();
  setParticipants(game, 1, 2);
  recallCharacter(game, 0, 1);
  return game;
}

const framesOf = (minutes: number): number => minutes * 60 * MATCH_TICKS_PER_SECOND;

function testStanding(firstStocks: number, firstDamage: number, secondStocks: number, secondDamage: number) {
  const world = createRoster(3, [createFighter(1, 0, 1), createFighter(1, 0, -1)]);
  fighterAt(world, 0).status.stocks = firstStocks;
  fighterAt(world, 0).status.damage = firstDamage;
  fighterAt(world, 1).status.stocks = secondStocks;
  fighterAt(world, 1).status.damage = secondDamage;
  return world;
}
test("bothPlayersMustSelectBeforeEitherCanOpenStages [spec #234]", () => {
  const game = testSoloMatch();
  setHumanCount(game, 2);
  selectCharacter(game, 0, 1);
  assertFalse(requestStageSelect(game, 0));
  assertFalse(requestStageSelect(game, 1));
  selectCharacter(game, 1, 1);
  assertTrue(requestStageSelect(game, 1));
  selectStage(game, 1, 10);
  assertEquals(game.stageChoice, 10);
  selectStage(game, 0, 0);
  assertEquals(game.stageChoice, 0);
  assertTrue(requestStart(game, 1));
  assertEquals(game.phase, Phase.match);

});
test("soloPracticeNeedsOnlyPlayerChipAndCpuPlacementChoosesFight [spec docs/player-guide.md]", () => {
  const game = testSoloMatch();
  assertFalse(allCharactersReady(game));
  assertFalse(requestStageSelect(game, 0));
  assertFalse(requestStart(game, 0));
  selectCharacter(game, 0, 1);
  assertFalse(characterReady(game, 1));
  assertTrue(allCharactersReady(game));
  assertTrue(requestStageSelect(game, 0));
  returnToCharacters(game, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 1);
  assertTrue(allCharactersReady(game));
  assertTrue(requestStageSelect(game, 0));
  returnToCharacters(game, 0);
  recallCharacter(game, 0, 1);
  assertFalse(characterReady(game, 1));
  assertTrue(requestStageSelect(game, 0));

});
test("menuAndUnlimitedMatchesDoNotRunClock [spec docs/design/match-flow.md]", () => {
  const game = testSoloMatch();
  advanceClock(game, testStanding(0, 0.0, 0, 0.0));
  assertEquals(game.remainingFrames, framesOf(createMatchState().timeLimitMinutes));
  assertEquals(game.phase, Phase.characterMenu);
  selectCharacter(game, 0, 1);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  requestStageSelect(game, 0);
  advanceClock(game, testStanding(0, 0.0, 0, 0.0));
  assertEquals(game.remainingFrames, framesOf(createMatchState().timeLimitMinutes));
  assertEquals(game.phase, Phase.stageMenu);
  returnToCharacters(game, 0);
  setTimeLimit(game, 0, 0);
  requestStageSelect(game, 0);
  requestStart(game, 0);
  for (let tick = 1; tick <= 120; tick++) {
    advanceClock(game, testStanding(1, 90.0, 1, 20.0));
  }
  assertEquals(game.phase, Phase.match);
  assertEquals(game.remainingFrames, 0);
  assertFalse(game.timedOut);

});
test("everyHumanMustChooseAndConfirmForThreeAndFourPlayerMatches [spec #234]", () => {
  for (let count = 3; count <= 4; count++) {
    const game = testSoloMatch();
    setHumanCount(game, count);
    assertEquals(game.humanCount, count);
    for (let slot = 0; slot <= count - 2; slot++) {
      selectCharacter(game, slot, [Character.rifleman, Character.demonHunter, Character.blademaster][imod(slot, 3)]!);
    }
    assertFalse(requestStageSelect(game, count - 1));
    selectCharacter(game, count - 1, 2);
    setStocks(game, count - 1, 5);
    setTimeLimit(game, count - 1, 2);
    assertTrue(requestStageSelect(game, count - 1));
    assertTrue(requestStart(game, count - 1));
    assertEquals(game.remainingFrames, framesOf(2));
    game.phase = Phase.result;
    for (let slot = 0; slot <= count - 2; slot++) {
      assertFalse(confirmRematch(game, slot));
    }
    assertTrue(confirmRematch(game, count - 1));
    for (let slot = 0; slot <= count - 1; slot++) {
      assertFalse(assertDefined(game.rematchReadiness[slot]));
      assertTrue(characterReady(game, slot));
    }
    assertTrue(requestStageSelect(game, 0));
    assertTrue(requestStart(game, 0));
    assertEquals(game.remainingFrames, framesOf(2));

  }
});


test("CPU mode, fighter, opponent and difficulty changes wait for Start and the human fighter choice [repro #234]", () => {
  const game = createMatchState();
  const waiting = () => {
    assertEquals(game.phase, Phase.characterMenu);
    assertFalse(requestStart(game, 0));
  };
  cycleSlotMode(game, 0, 2); waiting();
  cycleSlotMode(game, 0, 2); waiting();
  selectCpuCharacter(game, 0, 2, 2); waiting();
  setCpuOpponent(game, 0, 2, "flint"); waiting();
  setCpuTier(game, 0, 2, "expert"); waiting();
  assertFalse(requestStageSelect(game, 0));
  selectCharacter(game, 0, 1); waiting();
  selectCpuCharacter(game, 0, 2, 0); waiting();
  setCpuOpponent(game, 0, 2, "random"); waiting();
  setCpuTier(game, 0, 2, "rookie"); waiting();
  assertTrue(requestStageSelect(game, 0));
  assertEquals(game.phase, Phase.stageMenu);
  assertTrue(requestStart(game, 0));
  assertEquals(game.phase, Phase.match);
});
