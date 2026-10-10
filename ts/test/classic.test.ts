


import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { BOSSES, BossPhase, bossCycleFrames, bossDefinition, bossMoment, collectBossContacts } from "../src/game/classic/bosses";
import { ClassicPresentation, BOSS_TELEGRAPH_MODEL } from "../src/game/render/classicPresentation";
import { classicRoute } from "../src/game/classic/routes";
import { RunOutcome } from "../src/game/classic/runState";
import { LORE_BATTLES } from "../src/game/classic/loreBattles";
import { createMatchState, Phase } from "../src/game/match/rules";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { Character } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster } from "../src/game/sim/roster";
import { beginDamageContacts } from "../src/game/sim/contacts";
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

for (const boss of BOSSES) {
  test(`${boss.name}'s every hit follows a visible area warning for its full reaction window [k3 measure #330]`, () => {
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


test("Grom completes six Classic fights, sees his ending and results, and clears his last stand in Lore Battles [k1 scenario]", () => {
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
