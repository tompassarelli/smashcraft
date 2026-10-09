import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { FLOOR_HEIGHT } from "../src/game/presentation/arenaCamera";
import { stageScenery } from "../src/game/presentation/stageScenery";
import { start, install } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { drawStageScenery, preloadStageAssets, showBackdrop } from "../src/platform/shell/stageScenery";
import { STAGE_LIGHTS } from "../src/game/assets/stageLighting";
import { pointLightPieces } from "../src/game/presentation/stageScenery";
import { POST_PROCESSING } from "../scripts/postProcessing";
import { TOMB_WATERFALL_IMPORTS } from "../scripts/wisp/mapInputs";
import { Phase } from "../src/game/match/rules";
import { visibilityProblems } from "wisp/scripts/wisp/visibility";
import { reportedModel } from "wisp/src/runtime/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { STAGE_SNOW_MODEL } from "../src/game/assets/stageAssetInfo";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

test("quick stage applies capture look before the first match picture without later chat [repro wisp#79]", () => {
  for (const command of ["-dev quick stage 2 lighting stock backdrop off view near", "-dev quick"]) {
    const clients = headless.clients({ start, install });
    clients.start(); clients.frames(30);
    const client = clients.client(0);
    const before = client.log.length;
    let firstPicture = -1;
    const camera = client.natives.SetCameraField as (...args: unknown[]) => void;
    client.natives.SetCameraField = (...args: unknown[]) => {
      if (firstPicture < 0) firstPicture = client.log.length - before;
      camera(...args);
    };
    clients.chat(0, command);
    client.run(() => {
      const s = shell();
      expect(s.game.phase).toBe(Phase.match);
      expect(s.runtime.simulationFrame).toBe(0);
      expect(s.game.stageChoice).toBe(command === "-dev quick" ? 0 : 2);
      expect(s.viewExtreme).toBe(command === "-dev quick" ? undefined : "near");
      const calls = client.log.slice(before);
      const lighting = calls.filter(call => call.name === "SetDayNightModels").at(-1);
      expect(String(lighting?.args[1]).includes(command === "-dev quick" ? "StageLight-" : "DNCLordaeronUnit")).toBe(true);
      if (command !== "-dev quick") {
        expect(calls.find(call => call.name === "BlzShowSkyBox")?.args).toEqual([false]);

      }
    });
    clients.frames(1);
    if (command !== "-dev quick") {
      const look = client.log.slice(before).findIndex(call => call.name === "BlzShowSkyBox");
      expect(firstPicture).toBeGreaterThan(look);
    }
    expect(client.errors).toEqual([]);
  }
});

test("quick stage fog off clears Tomb's fog before the first match picture and keeps its sky [spec #298]", () => {
  const clients = headless.clients({ start, install });
  clients.start(); clients.frames(30);
  const client = clients.client(0);
  const before = client.log.length;
  clients.chat(0, "-dev quick stage 7 lighting stage backdrop on view far fog off");
  client.run(() => {
    const s = shell();
    expect(s.game.stageChoice).toBe(7);
    expect(s.runtime.simulationFrame).toBe(0);
    const calls = client.log.slice(before);
    expect(calls.filter(call => call.name === "BlzShowSkyBox").at(-1)?.args).toEqual([true]);
    const fogs = calls.filter(call => call.name === "SetTerrainFogEx" || call.name === "SetTerrainFogExV");
    expect(fogs.at(-1)?.args.slice(0, 3)).toEqual([0, 100000, 200000]);
  });
  expect(client.errors).toEqual([]);
});

test("Tomb draws teal fog below its tide floor and replaces mist only in HD modes [spec #298]", () => {
  const clients = headless.clients({ start, install });
  clients.start(); clients.frames(30);
  const client = clients.client(0);
  client.run(() => {
    const s = shell();
    s.game.stageChoice = 7;
    const before = client.log.length;
    drawStageScenery(s);
    expect(client.log.slice(before).find(call => call.name === "SetTerrainFogExV")?.args).toEqual([3, 5000, 11000, 0.25, s.origin.z - 1800, s.origin.z - 100, 5000, 11000, 0.25, 0.4375, 0.46875]);
    expect(client.log.slice(before).filter(call => call.name === "BlzSetTerrainFogMaxLinearDensity").at(-1)?.args).toEqual([0.375]);
    expect(client.log.slice(before).filter(call => call.name === "BlzSetTerrainFogDrawOverSky").at(-1)?.args).toEqual([false]);
    const waterfall = stageScenery(7).pieces.find(piece => piece.model.includes("Waterfall"));
    expect(waterfall?.model).toBe("Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx");
    expect(waterfall?.x).toBeLessThan(0);
    expect(TOMB_WATERFALL_IMPORTS).toEqual([
      { entry: "_hd.w3mod\\Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", file: "TombWaterfallHD.mdx" },
      { entry: "_de.w3mod\\Doodads\\Terrain\\CliffDoodad\\Waterfall\\Waterfall.mdx", file: "TombWaterfallDE.mdx" },
    ]);
  });
});

test("Nordrassil draws teal mist below the deck, preserves its aurora and restores fog after a mask [spec #294]", () => {
  const clients = headless.clients({ start, install });
  clients.start(); clients.frames(30);
  const client = clients.client(0);
  client.run(() => {
    const s = shell();
    s.game.stageChoice = 10;
    const before = client.log.length;
    drawStageScenery(s);
    const fog = client.log.slice(before).find(call => call.name === "SetTerrainFogExV");
    expect(fog?.args).toEqual([3, 5500, 11000, 0.25, s.origin.z - 2600, s.origin.z - 600, 5500, 11000, 0.25, 0.5, 0.375]);
    expect(client.log.slice(before).find(call => call.name === "SetTerrainFogEx")?.args).toEqual([0, 5500, 11000, 0, 0.25, 0.5, 0.375]);
    expect(client.log.slice(before).filter(call => call.name === "BlzSetTerrainFogMaxLinearDensity").at(-1)?.args).toEqual([0.5]);
    expect(client.log.slice(before).filter(call => call.name === "BlzSetTerrainFogDrawOverSky").at(-1)?.args).toEqual([false]);
    expect(client.log.slice(before).find(call => call.name === "SetSkyModel")?.args).toEqual(["Environment\\Sky\\FelwoodSky\\FelwoodSky.mdl"]);
    expect(stageScenery(10).pieces.filter(piece => piece.model.includes("MoonWell"))).toHaveLength(2);
    expect(pointLightPieces(10)).toHaveLength(0);
    expect(STAGE_LIGHTS.find(entry => entry.stage === 10)?.light).toEqual({ key: [236, 246, 232], ambient: [136, 178, 172] });
    expect(POST_PROCESSING.Bloom).toEqual({ Enabled: "1", BloomThreshold: "0.900000" });
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
    const light = client.log.slice(before).find(call => call.name === "SetDayNightModels");
    expect(light).toBeDefined();
    expect(String(light?.args[1]).includes(mode === "stock" ? "DNCLordaeronUnit" : "StageLight-")).toBe(true);
  }
});
