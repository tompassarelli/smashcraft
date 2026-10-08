// Classic (#284, smashcraft:docs/design/classic-mode.md): every fighter's
// route, a whole run's progression to the ending card, the bosses' fixed
// timetables, and a Lore Battles-style entry played through the same engine.
import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { HOME_STAGES } from "../menu/homeStages";
import { selectableStage } from "../menu/stageCatalog";
import { createFrameControls } from "../match/controls";
import { CPU_TIERS } from "../match/cpuProfiles";
import { type MatchState, Phase, createMatchState, fighterMask, requestStart, setParticipants } from "../match/rules";
import { initializeMatchFighters, matchSpawnX, stepMatch } from "../match/step";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "../replay/snapshot";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { PLAYABLE_CHARACTERS, SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { type Roster, createRoster, fighterAt, isActive } from "../sim/roster";
import { BOSSES, BOSS_OPENING_FRAMES, bossCycleFrames } from "./bosses";
import { CLASSIC_FIGHTS, ClassicStep, continueClassic, quitClassic, startClassic } from "./classic";
import { classicEnding, classicResults } from "./classicText";
import { applyConfiguredMatch, beginConfiguredRun, settleConfiguredMatch } from "./configuredMatch";
import { CLASSIC_ROUTES, classicRoute } from "./routes";
import { BossKind, type ConfiguredMatch, RunOutcome, WinCondition } from "./runState";

/** Arrays compare by their items. */
function same(actual: readonly unknown[] | undefined, expected: readonly unknown[] | undefined, message?: string): void {
  assertEquals((actual ?? []).join(","), (expected ?? []).join(","), message);
}

/** One human at fighter selection with `fighter` ready and Classic chosen at `tier`. */
function classicSelection(fighter: Character, tier: number): MatchState {
  const game = createMatchState();
  setParticipants(game, 1, 0);
  game.characterChoices[0] = fighter;
  game.characterReadiness[0] = true;
  game.classic = true;
  game.classicTier = tier;
  return game;
}

/** The fighters a configured match seats, standing at their spawns. */
function seat(game: MatchState): Roster {
  const world = createRoster(fighterMask(game));
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const x = matchSpawnX(slot, world.mask);
    world.fighters[slot] = createFighter(game.characterChoices[slot], x, x < 0 ? 1 : -1);
  }
  return world;
}

/** The configured match as the stage load starts it. */
function begin(game: MatchState): Roster {
  assertTrue(requestStart(game, game.run.player));
  const world = seat(game);
  initializeMatchFighters(game, world);
  return world;
}

/** Ends the current fight as won or lost, through the engine's own settlement. */
function finish(game: MatchState, world: Roster, won: boolean): void {
  if (game.run.boss.kind !== BossKind.none) game.run.boss.health = won ? 0 : game.run.boss.health;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const loses = (slot === game.run.player) !== won;
    if (loses) fighterAt(world, slot).status.stocks = 0;
  }
  game.winner = won ? game.run.player as 0 : undefined;
  game.matchFrame = game.startHold + 600;
  game.phase = Phase.result;
  settleConfiguredMatch(game, world);
}

test("every selectable fighter has one Classic route: five rival fights, the fifth on its home stage, then a lore boss and a two-or-three-line ending [spec docs/design/classic-mode.md]", () => {
  for (const fighter of SELECTABLE_CHARACTERS) {
    const routes = CLASSIC_ROUTES.filter(route => route.fighter === fighter);
    assertEquals(routes.length, 1, `${fighterName(fighter)} routes`);
    const route = routes[0];
    if (route === undefined) continue;
    assertEquals(route.fights.length, CLASSIC_FIGHTS - 1, fighterName(fighter));
    assertEquals(route.fights[4]?.stage, HOME_STAGES.find(home => home.character === fighter)?.stage, `${fighterName(fighter)} fifth fight on home stage`);
    assertEquals(route.fights[3]?.rivals.length, 2, `${fighterName(fighter)} team fight`);
    for (const fight of route.fights) {
      assertEquals(selectableStage(fight.stage), true, `${fighterName(fighter)} stage ${fight.stage}`);
      for (const rival of fight.rivals) assertEquals(rival !== fighter && SELECTABLE_CHARACTERS.includes(rival), true, `${fighterName(fighter)} rival ${rival}`);
    }
    assertEquals(route.boss !== BossKind.none, true, `${fighterName(fighter)} boss`);
    assertEquals(route.ending.length >= 2 && route.ending.length <= 3, true, `${fighterName(fighter)} ending lines`);
  }
  // Each boss ends at least one route.
  for (const boss of BOSSES) assertEquals(CLASSIC_ROUTES.some(route => route.boss === boss.kind), true, boss.name);
});

test("a Classic run plays every fighter's route in order, climbing the tiers, through its boss to the ending card and results line, and restores the menu [spec docs/design/classic-mode.md]", () => {
  for (const fighter of PLAYABLE_CHARACTERS) {
    const name = fighterName(fighter);
    const route = classicRoute(fighter);
    if (route === undefined) throw new Error(`${name} has no route`);
    const game = classicSelection(fighter, 1);
    assertEquals(startClassic(game, 0), true, `${name} starts`);
    const tiers: string[] = [];
    for (let fight = 0; fight < CLASSIC_FIGHTS; fight++) {
      assertEquals(game.phase, Phase.stageMenu, `${name} fight ${fight} loads`);
      const entry = game.run.current;
      if (entry === undefined) throw new Error(`${name} fight ${fight} has no entry`);
      const world = begin(game);
      if (fight < CLASSIC_FIGHTS - 1) {
        const plan = route.fights[fight];
        assertEquals(game.stageChoice, plan?.stage, `${name} fight ${fight} stage`);
        same(PARTICIPANT_SLOTS.filter(slot => isActive(world, slot) && slot !== 0).map(slot => world.fighters[slot]?.character), plan?.rivals, `${name} fight ${fight} rivals`);
        tiers.push(game.cpuTiers[1]);
        assertEquals(entry.win, WinCondition.ko);
      } else {
        assertEquals(entry.win, WinCondition.defeatBoss);
        assertEquals(game.run.boss.kind, route.boss, `${name} boss`);
        assertEquals(game.stageChoice, BOSSES.find(boss => boss.kind === route.boss)?.stage);
        assertEquals(world.mask, 1, `${name} fights the boss alone`);
        assertGreaterThan(game.run.boss.health, 0);
        assertEquals(!game.practice, true, `${name} boss match keeps stocks and the clock`);
      }
      finish(game, world, true);
      assertEquals(game.run.outcome, RunOutcome.won, `${name} fight ${fight}`);
      if (fight < CLASSIC_FIGHTS - 1) assertEquals(continueClassic(game, 0), ClassicStep.fight);
    }
    // Beginner start: Beginner, Beginner, Intermediate, Intermediate, Advanced.
    same(tiers, ["beginner", "beginner", "intermediate", "intermediate", "advanced"], name);
    assertEquals(game.run.cleared, true, `${name} cleared`);
    const ending = classicEnding(game);
    assertEquals(ending.speaker, name);
    same(ending.lines, route.ending);
    assertEquals(ending.results, "Time 1:00 · 0% damage taken · 0 continues · finished on Beginner", name);
    assertEquals(continueClassic(game, 0), ClassicStep.menu);
    same([game.phase, game.run.active, game.stockCount, game.timeLimitMinutes, game.computerMask, game.humanFighterMask], [Phase.characterMenu, false, 3, 7, 0, 1], name);
  }
});

test("a lost Classic fight continues as the same fight one tier easier, never below Rookie, and Back ends the run [spec docs/design/classic-mode.md]", () => {
  const game = classicSelection(Character.warden, 1);
  assertTrue(startClassic(game, 0));
  let world = begin(game);
  finish(game, world, true);
  continueClassic(game, 0);
  world = begin(game);
  finish(game, world, false);
  assertEquals(game.run.outcome, RunOutcome.lost);
  assertEquals(continueClassic(game, 0), ClassicStep.fight);
  same([game.run.fight, game.run.tier, game.run.continues, game.cpuTiers[1]], [1, 0, 1, CPU_TIERS[0]]);
  world = begin(game);
  finish(game, world, false);
  continueClassic(game, 0);
  same([game.run.fight, game.run.tier, game.run.continues], [1, 0, 2]);
  assertTrue(classicResults(game).includes("2 continues"));
  world = begin(game);
  finish(game, world, false);
  assertTrue(quitClassic(game, 0));
  same([game.phase, game.run.active], [Phase.characterMenu, false]);
});

/** A boss match on its stage with the player standing still under its strikes. */
function bossMatch(kind: BossKind, seed: number): ReplayState {
  const route = CLASSIC_ROUTES.find(candidate => candidate.boss === kind);
  if (route === undefined) throw new Error(`no route ends at boss ${kind}`);
  const game = classicSelection(route.fighter, 0);
  assertTrue(startClassic(game, 0));
  game.run.fight = CLASSIC_FIGHTS - 1;
  const entry = game.run.current;
  if (entry === undefined) throw new Error("no entry");
  applyConfiguredMatch(game, { ...entry, id: `boss.${kind}`, stage: 2, boss: kind, bossHealth: 200, win: WinCondition.defeatBoss, opponents: [], last: true, stocks: 9 });
  game.matchSeed = seed;
  const world = begin(game);
  return { world, match: game, controls: createFrameControls(), runtime: createPacingAndPresentation() };
}

for (const boss of BOSSES) {
  test(`${boss.name}'s strikes land on the same frames under two match seeds, and replaying from a mid-match snapshot equals straight play [spec #274] [invariant]`, () => {
    const frames = BOSS_OPENING_FRAMES + bossCycleFrames(boss) + 180 + 1;
    const tracks: string[] = [];
    for (const seed of [3, 4099]) {
      const live = bossMatch(boss.kind, seed);
      const saved = createReplaySnapshot();
      const track: number[] = [];
      let damage = 0.0;
      for (let frame = 1; frame <= frames && live.match.phase === Phase.match; frame++) {
        if (frame === 400) copyReplayState(saved, live);
        stepMatch(live.match, live.world, live.controls, frame);
        const now = fighterAt(live.world, 0).status.damage;
        if (now > damage || fighterAt(live.world, 0).status.out) track.push(frame);
        damage = now;
      }
      assertGreaterThan(track.length, 0);
      tracks.push(track.join(","));
      const replay = createReplaySnapshot();
      copyReplayState(replay, saved);
      for (let frame = 400; frame <= frames && replay.match.phase === Phase.match; frame++) stepMatch(replay.match, replay.world, replay.controls, frame);
      assertEquals(firstStateDifference(live, replay), undefined, `${boss.name} seed ${seed}`);
      assertEquals(stateChecksum(replay), stateChecksum(live));
    }
    assertEquals(tracks[0], tracks[1], boss.name);
  });
}

test("a Lore Battles entry built from data alone plays through the configured-match engine: starting damage, its stocks, and survive or KO-within-the-clock judged at time [spec docs/design/classic-mode.md]", () => {
  // Warden hunting Illidan in the Tomb of Sargeras (#305's example): survive a minute at 50%.
  const hunt: ConfiguredMatch = {
    id: "lore.warden-hunts-illidan", player: Character.warden,
    opponents: [{ character: Character.demonHunter, opponent: "vale", tier: "rookie", stocks: 3, damage: 20 }],
    stage: 7, stocks: 2, playerStocks: 1, timeMinutes: 1, playerDamage: 50, hazards: true,
    win: WinCondition.survive, boss: BossKind.none, bossHealth: 0, last: true,
    speaker: "Maiev Shadowsong", intro: "You will not escape me this time, Illidan.",
  };
  for (const [win, expected] of [[WinCondition.survive, RunOutcome.won], [WinCondition.koWithinClock, RunOutcome.lost]] as const) {
    const game = createMatchState();
    setParticipants(game, 1, 0);
    beginConfiguredRun(game, 0, Character.rifleman);
    applyConfiguredMatch(game, { ...hunt, win });
    const world = begin(game);
    same([fighterAt(world, 0).character, fighterAt(world, 0).status.stocks, fighterAt(world, 0).status.damage], [Character.warden, 1, 50]);
    same([fighterAt(world, 1).character, fighterAt(world, 1).status.stocks, fighterAt(world, 1).status.damage], [Character.demonHunter, 3, 20]);
    assertEquals(game.stageChoice, 7);
    const controls = createFrameControls();
    for (let frame = 1; frame <= game.startHold + 3600 + 1 && game.phase === Phase.match; frame++) stepMatch(game, world, controls, frame);
    same([game.phase, game.timedOut], [Phase.result, true]);
    assertEquals(game.run.outcome, expected, `win condition ${win}`);
    assertTrue(game.run.cleared === (expected === RunOutcome.won));
  }
});
