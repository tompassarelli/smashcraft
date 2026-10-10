

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
test("menuAndUnlimitedMatchesDoNotRunClock [k3 measure docs/design/match-flow.md]", () => {
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
