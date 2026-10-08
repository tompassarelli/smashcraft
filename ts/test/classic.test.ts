// #284: Classic chosen with the mode button at fighter selection, its first
// fight started on both journal clients, and a boss match played into its
// strikes, with both clients agreeing throughout.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { BOSSES, BossPhase, bossCycleFrames, bossDefinition, bossMoment, collectBossContacts } from "../src/game/classic/bosses";
import { ClassicPresentation, BOSS_TELEGRAPH_MODEL } from "../src/game/render/classicPresentation";
import { classicRoute } from "../src/game/classic/routes";
import { extremeCamera } from "../src/game/presentation/arenaCamera";
import { MATCH_CAMERA_ASPECT, createMatchCamera } from "../src/game/sim/matchCamera";
import { MAIN_DECK_HALF_DEPTH } from "../scripts/stageDeck";
import { BossKind, RunOutcome } from "../src/game/classic/runState";
import { LORE_BATTLES } from "../src/game/classic/loreBattles";
import { createMatchState, Phase } from "../src/game/match/rules";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster } from "../src/game/sim/roster";
import { beginDamageContacts } from "../src/game/sim/contacts";
import { RULE_BUTTONS } from "../src/game/ui/ruleButtons";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { shell } from "../src/platform/shell/state";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, rowFor } from "./rematch/journalHelper";
import { expectSynchronized, shows, value } from "./rematch/playableMatch";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

function classicClients(idle = false) {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1]);
  const helpers = new JournalHelpers(INTEGRITY_BUILD.id, idle);
  helpers.rows = (slot, frame) => rowFor(slot, frame, { denseCycles: 0, walkers: [] });
  const frames = (n: number) => { for (let i = 0; i < n; i++) { clients.frames(1); helpers.service(clients); } };
  const until = (what: string, done: () => boolean, n = 600) => {
    for (let i = 0; i < n && !done(); i++) frames(1);
    expect(done(), what).toBe(true);
  };
  return { clients, frames, until, read: <T>(body: () => T) => value(clients.client(0), body) };
}

test("the mode button reaches Classic on both clients, and Start plays the first fight of the player's route [spec #284] [invariant]", () => {
  const { clients, frames, until, read } = classicClients();
  clients.start(); frames(30);
  const box = RULE_BUTTONS.training;
  for (let press = 0; press < 2; press++) {
    expect(clients.click(1, box.x + box.width / 2, box.y - box.height / 2)).toBe(true);
    frames(1);
  }
  for (const client of clients.clients) {
    expect(value(client, () => [shell().game.classic, shell().game.training])).toEqual([true, false]);
    expect(shows(client, "Mode: Classic")).toBe(true);
    expect(shows(client, "Classic start: Beginner")).toBe(true);
  }
  for (const actor of [0, 1]) clients.press(actor, Key.n);
  frames(5);
  clients.press(0, Key.y);
  until("Classic's first fight", () => read(() => shell().game.phase) === Phase.match, 240);
  const fighter = read(() => shell().game.run.fighter);
  const first = classicRoute(fighter)?.fights[0];
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => {
      const { game } = shell();
      return [game.run.active, game.run.fight, game.stageChoice, game.humanFighterMask, game.characterChoices[2], game.cpuTiers[2]];
    })).toEqual([true, 0, first?.stage, 1, first?.rivals[0], "beginner"]);
  }
  frames(240);
  expectSynchronized(clients);
});

test("-dev classic boss starts Archimonde's battle on Nordrassil on both clients, and his strikes play without errors [spec #284] [invariant]", () => {
  const { clients, frames, until, read } = classicClients(true);
  clients.start(); frames(30);
  clients.chat(0, "-dev classic boss Blademaster");
  until("the boss match", () => read(() => shell().game.phase) === Phase.match, 240);
  // Past GO! and the opening into the first strikes.
  frames(380);
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => {
      const { game } = shell();
      return [game.phase, game.run.boss.kind, game.stageChoice, game.run.fighter, game.run.boss.strike >= 1];
    })).toEqual([Phase.match, BossKind.archimonde, 10, Character.blademaster, true]);
  }
  expectSynchronized(clients);
});

test("every boss's whole drawn body stands behind the deck and inside the view at both camera extremes, wherever its strikes move it [repro #284]", () => {
  // Natively Archimonde stood in front of the fighters and the Lich King and Kil'jaeden drew off the top of the screen.
  const tilt = Math.PI / 18;
  for (const kind of [BossKind.archimonde, BossKind.lichKing, BossKind.kiljaeden]) {
    const boss = bossDefinition(kind);
    if (boss === undefined) throw new Error(`missing boss ${kind}`);
    const { min, max } = boss.drawn;
    // The body is turned a quarter right to face the camera: model x points toward the viewer (-y), model y along +x.
    const corners = boss.strikes.flatMap(({ x }) => [min[0], max[0]].flatMap(forward => [min[1], max[1]].flatMap(side => [min[2], max[2]].map(up =>
      [x + boss.scale * side, boss.depth - boss.scale * forward, boss.standZ + boss.scale * up] as const))));
    for (const [, y] of corners) expect(y, `${boss.name} behind the deck`).toBeGreaterThan(MAIN_DECK_HALF_DEPTH);
    for (const extreme of ["near", "far"] as const) {
      const camera = createMatchCamera();
      extremeCamera(camera, boss.stage, MATCH_CAMERA_ASPECT, extreme);
      for (const [x, y, z] of corners) {
        const depth = camera.distance + y * Math.cos(tilt) - (z - camera.z) * Math.sin(tilt);
        const column = 0.5 + (x - camera.x) / (2 * depth * camera.tangent * MATCH_CAMERA_ASPECT);
        const row = 0.5 - (y * Math.sin(tilt) + (z - camera.z) * Math.cos(tilt)) / (2 * depth * camera.tangent);
        expect(column, `${boss.name} ${extreme}`).toBeGreaterThan(0.05);
        expect(column, `${boss.name} ${extreme}`).toBeLessThan(0.95);
        expect(row, `${boss.name} ${extreme} top`).toBeGreaterThan(0.05);
        expect(row, `${boss.name} ${extreme}`).toBeLessThan(1);
      }
    }
  }
});

for (const boss of BOSSES) {
  test(`${boss.name}'s every hit follows a visible area warning for its full reaction window [spec #330]`, () => {
    const clients = headless.clients({ start: () => {}, install: () => {} }, [0]);
    const client = clients.client(0);
    const game = createMatchState();
    game.phase = Phase.match; game.run.active = true; game.run.boss.kind = boss.kind; game.run.boss.health = 1000;
    const fighter = createFighter(Character.rifleman, 0, 1);
    const world = createRoster(1, [fighter]);
    let presentation: ClassicPresentation;
    client.run(() => {
      presentation = new ClassicPresentation({ x: 0, y: 0, z: 0 });
      presentation.beginMatch(game);
      const starts = new Map<number, number>();
      const hits = new Map<number, number>();
      for (let clock = 1; clock <= bossCycleFrames(boss) + 90; clock++) {
        game.matchFrame = clock;
        const now = { ...bossMoment(boss, clock) };
        const strike = boss.strikes[now.index];
        const zone = strike?.zones[0];
        if (zone === undefined || strike === undefined) throw new Error("missing strike");
        fighter.motion.x = zone.x; fighter.motion.z = Math.max(0, zone.bottom);
        beginDamageContacts();
        collectBossContacts(game.run.boss, world, clock, 0);
        presentation.present(game);
        if (now.strike < 0) continue;
        const markers = client.effectPoses({ visibleOnly: true }).filter(pose => pose.model === BOSS_TELEGRAPH_MODEL);
        if (now.phase === BossPhase.tell) {
          expect(game.run.boss.hitMask).toBe(0);
          expect(markers.length).toBe(strike.zones.length);
          if (!starts.has(now.strike)) starts.set(now.strike, clock);
          for (let index = 0; index < strike.zones.length; index++) {
            const area = strike.zones[index]; const marker = markers[index];
            if (area === undefined || marker === undefined) throw new Error("missing zone marker");
            expect(marker.matrixScale[0] * 38.168).toBeCloseTo(area.halfWidth, 2);
            expect(marker.matrixScale[1] * 76.336).toBeCloseTo(area.top - area.bottom, 2);
            expect(marker.roll).toBeCloseTo(Math.PI / 2, 5);
            expect(marker.timeScale).toBe(0);
          }
        } else if (now.phase === BossPhase.active && !hits.has(now.strike)) {
          expect(game.run.boss.hitMask).toBe(1);
          const start = starts.get(now.strike);
          expect(start).toBeDefined();
          expect(clock - (start ?? clock)).toBeGreaterThanOrEqual(20);
          expect(clock - (start ?? clock)).toBe(strike.tell);
          hits.set(now.strike, clock);
          console.log(`${boss.name}/${now.index} ${strike.name}: tell=${start} hit=${clock} window=${clock - (start ?? clock)}`);
        }
      }
      expect(hits.size).toBe(boss.strikes.length);
      presentation.destroy();
    });
    expect(client.errors).toEqual([]);
  });
}


test("Grom completes six Classic fights, sees his ending and results, and clears his last stand in Lore Battles [spec #349]", () => {
  const { clients, frames, until, read } = classicClients(true);
  clients.start(); frames(30);
  clients.chat(0, "-dev classic Grom Hellscream");
  const route = classicRoute(Character.grom);
  if (route === undefined) throw new Error("Grom's route missing");
  for (let fight = 0; fight < 6; fight++) {
    until(`Grom fight ${fight + 1}`, () => read(() => shell().game.phase) === Phase.match, 240);
    expect(read(() => [shell().game.run.fighter, shell().game.run.fight])).toEqual([Character.grom, fight]);
    expect(read(() => shell().game.stageChoice)).toBe(fight === 5 ? bossDefinition(route.boss)?.stage : route.fights[fight]?.stage);
    frames(2);
    // Script the knockout; the running map judges the result and advances on the player's confirm.
    clients.everywhere(() => {
      const { game, world } = shell();
      for (const fighter of world.fighters) {
        if (fighter !== undefined && fighter.character !== Character.grom) {
          fighter.status.stocks = 0;
          fighter.status.out = true;
        }
      }
      game.run.boss.health = 0;
    });
    until(`Grom result ${fight + 1}`, () => read(() => shell().game.phase) === Phase.result, 600);
    expect(read(() => shell().game.run.outcome)).toBe(RunOutcome.won);
    frames(120);
    if (fight < 5) { clients.press(0, Key.y); frames(2); }
  }
  for (const client of clients.clients) {
    expect(value(client, () => shell().game.run.cleared)).toBe(true);
    expect(shows(client, "Grom Hellscream cleared Classic!")).toBe(true);
    for (const line of route.ending) expect(shows(client, line)).toBe(true);
    expect(shows(client, "0 continues")).toBe(true);
  }
  expectSynchronized(clients);
  clients.press(0, Key.y);
  until("Grom returns to selection", () => read(() => shell().game.phase) === Phase.characterMenu);
  const lore = LORE_BATTLES.findIndex(battle => battle.id === "lore.grom-mannoroth");
  expect(LORE_BATTLES[lore]?.player).toBe(Character.grom);
  clients.chat(0, `-dev lore ${lore + 1}`);
  until("Grom's Mannoroth battle", () => read(() => shell().game.phase) === Phase.match, 240);
  expect(read(() => [shell().game.run.fighter, shell().game.run.current?.id, shell().game.characterChoices[2]])).toEqual([Character.grom, "lore.grom-mannoroth", Character.pitLord]);
  frames(2);
  clients.chat(0, "-dev lore win");
  until("Grom's Lore clear", () => read(() => shell().game.phase) === Phase.result, 120);
  frames(2);
  expect(read(() => shell().game.run.cleared)).toBe(true);
  expectSynchronized(clients);
});
