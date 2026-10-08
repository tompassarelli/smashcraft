import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { stageScenery } from "../src/game/presentation/stageScenery";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { drawStageScenery, preloadStageAssets, showBackdrop } from "../src/platform/shell/stageScenery";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("stage preloads and replaced landmarks are parked below the arena before their death sequences start [provisional]", () => {
  const clients = headless.clients({ start, install });
  clients.start(); clients.frames(30);
  const client = clients.client(0);
  client.run(() => {
    const s = shell();
    const destroy = client.natives.DestroyEffect as (model: effect) => void;
    const retired: effect[] = [];
    client.natives.DestroyEffect = (model: effect) => {
      expect(BlzGetLocalSpecialEffectZ(model)).toBeLessThanOrEqual(s.origin.z - FLOOR_HEIGHT - 4096);
      retired.push(model);
      destroy(model);
    };
    try {
      preloadStageAssets(s);
      for (const stage of [10, 11, 13]) {
        s.game.stageChoice = stage;
        drawStageScenery(s);
      }
      expect(retired.length).toBeGreaterThan(10);
    } finally {
      client.natives.DestroyEffect = destroy;
    }
  });
});

test("contrast masking parks particle scenery and restores every authored pose [invariant]", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  clients.chat(0, "-dev quick stage 2");
  clients.frames(1);
  client.run(() => {
    const s = shell();
    const effects = s.stageScenery ?? [];
    expect(effects.length).toBeGreaterThan(0);
    const before = client.log.length;
    showBackdrop(s, false);
    for (const effect of effects) {
      expect(client.log.slice(before).some(call => call.name === "BlzSetSpecialEffectPosition" && call.args[0] === effect && Number(call.args[3]) <= s.origin.z - FLOOR_HEIGHT - 4096)).toBe(true);
    }
    const restore = client.log.length;
    showBackdrop(s, true);
    for (const [index, effect] of effects.entries()) {
      const piece = stageScenery(2).pieces[index];
      if (piece === undefined) throw new Error("missing piece");
      expect(client.log.slice(restore).some(call => call.name === "BlzSetSpecialEffectPosition" && call.args[0] === effect && call.args[3] === s.origin.z + piece.z)).toBe(true);
      expect(client.log.slice(restore).some(call => call.name === "BlzSetSpecialEffectScale" && call.args[0] === effect && call.args[1] === piece.scale)).toBe(true);
    }
  });
  for (const mode of ["stock", "stage"]) {
    const before = client.log.length;
    clients.chat(0, `-dev lighting ${mode}`);
    const light = client.log.slice(before).find(call => call.name === "SetDayNightModels");
    expect(light).toBeDefined();
    expect(String(light?.args[1]).includes(mode === "stock" ? "DNCLordaeronUnit" : "StageLight-")).toBe(true);
  }
});
