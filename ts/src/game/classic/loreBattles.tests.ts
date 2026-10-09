


import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { selectableStage } from "../menu/stageCatalog";
import { CPU_TIERS } from "../match/cpuProfiles";
import { type MatchState, Phase, createMatchState, fighterMask, requestStart, setParticipants } from "../match/rules";
import { initializeMatchFighters, matchSpawnX } from "../match/step";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { type Roster, createRoster, fighterAt, isActive } from "../sim/roster";
import { CLASSIC_CHARACTERS } from "./routes";
import { bossDefinition, bossHealth } from "./bosses";
import { settleConfiguredMatch } from "./configuredMatch";
import { LORE_BATTLES, LoreStep, continueLore, startLore } from "./loreBattles";
import { type ChunkFiles, LORE_CLEARS_FILE, LoreClears } from "./loreClears";
import { BossKind, RunOutcome, WinCondition } from "./runState";


function loreSelection(index: number): MatchState {
  const game = createMatchState();
  setParticipants(game, 1, 0);
  game.lore = true;
  game.loreBattle = index;
  return game;
}


function begin(game: MatchState): Roster {
  assertTrue(requestStart(game, game.run.player));
  const world = createRoster(fighterMask(game));
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const x = matchSpawnX(slot, world.mask);
    world.fighters[slot] = createFighter(game.characterChoices[slot], x, x < 0 ? 1 : -1);
  }
  initializeMatchFighters(game, world);
  return world;
}


function battleTier(index: number): number {
  const battle = LORE_BATTLES[index];
  if (battle === undefined) return -1;
  if (battle.boss !== BossKind.none) return CPU_TIERS.findIndex((_, tier) => bossHealth(battle.boss, tier) === battle.bossHealth);
  return CPU_TIERS.indexOf(battle.opponents[0]?.tier ?? "rookie");
}

test("the original twenty Lore Battles and authored expansion stories keep valid matches, cover finished fighters and all stages, and never get easier down the list [spec #305] [spec #351]", () => {
  assertTrue(LORE_BATTLES.length >= 20);
  const fighters = new Set<number>();
  const stages = new Set<number>();
  const wins = new Set<number>();
  for (let index = 0; index < LORE_BATTLES.length; index++) {
    const battle = LORE_BATTLES[index];
    if (battle === undefined) continue;
    const name = battle.title;
    assertEquals(SELECTABLE_CHARACTERS.includes(battle.player), true, `${name} player`);
    assertEquals(selectableStage(battle.stage), true, `${name} stage`);
    assertEquals(battle.timeMinutes > 0 && battle.last && battle.intro.length > 0 && battle.speaker.length > 0, true, `${name} clock and transmission`);
    assertEquals(LORE_BATTLES.filter(other => other.id === battle.id).length, 1, `${name} id`);
    fighters.add(battle.player);
    stages.add(battle.stage);
    wins.add(battle.win);
    if (battle.win === WinCondition.defeatBoss) {
      assertEquals(battle.opponents.length, 0, `${name} fights the boss alone`);
      assertEquals(battle.stage, bossDefinition(battle.boss)?.stage, `${name} boss stage`);
      assertEquals(battle.bossHealth > 0, true, `${name} boss health`);
    } else {
      assertEquals(battle.boss, BossKind.none, `${name} boss`);
      assertEquals(battle.opponents.length >= 1 && battle.opponents.length <= 2, true, `${name} opponents`);
      for (const opponent of battle.opponents) {
        assertEquals(SELECTABLE_CHARACTERS.includes(opponent.character) && opponent.character !== battle.player, true, `${name} opponent ${fighterName(opponent.character)}`);
        assertEquals(opponent.tier, battle.opponents[0]?.tier, `${name} opponents share a tier`);
        fighters.add(opponent.character);
      }
    }
    if (index > 0) assertEquals(battleTier(index) >= battleTier(index - 1), true, `${name} is no easier than the battle before`);
  }
  for (let fighter = 1; fighter <= 21; fighter++) assertEquals(fighters.has(fighter), true, `original fighter ${fighter} used`);
  for (const fighter of CLASSIC_CHARACTERS) assertEquals(fighters.has(fighter), true, `${fighterName(fighter)} has Lore coverage`);
  assertEquals(stages.size, STAGE_CATALOG.length, "stages used");
  assertEquals(wins.size, 4, "win conditions used");
  assertEquals(battleTier(0), 0);
  assertEquals(battleTier(LORE_BATTLES.length - 1), CPU_TIERS.length - 1);
});


function judge(index: number, playerWon: boolean, timedOut: boolean, playerAlive: boolean, bossLeft = 0): RunOutcome {
  const game = loreSelection(index);
  assertTrue(startLore(game, 0));
  const world = begin(game);
  if (game.run.boss.kind !== BossKind.none) game.run.boss.health = bossLeft;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const loses = slot === 0 ? !playerAlive : playerWon && !timedOut;
    if (loses) fighterAt(world, slot).status.stocks = 0;
  }
  game.winner = playerWon ? 0 : undefined;
  game.timedOut = timedOut;
  game.phase = Phase.result;
  settleConfiguredMatch(game, world);
  assertEquals(game.run.cleared, game.run.outcome === RunOutcome.won);
  return game.run.outcome;
}

test("each Lore Battle win condition fires on its rule: KO wins on the result, survive on a stock at time, KO within the clock only before time, and a boss at zero health [spec #305]", () => {
  const first = (win: WinCondition): number => LORE_BATTLES.findIndex(battle => battle.win === win);
  const { won, lost } = RunOutcome;
  const ko = first(WinCondition.ko);
  assertEquals(judge(ko, true, false, true), won, "KO: player wins");
  assertEquals(judge(ko, true, true, true), won, "KO: player ahead at time");
  assertEquals(judge(ko, false, false, false), lost, "KO: player out");
  const survive = first(WinCondition.survive);
  assertEquals(judge(survive, false, true, true), won, "survive: a stock at time, behind on stocks");
  assertEquals(judge(survive, false, false, false), lost, "survive: out before time");
  const clock = first(WinCondition.koWithinClock);
  assertEquals(judge(clock, true, false, true), won, "KO within the clock: KO before time");
  assertEquals(judge(clock, true, true, true), lost, "KO within the clock: ahead but at time");
  const boss = first(WinCondition.defeatBoss);
  assertEquals(judge(boss, true, false, true, 0), won, "boss at zero");
  assertEquals(judge(boss, false, true, true, 40), lost, "boss left at time");
  assertEquals(judge(boss, false, false, false, 40), lost, "player out");
});

test("a Lore Battle starts with its own fighter, opponents, stage, stocks and damage; a loss retries it and a clear returns to the list with the next battle chosen and the menu's rules back [spec #305]", () => {
  const index = LORE_BATTLES.findIndex(battle => battle.id === "lore.silvermoon");
  const battle = LORE_BATTLES[index];
  if (battle === undefined) throw new Error("no Silvermoon battle");
  const game = loreSelection(index);
  assertTrue(startLore(game, 0));
  let world = begin(game);
  assertEquals(game.stageChoice, battle.stage);
  assertEquals(fighterAt(world, 0).character, battle.player);
  assertEquals(fighterAt(world, 0).status.damage, battle.playerDamage);
  assertEquals(fighterAt(world, 0).status.stocks, battle.playerStocks);
  assertEquals(fighterAt(world, 1).character, battle.opponents[0]?.character);
  assertEquals(fighterAt(world, 1).status.stocks, battle.stocks);
  fighterAt(world, 0).status.stocks = 0;
  game.phase = Phase.result;
  settleConfiguredMatch(game, world);
  assertEquals(continueLore(game, 0), LoreStep.retry);
  assertEquals(game.phase, Phase.stageMenu);
  world = begin(game);
  game.timedOut = true;
  game.phase = Phase.result;
  settleConfiguredMatch(game, world);
  assertTrue(game.run.cleared);
  assertEquals(continueLore(game, 0), LoreStep.menu);
  assertEquals(game.phase, Phase.characterMenu);
  assertEquals(game.run.active, false);
  assertEquals(game.loreBattle, index + 1);
  const menu = createMatchState();
  assertEquals(game.stockCount, menu.stockCount);
  assertEquals(game.timeLimitMinutes, menu.timeLimitMinutes);
  assertEquals(game.computerMask, 0);
});

test("a cleared Lore Battle is still cleared after the game reloads its local file, and unknown ids in the file are ignored [spec #305]", () => {
  const disk = new Map<string, string[]>();
  const files: ChunkFiles = {
    read: name => [...(disk.get(name) ?? [])],
    write: (name, chunks) => { disk.set(name, [...chunks]); return true; },
  };
  const ids = LORE_BATTLES.map(battle => battle.id);
  const before = new LoreClears(files);
  assertEquals(before.count(), 0);
  for (const id of ids) before.mark(id);
  before.mark(ids[0] ?? "");
  const reloaded = new LoreClears(files);
  assertEquals(reloaded.count(), ids.length);
  for (const id of ids) assertEquals(reloaded.has(id), true, id);
  disk.set(LORE_CLEARS_FILE, ["lore.retired,", ids[3] ?? ""]);
  const edited = new LoreClears(files);
  assertEquals(edited.count(), 1);
  assertTrue(edited.has(ids[3] ?? ""));
});
