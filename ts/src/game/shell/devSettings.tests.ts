import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, fighterMask, selectCharacter, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { MAX_BATCH } from "../netcode/journal/transport";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";
import { type DevSettings, applyDevCommand, prepareQuickMatch } from "./devSettings";

const settings = (): DevSettings => ({ rollback: 24, delay: 0, batch: 2 });

test("dev commands set the next match's window, delay and batch", () => {
  const dev = settings();
  assertEquals(applyDevCommand(dev, "-dev rb 12"), "dev: next match rb=12 delay=0 batch=2");
  assertEquals(applyDevCommand(dev, "-dev delay 2"), "dev: next match rb=12 delay=2 batch=2");
  assertEquals(applyDevCommand(dev, "-dev batch 1"), "dev: next match rb=12 delay=2 batch=1");
  assertEquals(applyDevCommand(dev, "-dev show"), "dev: next match rb=12 delay=2 batch=1");
  assertEquals(dev.rollback, 12);
  assertEquals(dev.delay, 2);
  assertEquals(dev.batch, 1);
});

test("dev commands reject values the schedule cannot start", () => {
  const dev = settings();
  const rollbackRange = `dev: rb must be 1-${REPLAY_MAX_CORRECTION_FRAMES}`;
  assertEquals(applyDevCommand(dev, "-dev rb 0"), rollbackRange);
  assertEquals(applyDevCommand(dev, `-dev rb ${REPLAY_MAX_CORRECTION_FRAMES + 1}`), rollbackRange);
  assertEquals(applyDevCommand(dev, "-dev rb 64x"), rollbackRange);
  assertEquals(applyDevCommand(dev, "-dev delay 4"), "dev: delay must be 0, 1, 2, 3 or 5");
  const batchRange = `dev: batch must be 1-${MAX_BATCH}`;
  assertEquals(applyDevCommand(dev, "-dev batch 0"), batchRange);
  assertEquals(applyDevCommand(dev, `-dev batch ${MAX_BATCH + 1}`), batchRange);
  assertEquals(applyDevCommand(dev, "-dev nothing"), undefined);
  assertEquals(applyDevCommand(dev, "hello -dev rb 64"), undefined);
  assertEquals(dev.rollback, 24);
  assertEquals(dev.delay, 0);
  assertEquals(dev.batch, 2);
});

test("a quick match readies every present human's default fighter and starts with one stock on the default stage", () => {
  for (const from of [Phase.characterMenu, Phase.stageMenu]) {
    const game = createMatchState();
    setParticipants(game, 0b011, 0b100);
    selectCharacter(game, 0, Character.demonHunter);
    game.stageChoice = 1;
    game.stockCount = 9;
    game.phase = from;
    assertTrue(prepareQuickMatch(game));
    assertEquals(game.phase, Phase.match);
    assertEquals(game.stageChoice, 0);
    assertEquals(game.stockCount, 1);
    assertEquals(game.characterChoices[0], Character.archer);
    assertEquals(game.characterChoices[1], Character.rifleman);
    assertEquals(fighterMask(game), 0b111);
  }
  const playing = createMatchState();
  playing.phase = Phase.match;
  assertFalse(prepareQuickMatch(playing));
  assertEquals(playing.stockCount, 3);
});
