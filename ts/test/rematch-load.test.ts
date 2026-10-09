






import { afterAll, expect } from "bun:test";
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
import { fighterRenderedCues } from "../src/game/presentation/attackCues";
import { DEFINITIVE_CUE_EMITTERS } from "../src/game/presentation/cueEmitterInfo";
import { HIT_AREA_EFFECT_CAPACITY } from "../src/game/render/hitAreaEffects";
import { fighterAt, isActive } from "../src/game/sim/roster";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { matchRecordFile } from "../src/runtime/gameFiles";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { activeRollback, shell } from "../src/platform/shell/state";
import { views } from "../src/platform/shell/ui";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { JournalHelpers, type Workload } from "./rematch/journalHelper";
import { sweep } from "./sweep";

const declarations = readNativeDeclarations();

const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this test counts the calls it checks"]));
const helpers = new JournalHelpers(INTEGRITY_BUILD.id);
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged }, declarations);
afterAll(headless.restore);


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


const LIFETIMES = ["AddSpecialEffect", "AddSpecialEffectTarget", "DestroyEffect", "CreateTimer", "DestroyTimer", "CreateTrigger", "DestroyTrigger"];


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


const POSED = ["BlzSetSpecialEffectPosition", "BlzSetSpecialEffectX", "BlzSetSpecialEffectY", "BlzSetSpecialEffectZ", "BlzSetSpecialEffectAlpha", "BlzSetSpecialEffectScale", "BlzSetSpecialEffectTimeScale", "BlzSetSpecialEffectMatrixScale", "BlzResetSpecialEffectMatrix"];







function parkedCallMeter(client: HeadlessClient, parkedBelow: () => number) {
  const poses = (client as unknown as { effects: Map<unknown, EffectPose> }).effects;
  const describe = (pose: EffectPose) => `${pose.x} ${pose.y} ${pose.z} ${pose.alpha} ${pose.scale} ${pose.timeScale} ${pose.flat}`;

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
      // Warcraft stores effect coordinates as binary32.
      const place = [s.origin.x + fitted.x, s.origin.y, s.origin.z + fitted.z].map(Math.fround);
      if (pose.x !== place[0] || pose.y !== place[1] || pose.z !== place[2]) problems.push(`slot ${slot} clip at ${pose.x} ${pose.y} ${pose.z}, fighter at ${place.join(" ")}`);
      if (pose.scale !== characterModelScale(character) || (pose.alpha !== 255 && pose.alpha !== 140)) problems.push(`slot ${slot} clip scale ${pose.scale} alpha ${pose.alpha}`);
      if (pose.teamColor !== slot) problems.push(`slot ${slot} clip wears player ${pose.teamColor}'s colour`);
      const mesh = MODEL_FACTS[pose.model];
      const whole = MODEL_FACTS[FIGHTER_OBJECTS[character].model];
      if (mesh === undefined || whole === undefined || mesh.geosets !== whole.geosets || mesh.triangles !== whole.triangles) {
        problems.push(`slot ${slot} clip ${pose.model} has ${mesh?.geosets} geosets and ${mesh?.triangles} triangles of ${whole?.geosets} and ${whole?.triangles}`);
      }
    }
  });
  return problems;
}


sweep("a match and its three-fighter rematch show each pooled fighter whole where he stands, read only correctable rollback rows, touch no parked effect and keep nothing between them [repro #242]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
  const host = clients.clients[0] as HeadlessClient;
  // Warcraft retains destroyed models for five game seconds (native wisp#59); count undestroyed effects.

  const retainedEffects = () => host.effectPoses().filter(pose => pose.destroyed === undefined).length;
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

  const play = (workload: Workload) => {
    for (const slot of [0, 1]) clients.press(slot, Key.n);
    frames(5);
    clients.everywhere(() => {
      while (shell().game.stockCount > 1) panelActions().selection.changeStocks(1, -1);
    });
    clients.press(0, Key.y);
    until("stage menu", () => phase() === Phase.stageMenu, 30);

    clients.everywhere(() => panelActions().stage.selectStage(0, 2));
    helpers.workload = workload;
    clients.press(0, Key.y);
    until("match", () => phase() === Phase.match, 120);
    rowsRead.length = 0;
    corrections = 0;
    lifetimes.clear();
    parked.on = true;
    parked.calls = 0;
    until("a result", () => phase() !== Phase.match, 900);
    const played = { lifetimes: Object.fromEntries(lifetimes), rows: Math.max(...rowsRead), corrections, effectsAtResult: retainedEffects() };

    until("helpers quiescent", () => read(() => shell().rollback?.journal?.lifecycle?.quiescent() === true), 90);
    parked.on = false;
    for (const slot of [0, 1]) clients.press(slot, Key.n);
    until("fighter selection", () => phase() === Phase.characterMenu, 30);
    return { ...played, parkedCalls: parked.calls };
  };

  clients.start();
  frames(30);

  parkedBelow = read(() => shell().origin.z - FLOOR_HEIGHT + 1.0);
  const window = read(() => shell().rollback?.window ?? 0);
  const first = play({ denseCycles: 1, walkers: [0] });
  const selectionAfterFirst = retainedEffects();

  for (let click = 0; click < 2; click++) clients.everywhere(() => panelActions().selection.cycleMode(0, 2));
  clients.everywhere(() => panelActions().selection.selectCpuChoice(0, 2, Character.demonHunter));
  expect(read(() => [shell().game.humanFighterMask, shell().game.computerMask, shell().game.characterChoices[2]])).toEqual([3, 4, Character.demonHunter]);
  const rematch = play({ denseCycles: 1, walkers: [0, 1] });

  for (const played of [first, rematch]) {
    expect(played.corrections).toBeGreaterThan(5);


    expect(played.rows).toBeLessThanOrEqual(window + 2);

    expect(played.parkedCalls).toBe(0);
  }


  expect(shownProblems).toEqual([]);
  for (const character of [Character.demonHunter, Character.rifleman, Character.demonHunter]) expect(shownFrames.get(character) ?? 0).toBeGreaterThan(60);

  for (const played of [first, rematch]) expect(played.lifetimes).toEqual({ CreateTrigger: 2 });


  const illidan = originalClipCount(Character.demonHunter) + (originalLightPath(Character.demonHunter) === undefined ? 0 : 1);
  const pooledCues = fighterRenderedCues(Character.demonHunter).filter(cue => DEFINITIVE_CUE_EMITTERS[cue.model] !== true).length;
  expect(rematch.effectsAtResult - first.effectsAtResult).toBe(illidan + 1 + PROJECTILE_CAPACITY + pooledCues + HIT_AREA_EFFECT_CAPACITY + 3);
  expect(retainedEffects()).toBe(selectionAfterFirst);
  for (const client of clients.clients) expect(client.errors).toEqual([]);

  clients.clients.forEach((client, index) => {
    for (const [serial, fighters] of [[1, 2], [2, 3]] as const) {
      const record = client.files.get(matchRecordFile(serial)) ?? [];
      expect(record[0]).toStartWith(`smashcraft-match v=1 build=${INTEGRITY_BUILD.id} serial=${serial} local=P${index + 1} mode=versus`);
      expect(record.filter(line => line.startsWith("fighter ")).length).toBe(fighters);
      expect(record[record.length - 1]).toBe(`end lines=${record.length - 1}`);
    }
  });
}, 30_000);
