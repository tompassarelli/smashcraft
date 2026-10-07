import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, fighterMask, selectCharacter, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { MAX_BATCH } from "../netcode/journal/transport";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";
import { type DevSettings, QUICK_CPU_STOCKS, applyDevCommand, prepareQuickCpu, prepareQuickMatch, quickMatchCpuHero, quickMatchCpuProfile, quickMatchHero, quickRecoveryHero, quickOffstageHero } from "./devSettings";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";

const settings = (): DevSettings => ({ rollback: 24, delay: 0, batch: 2, rematchSeconds: 5 });

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

test("a dev command sets the automatic rematch's countdown within a minute", () => {
  const dev = settings();
  assertEquals(applyDevCommand(dev, "-dev rematch 20"), "dev: automatic rematch after 20 s");
  assertEquals(dev.rematchSeconds, 20);
  for (const refused of ["-dev rematch 0", "-dev rematch 61", "-dev rematch 07"]) assertEquals(applyDevCommand(dev, refused), "dev: rematch must be 1-60");
  assertEquals(dev.rematchSeconds, 20);
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

test("a hero quick match gives every present human the named fighter", () => {
  assertEquals(quickMatchHero("-dev quick hero ILLIDAN"), Character.demonHunter);
  assertEquals(quickMatchHero("-dev quick hero nobody"), undefined);
  assertEquals(quickMatchHero("-dev quick"), undefined);
  const game = createMatchState();
  setParticipants(game, 0b011, 0b100);
  game.phase = Phase.characterMenu;
  assertTrue(prepareQuickMatch(game, 0, Character.demonHunter));
  assertEquals(game.phase, Phase.match);
  assertEquals(game.characterChoices[0], Character.demonHunter);
  assertEquals(game.characterChoices[1], Character.demonHunter);
});

test("recovery capture commands select every fighter by name without changing ordinary quick commands", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const name = fighterName(character);
    assertEquals(quickRecoveryHero(`-dev quick recovery hero ${name.toUpperCase()}`), character);
    assertEquals(quickOffstageHero(`-dev quick offstage hero ${name.toUpperCase()}`), character);
    assertEquals(quickMatchHero(`-dev quick recovery hero ${name}`), undefined);
    assertEquals(quickRecoveryHero(`-dev quick hero ${name}`), undefined);
  }
  assertEquals(quickRecoveryHero("-dev quick recovery hero nobody"), undefined);
});

test("a CPU quick match puts a computer at the named identity and difficulty in the first free slot, over three stocks", () => {
  assertEquals(quickMatchCpuProfile("-dev quick cpu wren expert")?.tier, "expert");
  assertEquals(quickMatchCpuProfile("-dev quick cpu nobody expert"), undefined);
  assertEquals(quickMatchCpuProfile("-dev quick cpu wren impossible"), undefined);
  assertEquals(quickMatchCpuProfile("-dev quick"), undefined);
  const game = createMatchState();
  setParticipants(game, 0b011, 0);
  game.phase = Phase.characterMenu;
  prepareQuickCpu(game, { opponent: "wren", tier: "rookie" });
  assertTrue(prepareQuickMatch(game, 0, undefined, QUICK_CPU_STOCKS));
  assertEquals(game.phase, Phase.match);
  assertEquals(game.computerMask, 0b100);
  assertEquals(game.cpuTiers[2], "rookie");
  assertEquals(game.stockCount, 3);
});

test("every selectable fighter starts as a CPU through the menu's own selection path", () => {
  assertEquals(quickMatchCpuProfile("-dev quick cpu wren expert hero nobody"), undefined);
  for (const character of SELECTABLE_CHARACTERS) {
    const command = `-dev quick cpu wren expert hero ${fighterName(character)}`;
    assertEquals(quickMatchCpuProfile(command)?.tier, "expert");
    assertEquals(quickMatchCpuHero(command), character);
    const game = createMatchState();
    setParticipants(game, 0b011, 0);
    prepareQuickCpu(game, { opponent: "wren", tier: "expert" }, quickMatchCpuHero(command));
    assertEquals(game.characterChoices[2], character);
    assertTrue(game.characterReadiness[2]);
    assertTrue(prepareQuickMatch(game, 0, undefined, QUICK_CPU_STOCKS));
    assertEquals(game.computerMask, 0b100);
    assertEquals(game.characterChoices[2], character);
    assertEquals(game.cpuTiers[2], "expert");
  }
});
