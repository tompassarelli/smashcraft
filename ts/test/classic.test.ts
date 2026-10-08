// #284: Classic chosen with the mode button at fighter selection, its first
// fight started on both journal clients, and a boss match played into its
// strikes, with both clients agreeing throughout.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { bossDefinition } from "../src/game/classic/bosses";
import { classicRoute } from "../src/game/classic/routes";
import { extremeCamera } from "../src/game/presentation/arenaCamera";
import { MATCH_CAMERA_ASPECT, createMatchCamera } from "../src/game/sim/matchCamera";
import { MAIN_DECK_HALF_DEPTH } from "../scripts/stageDeck";
import { BossKind } from "../src/game/classic/runState";
import { Phase } from "../src/game/match/rules";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { Character } from "../src/game/sim/codes";
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
  clients.chat(0, "-dev classic boss Archer");
  until("the boss match", () => read(() => shell().game.phase) === Phase.match, 240);
  // Past GO! and the opening into the first strikes.
  frames(380);
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(value(client, () => {
      const { game } = shell();
      return [game.phase, game.run.boss.kind, game.stageChoice, game.run.fighter, game.run.boss.strike >= 1];
    })).toEqual([Phase.match, BossKind.archimonde, 10, Character.archer, true]);
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
