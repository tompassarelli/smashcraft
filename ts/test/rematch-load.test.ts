// A match, slot change and three-fighter rematch in two simulated clients of
// the playable build, whose journal input and rollback the integrity build
// shares without its diagnostics, with each helper typing #26's dense taps
// into the edit box and Battle.net's measured sync latency. Native #26 runs
// held one core per client in the first match and fell behind real time in
// the rematch, whose slot change adds a computer fighter that every client
// simulates.
import { afterAll, expect, test } from "bun:test";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import type { EffectPose, HeadlessClient } from "wisp/src/headless/client";
import { originalClipCount, originalLightPath } from "../src/game/assets/fighterOriginalClipInfo";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { Phase } from "../src/game/match/rules";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { characterModelScale } from "../src/game/presentation/modelScale";
import { fitFighterPlacement } from "../src/game/presentation/fighterPlacement";
import { FIGHTER_OBJECTS } from "../src/game/objectData";
import { ReplayHistory } from "../src/game/replay/history";
import { ShadowInputPlayback } from "../src/game/replay/shadowPlayback";
import { Character } from "../src/game/sim/codes";
import { PROJECTILE_CAPACITY } from "../src/game/sim/fighter";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { matchRecordFile } from "../src/runtime/gameFiles";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { activeRollback, shell } from "../src/platform/shell/state";
import { views } from "../src/platform/shell/ui";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, type Workload } from "./rematch/journalHelper";

const declarations = readNativeDeclarations();
// Desyncs are the desync guard's to find; unlogged natives keep these frames fast.
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this test counts the calls it checks"]));
const helpers = new JournalHelpers(PLAYABLE_BUILD.id);
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged }, declarations);
afterAll(headless.restore);

/** History rows each reconciliation read, per call, and the corrections that changed rows. */
const rowsRead: number[] = [];
let corrections = 0;
const copyInputRow = ReplayHistory.prototype.copyInputRow;
const amend = ShadowInputPlayback.prototype.amend;
afterAll(() => {
  ReplayHistory.prototype.copyInputRow = copyInputRow;
  ShadowInputPlayback.prototype.amend = amend;
});
ReplayHistory.prototype.copyInputRow = function (this: ReplayHistory, ...args: Parameters<typeof copyInputRow>) {
  rowsRead[rowsRead.length - 1]++;
  return copyInputRow.apply(this, args);
};
ShadowInputPlayback.prototype.amend = function (this: ShadowInputPlayback, ...args: Parameters<typeof amend>) {
  rowsRead.push(0);
  const result = amend.apply(this, args);
  if (typeof result === "number") corrections++;
  return result;
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

/** The effect setters whose result a headless client keeps in an effect's pose. */
const POSED = ["BlzSetSpecialEffectPosition", "BlzSetSpecialEffectX", "BlzSetSpecialEffectY", "BlzSetSpecialEffectZ", "BlzSetSpecialEffectAlpha", "BlzSetSpecialEffectScale", "BlzSetSpecialEffectTimeScale", "BlzSetSpecialEffectMatrixScale", "BlzResetSpecialEffectMatrix"];

/**
 * Counts, while `on`, setter calls during a frame on effects parked before
 * and after it whose pose the frame left as it was: Warcraft runs each
 * native call, and a pool's hidden effects stay parked for most of a match.
 * Call `frameEnded` after each frame.
 */
function parkedCallMeter(client: HeadlessClient, parkedBelow: () => number) {
  const poses = (client as unknown as { effects: Map<unknown, EffectPose> }).effects;
  const describe = (pose: EffectPose) => `${pose.x} ${pose.y} ${pose.z} ${pose.alpha} ${pose.scale} ${pose.timeScale} ${pose.flat}`;
  /** This frame's touched effects: their pose before the first call and the calls they took. */
  const touched = new Map<unknown, { readonly before: string; readonly parked: boolean; calls: number }>();
  const meter = {
    on: false,
    calls: 0,
    frameEnded: () => {
      for (const [effect, { before, parked, calls }] of touched) {
        const pose = poses.get(effect);
        if (parked && pose !== undefined && pose.z < parkedBelow() && describe(pose) === before) meter.calls += calls;
      }
      touched.clear();
    },
  };
  for (const name of POSED) {
    const native = client.natives[name] as (effect: unknown, ...args: unknown[]) => unknown;
    client.natives[name] = (effect: unknown, ...args: unknown[]) => {
      const pose = meter.on ? poses.get(effect) : undefined;
      if (pose !== undefined) {
        const seen = touched.get(effect) ?? { before: describe(pose), parked: pose.z < parkedBelow(), calls: 0 };
        seen.calls++;
        touched.set(effect, seen);
      }
      return native(effect, ...args);
    };
  }
  return meter;
}

/**
 * What is wrong with the clips the client's pooled fighters show this match
 * frame: each fighter in play shows exactly one clip, where the presented
 * match puts him, at his model's scale and opacity, and with his own model's
 * whole mesh; a fighter out shows none. Counts each character's checked
 * frames in `seen`.
 */
function shownClipProblems(client: HeadlessClient, parkedBelow: number, seen: Map<Character, number>): string[] {
  const problems: string[] = [];
  client.run(() => {
    const s = shell();
    if (s.game.phase !== Phase.match) return;
    const rollback = activeRollback(s);
    const world = s.build.presentation === "pool-predicted" && rollback !== undefined ? rollback.speculative.world : s.world;
    const poses = (client as unknown as { readonly effects: ReadonlyMap<unknown, EffectPose> }).effects;
    for (const slot of PARTICIPANT_SLOTS) {
      const pool = views(s).fighters[slot]?.pool as unknown as { readonly clips: readonly unknown[] } | undefined;
      if (pool === undefined || !isActive(world, slot)) continue;
      const fighter = fighterAt(world, slot);
      const { character, status } = fighter;
      const shown = pool.clips.flatMap((clip) => {
        const pose = poses.get(clip);
        return pose !== undefined && pose.z >= parkedBelow ? [pose] : [];
      });
      if (status.out) {
        if (shown.length > 0) problems.push(`slot ${slot} is out but shows ${shown.length} clips`);
        continue;
      }
      const pose = shown[0];
      if (pose === undefined || shown.length > 1) {
        problems.push(`slot ${slot} shows ${shown.length} clips`);
        continue;
      }
      seen.set(character, (seen.get(character) ?? 0) + 1);
      const fitted = { x: 0, z: 0 };
      fitFighterPlacement(fitted, fighter, s.game.stageChoice);
      const place = [s.origin.x + fitted.x, s.origin.y, s.origin.z + fitted.z];
      if (pose.x !== place[0] || pose.y !== place[1] || pose.z !== place[2]) problems.push(`slot ${slot} clip at ${pose.x} ${pose.y} ${pose.z}, fighter at ${place.join(" ")}`);
      if (pose.scale !== characterModelScale(character) || (pose.alpha !== 255 && pose.alpha !== 140)) problems.push(`slot ${slot} clip scale ${pose.scale} alpha ${pose.alpha}`);
      const mesh = MODEL_FACTS[pose.model];
      const whole = MODEL_FACTS[FIGHTER_OBJECTS[character].model];
      if (mesh === undefined || whole === undefined || mesh.geosets !== whole.geosets || mesh.triangles !== whole.triangles) {
        problems.push(`slot ${slot} clip ${pose.model} has ${mesh?.geosets} geosets and ${mesh?.triangles} triangles of ${whole?.geosets} and ${whole?.triangles}`);
      }
    }
  });
  return problems;
}

test("a match and its three-fighter rematch show each pooled fighter whole where he stands, read only correctable rollback rows, touch no parked effect and keep nothing between them", () => {
  const clients = headless.clients({ start: () => startBuild(PLAYABLE_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
  const host = clients.clients[0] as HeadlessClient;
  const lifetimes = countLifetimes(host);
  let parkedBelow = 0;
  const shownProblems: string[] = [];
  const shownFrames = new Map<Character, number>();
  const parked = parkedCallMeter(host, () => parkedBelow);
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
      parked.frameEnded();
      if (parked.on) shownProblems.push(...shownClipProblems(host, parkedBelow, shownFrames));
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
    clients.everywhere(() => {
      while (shell().game.stockCount > 1) panelActions().selection.changeStocks(1, -1);
    });
    clients.press(0, Key.y);
    until("stage menu", () => phase() === Phase.stageMenu, 30);
    helpers.workload = workload;
    clients.press(0, Key.y);
    until("match", () => phase() === Phase.match, 30);
    rowsRead.length = 0;
    corrections = 0;
    lifetimes.clear();
    parked.on = true;
    parked.calls = 0;
    until("a result", () => phase() !== Phase.match, 900);
    const played = { lifetimes: Object.fromEntries(lifetimes), rows: Math.max(...rowsRead), corrections, effectsAtResult: host.effectPoses().length };
    // The edit box keeps the keyboard until both helpers have stopped journaling the match.
    until("helpers quiescent", () => read(() => shell().rollback?.journal?.lifecycle?.quiescent() === true), 90);
    parked.on = false;
    for (const slot of [0, 1]) clients.press(slot, Key.n);
    until("fighter selection", () => phase() === Phase.characterMenu, 30);
    return { ...played, parkedCalls: parked.calls };
  };

  clients.start();
  frames(30);
  // hideEffect parks effects on the ground beneath the floor.
  parkedBelow = read(() => shell().origin.z - FLOOR_HEIGHT + 1.0);
  const window = read(() => shell().rollback?.window ?? 0);
  const first = play({ denseCycles: 1, walkers: [0] });
  const selectionAfterFirst = host.effectPoses().length;
  // The slot change of #26's rematch: slot C goes from EMPTY to a human fighter, then to a computer.
  for (let click = 0; click < 2; click++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  expect(read(() => [shell().game.humanFighterMask, shell().game.computerMask, shell().game.characterChoices[2]])).toEqual([3, 4, Character.demonHunter]);
  const rematch = play({ denseCycles: 1, walkers: [0, 1] });

  for (const played of [first, rematch]) {
    expect(played.corrections).toBeGreaterThan(5);
    // A reconcile reads the rows a correction may change, the authoritative row before them and the newest
    // row once more, never the whole 64-frame history.
    expect(played.rows).toBeLessThanOrEqual(window + 2);
    // From the match's first frame through its result, no call touches an effect that stays parked.
    expect(played.parkedCalls).toBe(0);
  }
  // Every match frame of both matches showed each pooled fighter in play once, whole, where he stands;
  // the rematch's computer Illidan among them.
  expect(shownProblems).toEqual([]);
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) expect(shownFrames.get(character) ?? 0).toBeGreaterThan(60);
  // Match frames create and destroy nothing; the result recreates the menu key triggers the match start removed.
  for (const played of [first, rematch]) expect(played.lifetimes).toEqual({ CreateTrigger: 2 });
  // At its result the rematch also holds the computer Illidan's clip pool, shield, projectiles and agency halo; fighter
  // selection ends every fighter's renderers, so it then holds exactly what it held after the first match.
  const illidan = originalClipCount(Character.demonHunter) + (originalLightPath(Character.demonHunter) === undefined ? 0 : 1);
  expect(rematch.effectsAtResult - first.effectsAtResult).toBe(illidan + 1 + PROJECTILE_CAPACITY + 1);
  expect(host.effectPoses().length).toBe(selectionAfterFirst);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  // Each client wrote its own player's record of both matches for the Smashcraft client: two fighters, then three.
  clients.clients.forEach((client, index) => {
    for (const [serial, fighters] of [[1, 2], [2, 3]] as const) {
      const record = client.files.get(matchRecordFile(serial)) ?? [];
      expect(record[0]).toStartWith(`smashcraft-match v=1 build=${PLAYABLE_BUILD.id} serial=${serial} local=P${index + 1} mode=versus`);
      expect(record.filter(line => line.startsWith("fighter ")).length).toBe(fighters);
      expect(record[record.length - 1]).toBe(`end lines=${record.length - 1}`);
    }
  });
});
