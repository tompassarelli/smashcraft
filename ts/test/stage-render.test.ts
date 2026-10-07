import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { stageLightModel, stageScenery } from "../src/game/presentation/stageScenery";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { drawStageScenery, showBackdrop } from "../src/platform/shell/stageScenery";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("each stage applies its light, sky and fog beyond the fighters", () => {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  client.run(() => {
    for (const { id, name } of STAGE_CATALOG) {
      const s = shell();
      s.game.stageChoice = id;
      const before = client.log.length;
      drawStageScenery(s);
      const calls = client.log.slice(before);
      expect(calls.find(({ name }) => name === "SetDayNightModels")?.args).toEqual([stageLightModel(id), stageLightModel(id)]);
      expect(calls.find(({ name }) => name === "SetSkyModel")?.args).toEqual([stageScenery(id).sky]);
      const fog = stageScenery(id).fog;
      if (fog === undefined) throw new Error(`${name}: no atmosphere profile`);
      expect(fog.start).toBeGreaterThanOrEqual(5000);
      expect(fog.end).toBeGreaterThan(fog.start);
      expect(calls.find(({ name }) => name === "SetTerrainFogEx")?.args).toEqual([0, fog.start, fog.end, 0, fog.red, fog.green, fog.blue]);
    }
  });
});

test("contrast masking parks particle scenery and restores every authored pose", () => {
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
