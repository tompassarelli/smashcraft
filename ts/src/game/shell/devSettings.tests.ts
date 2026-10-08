import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, fighterMask, selectCharacter, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { QUICK_CPU_STOCKS, prepareQuickCpu, prepareQuickMatch, quickMatchCpuHero, quickMatchCpuProfile, quickMatchHero, quickRecoveryHero, quickOffstageHero } from "./devSettings";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";

test("a quick match readies every present human's default fighter and starts with one stock on the default stage [spec docs/native-bot-session.md]", () => {
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

test("a hero quick match gives every present human the named fighter [spec AGENTS.md]", () => {
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

test("recovery capture commands select every fighter by name without changing ordinary quick commands [spec AGENTS.md]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const name = fighterName(character);
    assertEquals(quickRecoveryHero(`-dev quick recovery hero ${name.toUpperCase()}`), character);
    assertEquals(quickOffstageHero(`-dev quick offstage hero ${name.toUpperCase()}`), character);
    assertEquals(quickMatchHero(`-dev quick recovery hero ${name}`), undefined);
    assertEquals(quickRecoveryHero(`-dev quick hero ${name}`), undefined);
  }
  assertEquals(quickRecoveryHero("-dev quick recovery hero nobody"), undefined);
});

test("a CPU quick match puts a computer at the named identity and difficulty in the first free slot, over three stocks [spec AGENTS.md]", () => {
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

test("every selectable fighter starts as a CPU through the menu's own selection path [spec AGENTS.md]", () => {
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
