import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { stageScenery } from "../src/game/presentation/stageScenery";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { drawStageScenery, preloadStageAssets, showBackdrop } from "../src/platform/shell/stageScenery";
import { visibilityProblems } from "wisp/scripts/wisp/visibility";
import { reportedModel } from "wisp/src/runtime/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { STAGE_SNOW_MODEL } from "../src/game/assets/stageAssetInfo";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("Nordrassil draws its mist below the deck under its own sky, restores it after a mask, and a stage without mist clears it [spec #294]", () => {
  const clients = headless.clients({ start, install });
  clients.start(); clients.frames(30);
  const client = clients.client(0);
  client.run(() => {
    const s = shell();
    s.game.stageChoice = 10;
    const before = client.log.length;
    drawStageScenery(s);
    const fog = client.log.slice(before).find(call => call.name === "SetTerrainFogExV");
    const mist = stageScenery(10).heightFog;
    if (fog === undefined || mist === undefined) throw new Error("Nordrassil draws no mist");
    expect(Number(fog.args[5])).toBeLessThan(s.origin.z);
    expect(client.log.slice(before).filter(call => call.name === "BlzSetTerrainFogDrawOverSky").at(-1)?.args).toEqual([mist.drawOverSky]);
    expect(client.log.slice(before).find(call => call.name === "SetSkyModel")?.args).toEqual([stageScenery(10).sky]);
    showBackdrop(s, false);
    const restore = client.log.length;
    showBackdrop(s, true);
    expect(client.log.slice(restore).find(call => call.name === "SetTerrainFogExV")?.args).toEqual(fog?.args);
    s.game.stageChoice = 0;
    const reset = client.log.length;
    drawStageScenery(s);
    expect(client.log.slice(reset).some(call => call.name === "SetTerrainFogExV")).toBe(false);
    expect(client.log.slice(reset).find(call => call.name === "BlzSetTerrainFogMaxLinearDensity")?.args).toEqual([1]);
    expect(client.log.slice(reset).find(call => call.name === "BlzSetTerrainFogDrawOverSky")?.args).toEqual([false]);
  });
});

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

test("contrast masking hides Frozen snow from every arena camera and restores every authored pose [repro #287]", () => {
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
    const snowIndex = stageScenery(2).pieces.findIndex(piece => piece.model === STAGE_SNOW_MODEL);
    const snow = effects[snowIndex];
    if (snow === undefined || SMASHCRAFT_SCENE.visibility === undefined) throw new Error("missing Frozen snow visibility");
    const problems = visibilityProblems({
      serial: 1, frame: 1, effects: 1,
      models: [{ model: reportedModel(STAGE_SNOW_MODEL), live: 1, inView: 0, drawn: 0, longest: 0, destroyed: 0 }],
    }, [{ name: "stage snow", models: [STAGE_SNOW_MODEL] }], {
      ...SMASHCRAFT_SCENE.visibility,
      parking: [[0, 0, BlzGetLocalSpecialEffectZ(snow) - s.origin.z]],
    });
    expect(problems).toEqual([]);
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
    expect(client.log.slice(before).some(call => call.name === "SetDayNightModels")).toBe(false);
  }
});
