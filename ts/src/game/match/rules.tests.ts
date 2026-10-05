import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { imod } from "../../sim/intMath";
import { createFighter } from "../sim/fighter";
import { createRoster, fighterAt } from "../sim/roster";
import { Phase, advanceClock, allCharactersReady, canChooseComputer, characterFor, characterReady, computerActive, confirmRematch, copyMatchState, cpuSlot, createMatchState, cycleSlotMode, fighterActive, fighterMask, firstHumanSlot, forfeit, hasUnassignedHuman, humanFighterActive, humanPresent, participantLeft, practiceSelected, recallCharacter, remainingSeconds, requestStageSelect, requestStart, resolveStocks, returnToCharacters, selectCharacter, selectCpuCharacter, selectStage, setHumanCount, setHumanMask, setParticipants, setStocks, setTimeLimit, unreadyCharacter, updateConnectedHumans } from "./rules";

function testSoloMatch() {
  const game = createMatchState();
  setParticipants(game, 1, 2);
  recallCharacter(game, 0, 1);
  return game;
}

function testStanding(firstStocks: number, firstDamage: number, secondStocks: number, secondDamage: number) {
  const world = createRoster(3, [createFighter(0, 0, 1), createFighter(1, 0, -1)]);
  fighterAt(world, 0).status.stocks = firstStocks;
  fighterAt(world, 0).status.damage = firstDamage;
  fighterAt(world, 1).status.stocks = secondStocks;
  fighterAt(world, 1).status.damage = secondDamage;
  return world;
}

test("selectionMatchResultAndRematch", () => {
  const game = testSoloMatch();
  assertFalse(requestStageSelect(game, 0));
  assertFalse(requestStart(game, 0));
  selectCharacter(game, 0, 1);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  selectStage(game, 0, 1);
  assertEquals(game.stageChoice, 0);
  assertFalse(requestStart(game, 0));
  assertTrue(requestStageSelect(game, 0));
  assertEquals(game.phase, Phase.stageMenu);
  selectCharacter(game, 0, 0);
  assertEquals(characterFor(game, 0), 1);
  selectStage(game, 0, 1);
  assertEquals(game.stageChoice, 1);
  assertTrue(requestStart(game, 0));
  assertEquals(game.phase, Phase.match);
  assertEquals(remainingSeconds(game), 420);
  selectStage(game, 0, 0);
  assertEquals(game.stageChoice, 1);
  resolveStocks(game, testStanding(2, 0.0, 1, 0.0));
  assertEquals(game.phase, Phase.match);
  resolveStocks(game, testStanding(2, 0.0, 0, 0.0));
  assertEquals(game.phase, Phase.result);
  assertEquals(game.winner, 0);
  assertTrue(confirmRematch(game, 0));
  assertEquals(game.phase, Phase.characterMenu);
  assertTrue(characterReady(game, 0));
  assertTrue(characterReady(game, 1));
  assertEquals(characterFor(game, 0), 1);
  assertEquals(characterFor(game, 1), 0);
  assertTrue(requestStageSelect(game, 0));
  selectStage(game, 0, 0);
  assertTrue(requestStart(game, 0));
  assertEquals(game.phase, Phase.match);

});
test("bothPlayersMustSelectBeforeEitherCanOpenStages", () => {
  const game = testSoloMatch();
  setHumanCount(game, 2);
  selectCharacter(game, 0, 1);
  assertFalse(requestStageSelect(game, 0));
  assertFalse(requestStageSelect(game, 1));
  selectCharacter(game, 1, 0);
  assertTrue(requestStageSelect(game, 1));
  selectStage(game, 1, 1);
  assertEquals(game.stageChoice, 1);
  selectStage(game, 0, 0);
  assertEquals(game.stageChoice, 0);
  assertTrue(requestStart(game, 1));
  assertEquals(game.phase, Phase.match);

});
test("humanAndCpuCanIndependentlyChooseMirrorMatchups", () => {
  const game = testSoloMatch();
  assertEquals(characterFor(game, 1), 1);
  selectCharacter(game, 0, 1);
  assertEquals(characterFor(game, 0), 1);
  assertEquals(characterFor(game, 1), 1);
  assertTrue(practiceSelected(game));
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 1);
  assertTrue(requestStageSelect(game, 0));
  returnToCharacters(game, 0);
  unreadyCharacter(game, 0);
  selectCharacter(game, 0, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  assertEquals(characterFor(game, 0), 0);
  assertEquals(characterFor(game, 1), 0);
  assertTrue(allCharactersReady(game));

});
test("onlySoloHostCanChooseCpuAndNeverOverridesHumanTwo", () => {
  const game = testSoloMatch();
  selectCpuCharacter(game, 1, (cpuSlot(game) ?? -1), 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 3);
  assertEquals(characterFor(game, 1), 1);
  setHumanCount(game, 2);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  assertEquals(characterFor(game, 1), 1);
  selectCharacter(game, 1, 0);
  assertEquals(characterFor(game, 0), 0);
  assertEquals(characterFor(game, 1), 0);

});
test("soloPracticeNeedsOnlyPlayerChipAndCpuPlacementChoosesFight", () => {
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
test("soloCpuPlacementIsClearedWhenSecondHumanJoins", () => {
  const game = testSoloMatch();
  selectCharacter(game, 0, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  assertTrue(allCharactersReady(game));
  setHumanCount(game, 2);
  assertFalse(characterReady(game, 1));
  assertFalse(requestStageSelect(game, 0));

});
test("backFromStagesPreservesChoicesAndAllowsUnready", () => {
  const game = testSoloMatch();
  setHumanCount(game, 2);
  selectCharacter(game, 0, 0);
  selectCharacter(game, 1, 1);
  requestStageSelect(game, 0);
  setStocks(game, 1, 5);
  selectStage(game, 1, 1);
  returnToCharacters(game, 1);
  assertEquals(game.phase, Phase.characterMenu);
  assertEquals(game.stockCount, 5);
  assertEquals(game.stageChoice, 1);
  unreadyCharacter(game, 1);
  assertFalse(requestStageSelect(game, 0));
  selectCharacter(game, 1, 0);
  assertTrue(requestStageSelect(game, 1));

});
test("absentAndInvalidParticipantsCannotChooseOrStart", () => {
  const game = testSoloMatch();
  selectCharacter(game, 1, 0);
  assertFalse(characterReady(game, 1));
  selectCharacter(game, 0, 3);
  assertFalse(characterReady(game, 0));
  selectCharacter(game, 0, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 1);
  assertFalse(requestStageSelect(game, -1));
  assertFalse(requestStageSelect(game, 1));
  assertTrue(requestStageSelect(game, 0));
  selectStage(game, 1, 1);
  selectStage(game, -1, 1);
  selectStage(game, 0, 2);
  assertEquals(game.stageChoice, 0);
  returnToCharacters(game, 1);
  assertEquals(game.phase, Phase.stageMenu);
  setStocks(game, 1, 8);
  setTimeLimit(game, -1, 1);
  assertEquals(game.stockCount, 3);
  assertEquals(game.timeLimitMinutes, 7);
  assertFalse(requestStart(game, 1));
  assertFalse(requestStart(game, -1));
  assertTrue(requestStart(game, 0));

});
test("settingsStayBoundedAndOnlyChangeInStageSelect", () => {
  const game = testSoloMatch();
  setStocks(game, 0, 9);
  setTimeLimit(game, 0, 10);
  assertEquals(game.stockCount, 3);
  assertEquals(game.timeLimitMinutes, 7);
  selectCharacter(game, 0, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 1);
  requestStageSelect(game, 0);
  setStocks(game, 0, 1);
  setStocks(game, 0, 0);
  assertEquals(game.stockCount, 1);
  setStocks(game, 0, 9);
  setStocks(game, 0, 10);
  assertEquals(game.stockCount, 9);
  setTimeLimit(game, 0, 0);
  setTimeLimit(game, 0, -1);
  assertEquals(game.timeLimitMinutes, 0);
  setTimeLimit(game, 0, 10);
  setTimeLimit(game, 0, 11);
  assertEquals(game.timeLimitMinutes, 10);
  requestStart(game, 0);
  assertEquals(game.remainingFrames, 36000);
  setStocks(game, 0, 1);
  setTimeLimit(game, 0, 1);
  assertEquals(game.stockCount, 9);
  assertEquals(game.timeLimitMinutes, 10);

});
test("secondPlayerLeavingLetsSelectedHostOpenStages", () => {
  const game = testSoloMatch();
  setHumanCount(game, 2);
  selectCharacter(game, 0, 0);
  assertFalse(requestStageSelect(game, 0));
  setHumanCount(game, 1);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  assertTrue(requestStageSelect(game, 0));
  assertTrue(requestStart(game, 0));

});
test("bothPlayersConfirmRematchAndKeepPlacedFighters", () => {
  const game = testSoloMatch();
  setHumanCount(game, 2);
  selectCharacter(game, 0, 0);
  selectCharacter(game, 1, 1);
  requestStageSelect(game, 0);
  requestStart(game, 0);
  resolveStocks(game, testStanding(0, 0.0, 2, 0.0));
  assertFalse(confirmRematch(game, 0));
  assertEquals(game.phase, Phase.result);
  assertTrue(confirmRematch(game, 1));
  assertTrue(characterReady(game, 0));
  assertTrue(characterReady(game, 1));
  assertEquals(characterFor(game, 0), 0);
  assertEquals(characterFor(game, 1), 1);
  assertTrue(requestStageSelect(game, 0));
  selectStage(game, 1, 1);
  assertTrue(requestStart(game, 0));
  assertEquals(game.stageChoice, 1);
  assertEquals(game.phase, Phase.match);

});
test("menuAndUnlimitedMatchesDoNotRunClock", () => {
  const game = testSoloMatch();
  advanceClock(game, testStanding(0, 0.0, 0, 0.0));
  assertEquals(game.remainingFrames, 25200);
  assertEquals(game.phase, Phase.characterMenu);
  selectCharacter(game, 0, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  requestStageSelect(game, 0);
  advanceClock(game, testStanding(0, 0.0, 0, 0.0));
  assertEquals(game.remainingFrames, 25200);
  assertEquals(game.phase, Phase.stageMenu);
  setTimeLimit(game, 0, 0);
  requestStart(game, 0);
  for (let tick = 1; tick <= 120; tick++) {
    advanceClock(game, testStanding(1, 90.0, 1, 20.0));
  }
  assertEquals(game.phase, Phase.match);
  assertEquals(game.remainingFrames, 0);
  assertFalse(game.timedOut);

});
test("timeoutComparesStocksThenDamageAndExactTieDraws", () => {
  for (let outcome = 0; outcome <= 4; outcome++) {
    const game = testSoloMatch();
    selectCharacter(game, 0, 0);
    selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
    requestStageSelect(game, 0);
    setTimeLimit(game, 0, 1);
    requestStart(game, 0);
    for (let tick = 1; tick <= 3599; tick++) {
      advanceClock(game, testStanding(3, 100.0, 2, 0.0));
    }
    assertEquals(game.phase, Phase.match);
    assertEquals(remainingSeconds(game), 1);
    if (outcome === 0) {
      advanceClock(game, testStanding(3, 100.0, 2, 0.0));
      assertEquals(game.winner, 0);
    }
    else if (outcome === 1) {
      advanceClock(game, testStanding(1, 0.0, 2, 100.0));
      assertEquals(game.winner, 1);
    }
    else if (outcome === 2) {
      advanceClock(game, testStanding(2, 10.100000381469727, 2, 10.199999809265137));
      assertEquals(game.winner, 0);
    }
    else if (outcome === 3) {
      advanceClock(game, testStanding(2, 10.199999809265137, 2, 10.100000381469727));
      assertEquals(game.winner, 1);
    }
    else {
      advanceClock(game, testStanding(2, 10.0, 2, 10.0));
      assertEquals(game.winner, undefined);
    }
    assertEquals(game.phase, Phase.result);
    assertTrue(game.timedOut);
    assertEquals(remainingSeconds(game), 0);
    const result = game.winner;
    advanceClock(game, testStanding(0, 0.0, 1, 0.0));
    assertEquals(game.winner, result);
    assertEquals(game.remainingFrames, 0);

  }
});
test("simultaneousFinalStocksAreADraw", () => {
  const game = testSoloMatch();
  resolveStocks(game, testStanding(0, 0.0, 0, 0.0));
  assertEquals(game.phase, Phase.characterMenu);
  selectCharacter(game, 0, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 0);
  requestStageSelect(game, 0);
  requestStart(game, 0);
  resolveStocks(game, testStanding(0, 0.0, 0, 0.0));
  assertEquals(game.phase, Phase.result);
  assertEquals(game.winner, undefined);
  resolveStocks(game, testStanding(1, 0.0, 0, 0.0));
  assertEquals(game.winner, undefined);

});
test("playerForfeitEndsSelectionAndDeclaresOtherPlayerWinner", () => {
  const game = testSoloMatch();
  setHumanCount(game, 2);
  forfeit(game, 0, testStanding(1, 0.0, 1, 0.0));
  assertEquals(game.phase, Phase.result);
  assertEquals(game.winner, 1);

});
test("illidanMirrorMatchRetainsSelectionsAfterNewMatch", () => {
  const game = testSoloMatch();
  selectCharacter(game, 0, 2);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 2);
  assertEquals(characterFor(game, 0), 2);
  assertEquals(characterFor(game, 1), 2);
  assertTrue(requestStageSelect(game, 0));
  assertTrue(requestStart(game, 0));
  resolveStocks(game, testStanding(1, 0.0, 0, 0.0));
  assertTrue(confirmRematch(game, 0));
  assertEquals(characterFor(game, 0), 2);
  assertEquals(characterFor(game, 1), 2);
  assertTrue(requestStageSelect(game, 0));
  assertTrue(requestStart(game, 0));

});
test("secondHumanCanSelectIllidan", () => {
  const game = testSoloMatch();
  setHumanCount(game, 2);
  selectCharacter(game, 0, 0);
  selectCharacter(game, 1, 2);
  assertEquals(characterFor(game, 1), 2);
  assertTrue(requestStageSelect(game, 1));
  assertTrue(requestStart(game, 1));

});
test("everyHumanMustChooseAndConfirmForThreeAndFourPlayerMatches", () => {
  for (let count = 3; count <= 4; count++) {
    const game = testSoloMatch();
    setHumanCount(game, count);
    assertEquals(game.humanCount, count);
    for (let slot = 0; slot <= count - 2; slot++) {
      selectCharacter(game, slot, imod(slot, 3));
    }
    assertFalse(requestStageSelect(game, count - 1));
    selectCharacter(game, count - 1, 2);
    assertTrue(requestStageSelect(game, count - 1));
    setStocks(game, count - 1, 5);
    setTimeLimit(game, count - 1, 2);
    assertTrue(requestStart(game, count - 1));
    assertEquals(game.remainingFrames, 7200);
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
    assertEquals(game.remainingFrames, 7200);

  }
});
test("sparseSlotsOwnTheirChoicesAndMembershipIsFixedDuringMatch", () => {
  const game = testSoloMatch();
  setHumanMask(game, 10);
  assertEquals(game.humanCount, 2);
  assertEquals(firstHumanSlot(game), 1);
  assertEquals(fighterMask(game), 10);
  assertEquals(cpuSlot(game), undefined);
  selectCharacter(game, 0, 2);
  assertFalse(characterReady(game, 0));
  selectCharacter(game, 1, 2);
  selectCharacter(game, 3, 1);
  selectCpuCharacter(game, 1, (cpuSlot(game) ?? -1), 0);
  assertEquals(characterFor(game, 3), 1);
  assertFalse(requestStageSelect(game, 0));
  assertTrue(requestStageSelect(game, 3));
  setStocks(game, 0, 9);
  assertEquals(game.stockCount, 3);
  assertTrue(requestStart(game, 3));
  setHumanMask(game, 2);
  assertEquals(game.humanMask, 10);
  game.phase = Phase.result;
  assertFalse(confirmRematch(game, 0));
  assertFalse(confirmRematch(game, 1));
  assertTrue(confirmRematch(game, 3));
  assertEquals(game.humanMask, 10);

});
test("sparseSoloHumanOwnsOneSeparateCpuAndSnapshotsKeepAllMenuSlots", () => {
  const game = testSoloMatch();
  setParticipants(game, 8, 1);
  assertEquals(game.humanCount, 1);
  assertEquals((cpuSlot(game) ?? -1), 0);
  assertEquals(fighterMask(game), 9);
  selectCharacter(game, 3, 2);
  recallCharacter(game, 3, 0);
  selectCpuCharacter(game, 0, (cpuSlot(game) ?? -1), 1);
  assertFalse(characterReady(game, 0));
  selectCpuCharacter(game, 3, (cpuSlot(game) ?? -1), 1);
  assertTrue(allCharactersReady(game));
  recallCharacter(game, 3, 0);
  assertFalse(characterReady(game, 0));
  selectCpuCharacter(game, 3, (cpuSlot(game) ?? -1), 2);
  const copy = testSoloMatch();
  copyMatchState(copy, game);
  assertEquals(copy.humanMask, 8);
  assertEquals(characterFor(copy, 3), 2);
  assertEquals(characterFor(copy, 0), 2);
  assertTrue(allCharactersReady(copy));
  setHumanMask(game, 15);
  assertFalse(characterReady(game, 0));
  assertTrue(characterReady(game, 3));
  assertFalse(allCharactersReady(game));

});
test("departureEndsEpochWithoutCpuTakeoverOrWaitingForMissingVotes", () => {
  const game = testSoloMatch();
  setHumanMask(game, 11);
  game.phase = Phase.match;
  const world = createRoster(11);
  world.fighters[0] = createFighter(0, -240, 1);
  world.fighters[1] = createFighter(1, 240, -1);
  world.fighters[3] = createFighter(2, 480, -1);
  participantLeft(game, 1, world);
  assertEquals(game.phase, Phase.result);
  assertTrue(game.interrupted);
  assertEquals(game.winner, undefined);
  assertEquals(game.humanMask, 11);
  assertEquals(world.mask, 11);
  assertEquals(cpuSlot(game), undefined);
  assertFalse(humanPresent(game, 1));
  assertFalse(confirmRematch(game, 1));
  assertFalse(confirmRematch(game, 0));
  assertTrue(confirmRematch(game, 3));
  setHumanMask(game, 9);
  assertEquals(game.departedMask, 0);
  assertFalse(game.interrupted);
  assertEquals(game.humanMask, 9);

});
test("lastEligibleFighterWinsByForfeit", () => {
  const game = testSoloMatch();
  setHumanMask(game, 10);
  game.phase = Phase.match;
  const world = createRoster(10);
  world.fighters[1] = createFighter(0, -240, 1);
  world.fighters[3] = createFighter(1, 240, -1);
  participantLeft(game, 1, world);
  assertEquals(game.phase, Phase.result);
  assertEquals(game.winner, 3);
  assertTrue(game.interrupted);
  assertTrue(confirmRematch(game, 3));

});
test("lobbyParticipantsPreserveEveryHumanComputerAndEmptySlot", () => {
  const game = testSoloMatch();
  setParticipants(game, 1, 6);
  assertEquals(game.humanMask, 1);
  assertEquals(game.computerMask, 6);
  assertEquals(fighterMask(game), 7);
  assertTrue(characterReady(game, 1));
  assertTrue(characterReady(game, 2));
  assertFalse(characterReady(game, 3));
  setParticipants(game, 8, 7);
  assertEquals(firstHumanSlot(game), 3);
  assertEquals(fighterMask(game), 15);
  for (let slot = 0; slot <= 2; slot++) {
    assertTrue(canChooseComputer(game, 3, slot));
    selectCpuCharacter(game, 3, slot, 2);
    assertEquals(characterFor(game, slot), 2);
  }
  selectCharacter(game, 3, 1);
  assertTrue(allCharactersReady(game));
  setParticipants(game, 9, 4);
  assertEquals(game.humanCount, 2);
  assertEquals(fighterMask(game), 13);
  assertFalse(fighterActive(game, 1));
  assertTrue(canChooseComputer(game, 0, 2));
  assertFalse(canChooseComputer(game, 3, 2));
  selectCpuCharacter(game, 3, 2, 0);
  assertEquals(characterFor(game, 2), 2);
  selectCharacter(game, 0, 1);
  selectCharacter(game, 3, 2);
  assertTrue(requestStageSelect(game, 3));
  assertTrue(requestStart(game, 0));
  setParticipants(game, 1, 14);
  assertEquals(game.humanMask, 9);
  assertEquals(game.computerMask, 4);
  const copy = testSoloMatch();
  copyMatchState(copy, game);
  assertEquals(copy.computerMask, 4);
  assertEquals(fighterMask(copy), 13);
  copy.phase = Phase.characterMenu;
  setParticipants(copy, 15, 0);
  assertEquals(fighterMask(copy), 15);
  assertEquals(cpuSlot(copy), undefined);
  setParticipants(copy, 8, 0);
  assertEquals(fighterMask(copy), 8);
  assertEquals(cpuSlot(copy), undefined);

});
test("slotModeCyclesPreserveConnectedOwnersAndTheirOriginalIndices", () => {
  const game = createMatchState();
  setParticipants(game, 9, 2);
  selectCharacter(game, 0, 2);
  selectCharacter(game, 3, 1);
  assertTrue(cycleSlotMode(game, 3, 3));
  assertEquals(game.humanMask, 9);
  assertEquals(game.humanCount, 2);
  assertEquals(game.humanFighterMask, 1);
  assertEquals(game.computerMask, 10);
  assertTrue(characterReady(game, 3));
  assertTrue(canChooseComputer(game, 3, 3));
  assertFalse(cycleSlotMode(game, 3, 0));
  assertFalse(cycleSlotMode(game, 2, 2));
  assertTrue(cycleSlotMode(game, 3, 3));
  assertFalse(fighterActive(game, 3));
  assertTrue(humanPresent(game, 3));
  assertTrue(cycleSlotMode(game, 3, 3));
  assertTrue(humanFighterActive(game, 3));
  assertFalse(characterReady(game, 3));
  selectCharacter(game, 3, 2);
  assertEquals(characterFor(game, 3), 2);
  assertTrue(cycleSlotMode(game, 0, 0));
  assertTrue(cycleSlotMode(game, 0, 0));
  assertFalse(fighterActive(game, 0));
  assertEquals(firstHumanSlot(game), 0);
  assertTrue(requestStageSelect(game, 0));
  assertFalse(cycleSlotMode(game, 0, 3));
  assertTrue(requestStart(game, 0));
  assertFalse(cycleSlotMode(game, 3, 3));
  const copy = createMatchState();
  copyMatchState(copy, game);
  assertEquals(copy.humanMask, 9);
  assertEquals(copy.humanFighterMask, 8);
  assertEquals(copy.computerMask, 2);
  copy.phase = Phase.result;
  assertFalse(confirmRematch(copy, 0));
  assertTrue(confirmRematch(copy, 3));
  updateConnectedHumans(copy, 9);
  assertFalse(fighterActive(copy, 0));
  assertEquals(copy.humanFighterMask, 8);
  assertTrue(cycleSlotMode(copy, 0, 0));
  assertEquals(copy.humanFighterMask, 9);

});
test("slotModeUnconnectedHumansAndEmptyMatchesCannotStart", () => {
  const game = createMatchState();
  setParticipants(game, 8, 0);
  selectCharacter(game, 3, 2);
  assertTrue(cycleSlotMode(game, 3, 0));
  assertTrue(humanFighterActive(game, 0));
  assertEquals(game.humanMask, 8);
  assertTrue(hasUnassignedHuman(game));
  selectCharacter(game, 0, 1);
  assertFalse(characterReady(game, 0));
  assertFalse(requestStageSelect(game, 3));
  assertTrue(cycleSlotMode(game, 3, 0));
  assertTrue(computerActive(game, 0));
  assertFalse(hasUnassignedHuman(game));
  assertTrue(allCharactersReady(game));
  assertTrue(cycleSlotMode(game, 3, 3));
  selectCharacter(game, 3, 0);
  assertEquals(characterFor(game, 3), 2);
  assertEquals(game.humanFighterMask, 0);
  assertTrue(allCharactersReady(game));
  assertTrue(cycleSlotMode(game, 3, 3));
  assertTrue(cycleSlotMode(game, 3, 0));
  assertEquals(fighterMask(game), 0);
  assertTrue(humanPresent(game, 3));
  assertFalse(allCharactersReady(game));
  assertFalse(requestStageSelect(game, 3));

});
