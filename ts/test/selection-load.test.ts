// Native work per frame of the playable entry on two simulated clients, from
// fighter selection through match start. Warcraft runs everything a callback
// asks for before it draws, so these counts bound a frame's native cost: the
// 0.0.45 candidate stalled at selection on 32 file lookups a second, and the
// pooled fighter clips are hundreds of effects created on one frame.
import { value } from "./rematch/playableMatch";
import { afterAll, expect, test } from "bun:test";
import { originalClip, originalClipCount, originalLightPath } from "../src/game/assets/fighterOriginalClipInfo";
import { Phase } from "../src/game/match/rules";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { Character } from "../src/game/sim/codes";
import { PROJECTILE_CAPACITY } from "../src/game/sim/fighter";
import { fighterRenderedCues } from "../src/game/presentation/attackCues";
import { DEFINITIVE_CUE_EMITTERS } from "../src/game/presentation/cueEmitterInfo";
import { HIT_AREA_EFFECT_CAPACITY } from "../src/game/render/hitAreaEffects";
import { stageModels } from "../src/game/presentation/stagePreload";
import { install, startBuild } from "../src/platform/main";
import { Key } from "../src/platform/shell/keyEvents";
import { panelActions } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { installHeadless } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const CHARACTERS = Object.values(Character);
const poolEffects = (character: Character) => originalClipCount(character) + (originalLightPath(character) === undefined ? 0 : 1);
const POOL_MODELS: ReadonlySet<string> = new Set(CHARACTERS.flatMap((character) => {
  const clips = Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index)?.modelPath ?? "");
  const light = originalLightPath(character);
  return light === undefined ? clips : [...clips, light];
}));

interface Work {
  /** AddSpecialEffect calls. */
  created: number;
  /** Clip and light effects created. */
  poolCreated: number;
  /** Pooled clip and light effects any BlzSetSpecialEffect* call changed. */
  poolChanged: number;
  /** Preloader calls: file lookups, each a read of its whole folder under Wine when the file is missing. */
  fileReads: number;
}

/** Measures `client`'s native work during each `act`. */
function workMeter(client: HeadlessClient): (act: () => void) => Work {
  const pooled = new Set<unknown>();
  let poolCreated = 0;
  let fileReads = 0;
  const preloader = client.natives.Preloader as (path: string) => unknown;
  client.natives.Preloader = (path: string) => {
    fileReads++;
    return preloader(path);
  };
  const add = client.natives.AddSpecialEffect as (model: string, x: number, y: number) => unknown;
  client.natives.AddSpecialEffect = (model: string, x: number, y: number) => {
    const effect = add(model, x, y);
    if (POOL_MODELS.has(model)) {
      pooled.add(effect);
      poolCreated++;
    }
    return effect;
  };
  return (act) => {
    const calls = client.log.length;
    const readsBefore = fileReads;
    const poolBefore = poolCreated;
    act();
    const named = client.log.slice(calls);
    const changed = new Set(named.filter(({ name, args }) => name.startsWith("BlzSetSpecialEffect") && pooled.has(args[0])).map(({ args }) => args[0]));
    return {
      created: named.filter(({ name }) => name === "AddSpecialEffect").length,
      poolCreated: poolCreated - poolBefore,
      poolChanged: changed.size,
      fileReads: fileReads - readsBefore,
    };
  };
}

test("playable: selection creates no effect and reads no file; match start creates each fighter's clip pool once [provisional]", () => {
  const clients = headless.clients({ install, start: () => startBuild(PLAYABLE_BUILD) });
  const host = clients.clients[0];
  if (host === undefined) throw new Error("missing host client");
  const work = workMeter(host);
  clients.start();
  // The first callback creates the shared panels and effect pools.
  clients.frames(1);
  const selection: Work[] = [];
  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame++) selection.push(work(() => clients.frames(1)));
  };
  frames(30);
  // Both humans move to Illidan and select; the host adds two computer Illidans.
  selection.push(work(() => clients.press(1, Key.w)));
  for (const [slot, presses] of [[0, 1], [1, 1]] as const) {
    for (let press = 0; press < presses; press++) selection.push(work(() => clients.press(slot, Key.r)));
    selection.push(work(() => clients.press(slot, Key.n)));
  }
  selection.push(work(() => clients.everywhere(() => {
    const { selection: actions } = panelActions();
    for (const computer of [2, 3]) {
      actions.cycleMode(0, computer);
      actions.cycleMode(0, computer);
      actions.selectCpuChoice(0, computer, Character.demonHunter);
    }
  })));
  frames(30);
  selection.push(work(() => clients.press(0, Key.y)));
  frames(30);
  host.run(() => {
    expect(shell().game.phase).toBe(Phase.stageMenu);
    expect(shell().game.characterChoices).toEqual([Character.demonHunter, Character.demonHunter, Character.demonHunter, Character.demonHunter]);
  });
  expect(selection.filter(({ created, fileReads }) => created > 0 || fileReads > 0)).toEqual([]);

  // The press draws the stage behind its loading screen; the match starts once every client has reported it.
  const loading = work(() => clients.press(0, Key.y));
  expect(loading.fileReads).toBe(0);
  let loadingCreated = loading.created;
  let start = work(() => clients.frames(1));
  for (let frame = 0; frame < 120 && value(host, () => shell().game.phase) !== Phase.match; frame++) {
    loadingCreated += start.created;
    start = work(() => clients.frames(1));
  }
  let stage = 0;
  host.run(() => {
    const s = shell();
    expect(s.game.phase).toBe(Phase.match);
    expect(s.participants.map(({ pooled }) => pooled)).toEqual([true, true, true, true]);
    stage = s.game.stageChoice;
  });
  // Stage handles are prepared once under the cover, then retained at match start.
  expect(loadingCreated).toBe(stageModels(stage).length);
  // Popcorn cues are born on confirmed casts; the debug marker is pooled with the fighter.
  expect(HIT_AREA_EFFECT_CAPACITY).toBe(12);
  expect(start.poolCreated).toBe(4 * poolEffects(Character.demonHunter));
  const pooledCues = fighterRenderedCues(Character.demonHunter).filter(cue => DEFINITIVE_CUE_EMITTERS[cue.model] !== true).length;
  expect(start.created).toBe(start.poolCreated + 4 * (1 + PROJECTILE_CAPACITY + pooledCues + HIT_AREA_EFFECT_CAPACITY + 3));
  expect(start.fileReads).toBe(0);

  const match: Work[] = [];
  for (let frame = 0; frame < 60; frame++) match.push(work(() => clients.frames(1)));
  expect(match.filter(({ created, fileReads }) => created > 0 || fileReads > 0)).toEqual([]);
  // A frame changes each fighter's shown clip, the clip it replaced and the light, never the hidden rest.
  expect(Math.max(...match.map(({ poolChanged }) => poolChanged))).toBeLessThanOrEqual(4 * 3);
  expect(host.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
});
