// The integrity build's match, slot change and three-fighter rematch in two
// simulated clients, with each helper typing #26's dense taps into the edit
// box and Battle.net's measured sync latency. Native #26 runs held one core
// per client in the first match and fell behind real time in the rematch,
// whose slot change adds a computer fighter that every client simulates.
import { afterAll, expect, test } from "bun:test";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/scripts/wisp/syncChannel";
import type { HeadlessClient } from "wisp/src/headless/client";
import { originalClipCount, originalLightPath } from "../src/game/assets/fighterOriginalClipInfo";
import { Phase } from "../src/game/match/rules";
import { ReplayHistory } from "../src/game/replay/history";
import { ShadowInputPlayback } from "../src/game/replay/shadowPlayback";
import { Character } from "../src/game/sim/codes";
import { PROJECTILE_CAPACITY } from "../src/game/sim/fighter";
import { install, start } from "../src/platform/integrityMain";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, type Workload } from "./rematch/journalHelper";

const declarations = readNativeDeclarations();
// Desyncs are the desync guard's to find; unlogged natives keep these frames fast.
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this test counts the calls it checks"]));
const helpers = new JournalHelpers();
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged, natives: (client) => helpers.natives(client) }, declarations);
afterAll(headless.restore);

/** History rows each reconcile read, per call. */
const rowsRead: number[] = [];
const copyInputRow = ReplayHistory.prototype.copyInputRow;
const reconcile = ShadowInputPlayback.prototype.reconcile;
afterAll(() => {
  ReplayHistory.prototype.copyInputRow = copyInputRow;
  ShadowInputPlayback.prototype.reconcile = reconcile;
});
ReplayHistory.prototype.copyInputRow = function (this: ReplayHistory, ...args: Parameters<typeof copyInputRow>) {
  rowsRead[rowsRead.length - 1]++;
  return copyInputRow.apply(this, args);
};
ShadowInputPlayback.prototype.reconcile = function (this: ShadowInputPlayback, ...args: Parameters<typeof reconcile>) {
  rowsRead.push(0);
  return reconcile.apply(this, args);
};

/** Natives that create or destroy a handle a match could leak. */
const LIFETIMES = ["AddSpecialEffect", "AddSpecialEffectTarget", "DestroyEffect", "CreateTimer", "DestroyTimer", "CreateTrigger", "DestroyTrigger"];

/** Counts a client's handle creations and destructions by native. */
function countLifetimes(client: HeadlessClient): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of LIFETIMES) {
    const native = client.natives[name] as (...args: unknown[]) => unknown;
    client.natives[name] = (...args: unknown[]) => {
      counts.set(name, (counts.get(name) ?? 0) + 1);
      return native(...args);
    };
  }
  return counts;
}

test("a match and its three-fighter rematch read only correctable rollback rows and keep nothing between them", () => {
  const clients = headless.clients({ start, install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
  const host = clients.clients[0] as HeadlessClient;
  const lifetimes = countLifetimes(host);
  const read = <T>(body: () => T): T => {
    let value: T | undefined;
    host.run(() => {
      value = body();
    });
    return value as T;
  };
  const phase = () => read(() => shell().game.phase);
  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame++) {
      clients.frames(1);
      helpers.service(clients);
    }
  };
  const until = (what: string, done: () => boolean, limit: number) => {
    for (let frame = 0; frame < limit && !done(); frame++) frames(1);
    if (!done()) throw new Error(`${what} not reached; phase ${phase()}`);
  };
  /** Selection, a one-stock match on the workload, its result and the return to fighter selection. */
  const play = (workload: Workload) => {
    for (const slot of [0, 1]) clients.press(slot, Key.n);
    frames(5);
    clients.press(0, Key.y);
    until("stage menu", () => phase() === Phase.stageMenu, 30);
    clients.everywhere(() => {
      while (shell().game.stockCount > 1) panelActions().stage.changeStocks(1, -1);
    });
    helpers.workload = workload;
    // Ctrl+G records the response probe, whose rows count each correction.
    clients.press(0, Key.g, 2);
    clients.press(0, Key.y);
    until("match", () => phase() === Phase.match, 30);
    rowsRead.length = 0;
    lifetimes.clear();
    until("a result", () => phase() !== Phase.match, 900);
    const rollbacks = read(() => shell().probe?.integrity.filter((row) => row.split(" ")[1] === "rollback").length ?? 0);
    const played = { lifetimes: Object.fromEntries(lifetimes), rows: Math.max(...rowsRead), rollbacks, effectsAtResult: host.effectPoses().length };
    // The edit box keeps the keyboard until both helpers have stopped journaling the match.
    until("helpers quiescent", () => read(() => shell().rollback?.journal?.lifecycle?.quiescent() === true), 90);
    for (const slot of [0, 1]) clients.press(slot, Key.n);
    until("fighter selection", () => phase() === Phase.characterMenu, 30);
    return played;
  };

  clients.start();
  frames(60);
  const window = read(() => shell().rollback?.window ?? 0);
  const first = play({ denseCycles: 1, walkers: [0] });
  const selectionAfterFirst = host.effectPoses().length;
  // The slot change of #26's rematch: slot C goes from EMPTY to a human fighter, then to a computer.
  for (let click = 0; click < 2; click++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  expect(read(() => [shell().game.humanFighterMask, shell().game.computerMask, shell().game.characterChoices[2]])).toEqual([3, 4, Character.demonHunter]);
  const rematch = play({ denseCycles: 1, walkers: [0, 1] });

  for (const played of [first, rematch]) {
    expect(played.rollbacks).toBeGreaterThan(5);
    // A reconcile reads the rows a correction may change, the authoritative row before them and the newest
    // row once more, never the whole 64-frame history.
    expect(played.rows).toBeLessThanOrEqual(window + 2);
  }
  // Match frames create and destroy nothing but the input trace's clock, made at its first start; the result
  // recreates the menu key triggers the match start removed.
  expect(first.lifetimes).toEqual({ CreateTimer: 1, CreateTrigger: 2 });
  expect(rematch.lifetimes).toEqual({ CreateTrigger: 2 });
  // At its result the rematch also holds the computer Illidan's clip pool, shield and projectiles; fighter
  // selection ends every fighter's renderers, so it then holds exactly what it held after the first match.
  const illidan = originalClipCount(Character.demonHunter) + (originalLightPath(Character.demonHunter) === undefined ? 0 : 1);
  expect(rematch.effectsAtResult - first.effectsAtResult).toBe(illidan + 1 + PROJECTILE_CAPACITY);
  expect(host.effectPoses().length).toBe(selectionAfterFirst);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
});
