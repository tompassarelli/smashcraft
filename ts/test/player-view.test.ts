


import { STAGE_LAVA_MODEL } from "../src/game/assets/terrainAssetInfo";
import { afterAll, expect, test } from "bun:test";
import { trampoline } from "wisp/src/platform/dispatch";
import { reportedModel, sceneFile } from "wisp/src/runtime/scene";
import { type SceneReport, readSceneLines, sceneProblems } from "wisp/scripts/wisp/scene";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";
import { IMPACT_HIT_MODEL } from "../src/game/assets/impactAssetInfo";
import { impactModel } from "../src/game/presentation/hitPresentation";
import { Action, bit } from "../src/game/input/actions";
import { requestStageSelect, requestStart, selectCharacter, selectStage, setParticipants } from "../src/game/match/rules";
import { ARENA_CAMERA, FLOOR_HEIGHT, PLAYABLE_BOUNDS, extremeCamera } from "../src/game/presentation/arenaCamera";
import { CANNON_MODEL, WIND_STREAK_COUNT, WIND_STREAK_MODEL } from "../src/game/presentation/stageHazards";
import { deckModel } from "../src/game/presentation/stagePreload";
import { platformParts } from "../src/game/presentation/stockPlatforms";
import { STAGE_DECK_MODELS } from "../src/game/assets/stageAssetInfo";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { hiddenBelow, placedPieces, stageScenery } from "../src/game/presentation/stageScenery";
import { STOCK_MODELS } from "../src/game/render/effects";
import { IMPACT_DUST, IMPACTS_PER_KIND, advanceImpacts, createImpactState, emitImpacts, impactLifetime } from "../src/game/presentation/impactState";
import { CombatEffects } from "../src/game/render/combatEffects";
import { createImpactEvents } from "../src/game/presentation/impactEvents";
import { Character, DownState, SurfaceContact } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, FROZEN_THRONE_STAGE, TIMED_TEST_STAGE, WIND_TEST_STAGE, DRIFTING_DECK_STAGE, PATTERNED_DECKS_STAGE, MAIN_DECK_BODY_SURFACES, MAIN_DECK_UNDERSIDE_Z, solidSurfaceAt, surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { stageBounds } from "../src/game/sim/stageBounds";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "../src/game/sim/knockback";
import { advanceMatchCamera, createMatchCamera } from "../src/game/sim/matchCamera";
import { initializeScenario } from "../src/game/shell/scenarios";
import { BODY_HALF_WIDTH, bodyTop } from "../src/game/sim/surfaces";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../src/game/sim/tuning";
import { install as installDevelopment, start as startDevelopment } from "../src/platform/devMain";
import { startMatch } from "../src/platform/shell/matchStart";
import { startQuickMatch } from "../src/platform/shell/menus";
import { shell } from "../src/platform/shell/state";
import { drawStage, lockArenaCamera, renderPersistentPresentation, renderUi } from "../src/platform/shell/view";
import { drawStageScenery } from "../src/platform/shell/stageScenery";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { MAIN_DECK_HALF_DEPTH } from "../scripts/stageDeck";
import { CameraFindings } from "./cameraFindings";
import { STAND_BOUNDS, TEMPLE_OF_TIDES, behindProblems, floatingProblems, insideWorld } from "../scripts/stageViewRules";
import { groundProblems, landmarkProblems } from "../src/game/presentation/stageRules";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";


const declarations = readNativeDeclarations();
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this file compares no calls"]));

interface SetCamera {
  readonly fields: Map<string, number>;
  x: number;
  y: number;
}
const cameras = new Map<HeadlessClient, SetCamera>();
const aspects = new Map<HeadlessClient, number>();
const recordCamera = (client: HeadlessClient) => {
  const camera: SetCamera = { fields: new Map(), x: 0, y: 0 };
  cameras.set(client, camera);
  return {
    BlzGetLocalClientWidth: () => (aspects.get(client) ?? 16 / 9) * 1080,
    SetCameraField: (field: string, value: number) => void camera.fields.set(field, value),
    SetCameraPosition: (x: number, y: number) => {
      camera.x = x;
      camera.y = y;
    },
  };
};
const headless = installHeadless({ ...SMASHCRAFT_HEADLESS, localNatives: unlogged, natives: recordCamera }, declarations);
const seconds = (value: number) => value * SMASHCRAFT_SCENE.framesPerSecond;
afterAll(headless.restore);

test("Durotar: turning the backdrop off and on twice leaves every scenery piece at its authored stretch [repro wisp#40]", () => {
  // Warcraft multiplies matrix scales, so stretching without resetting stacks the scale.
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick stage 3");
  clients.frames(5);
  const client = clients.client(0);
  const stretches = () => client.effectPoses().filter(({ model }) => model.includes("Barrens_Rocks")).map(({ matrixScale }) => matrixScale[2]);
  const authored = stretches();
  expect(authored.filter(stretch => stretch > 1).length).toBeGreaterThan(0);
  for (let round = 0; round < 2; round++) {
    clients.chat(0, "-dev backdrop off"); clients.frames(1);
    clients.chat(0, "-dev backdrop on"); clients.frames(1);
  }
  expect(stretches()).toEqual(authored);
  expect(client.errors).toEqual([]);
});

test("Tomb's close Temple of Tides occupies a visible quarter of match height on the right third at both camera extremes and client widths [spec #360]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick stage 7");
  const client = clients.client(0);
  const piece = stageScenery(7).pieces.find(({ model }) => model === TEMPLE_OF_TIDES);
  const drawn = STAND_BOUNDS[TEMPLE_OF_TIDES];
  if (piece === undefined || drawn === undefined) throw new Error("missing Tomb landmark");
  const turn = (piece.yaw * Math.PI) / 180;
  const corners = [drawn.min[0], drawn.max[0]].flatMap(x => [drawn.min[1], drawn.max[1]].flatMap(y => [drawn.min[2], drawn.max[2]].map(z => [
    piece.x + piece.scale * (x * Math.cos(turn) - y * Math.sin(turn)), piece.y + piece.scale * (x * Math.sin(turn) + y * Math.cos(turn)), piece.z + piece.scale * z,
  ] as const)));
  const tilt = (10 * Math.PI) / 180;
  for (const aspect of [16 / 9, 64 / 27]) for (const extreme of ["near", "far"] as const) {
    const camera = createMatchCamera();
    extremeCamera(camera, 7, aspect, extreme);
    const depth = (y: number, z: number) => camera.distance + y * Math.cos(tilt) - (z - camera.z) * Math.sin(tilt);
    const project = (x: number, y: number, z: number) => [
      0.5 + (x - camera.x) / (2 * depth(y, z) * camera.tangent * aspect),
      0.5 - (y * Math.sin(tilt) + (z - camera.z) * Math.cos(tilt)) / (2 * depth(y, z) * camera.tangent),
    ] as const;
    const rows: number[] = [];
    const columns: number[] = [];
    for (const [x, y, z] of corners) {
      expect(depth(y, z), extreme).toBeLessThan(ARENA_CAMERA.farZ);
      const [column, row] = project(x, y, z);
      expect(column, extreme).toBeGreaterThan(0);
      expect(column, extreme).toBeLessThan(1);
      columns.push(column);
      expect(row, extreme).toBeLessThan(1);
      rows.push(row);
    }
    // Tom's close-set-piece reference allows a cropped crown; platforms and ledges remain inside the frame.
    expect(Math.min(1, Math.max(...rows)) - Math.max(0, Math.min(...rows)), extreme).toBeGreaterThanOrEqual(0.25);
    const centre = corners.reduce((sum, [x, y, z]) => [sum[0] + x / 8, sum[1] + y / 8, sum[2] + z / 8], [0, 0, 0]);
    expect(project(centre[0], centre[1], centre[2])[0], extreme).toBeGreaterThan(0.5);
    expect(Math.min(...columns), extreme).toBeLessThan(2 / 3);
    expect(Math.max(...columns), extreme).toBeGreaterThan(2 / 3);
    aspects.set(client, aspect);
    clients.chat(0, `-dev view ${extreme}`);
    clients.frames(1);
    client.run(() => trampoline("scene.report")());
    const temple = sceneReport(client).models.find(({ model }) => model === reportedModel(TEMPLE_OF_TIDES));
    expect(temple, extreme).toMatchObject({ live: 1, inView: 1, drawn: 1 });
  }
  expect(client.errors).toEqual([]);
});

test("every stage's scenery and the fighting plane stand inside Warcraft's world bounds, outside which no effect draws [repro #298]", () => {

  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  const outside: string[] = [];
  client.run(() => {
    const s = shell();

    const inside = insideWorld;
    if (!inside(s.origin.x, s.origin.y - MAIN_DECK_HALF_DEPTH)) outside.push("the deck's front edge");
    for (const stage of STAGE_CATALOG) {
      s.game.stageChoice = stage.id;
      drawStageScenery(s);
      const pieces = placedPieces(stage.id);
      for (const [index, effect] of (s.stageScenery ?? []).entries()) {
        if (!inside(BlzGetLocalSpecialEffectX(effect), BlzGetLocalSpecialEffectY(effect))) outside.push(`${stage.name}: ${pieces[index]?.model}`);
      }
    }
  });
  expect(outside).toEqual([]);
  expect(client.errors).toEqual([]);
});

// Warcraft constrains units to playable bounds, which must contain the blast zones.
const BLAST_MARGIN = 512.0;
for (const { id: stage, name } of STAGE_CATALOG) test(`${name}: every blast zone lies ${BLAST_MARGIN} inside the playable bounds, and a fighter launched past each one is KO'd [repro #298]`, () => {

  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0, 1]);
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  const { blast } = stageBounds(stage);
  const sides = [
    { side: "left", x: blast.left - 10.0, z: 0.0, vx: -20.0, vz: 0.0 },
    { side: "right", x: blast.right + 10.0, z: 0.0, vx: 20.0, vz: 0.0 },
    { side: "bottom", x: 0.0, z: blast.bottom - 10.0, vx: 0.0, vz: -20.0 },
    { side: "top", x: 0.0, z: blast.top + 10.0, vx: 0.0, vz: 20.0 },
  ] as const;
  const stocks: string[] = [];
  client.run(() => {
    const s = shell();

    const y = s.origin.y + PLAYABLE_BOUNDS.centreY;
    expect(s.origin.x + blast.left - BLAST_MARGIN).toBeGreaterThanOrEqual(PLAYABLE_BOUNDS.left);
    expect(s.origin.x + blast.right + BLAST_MARGIN).toBeLessThanOrEqual(PLAYABLE_BOUNDS.right);
    expect(y - MAIN_DECK_HALF_DEPTH - BLAST_MARGIN).toBeGreaterThanOrEqual(PLAYABLE_BOUNDS.front);
    expect(y + MAIN_DECK_HALF_DEPTH + BLAST_MARGIN).toBeLessThanOrEqual(PLAYABLE_BOUNDS.back);
    startQuickMatch(s, stage, s.build.scenario, undefined, sides.length + 1);
  });
  for (const { side, x, z, vx, vz } of sides) {
    let before = 0;
    client.run(() => {
      const fighter = fighterAt(shell().world, 0);
      before = fighter.status.stocks;
      fighter.motion.grounded = false;
      fighter.motion.x = x;
      fighter.motion.z = z;
      fighter.motion.vx = vx;
      fighter.motion.vz = vz;
      fighter.launch.knockbackZ = vz > 0 ? 2.0 * TOP_KO_MINIMUM_UPWARD_KNOCKBACK : 0.0;
    });
    clients.frames(2);
    client.run(() => stocks.push(`${side}: ${before - fighterAt(shell().world, 0).status.stocks}`));

    clients.frames(160);
  }
  expect(stocks).toEqual(sides.map(({ side }) => `${side}: 1`));
  expect(client.errors).toEqual([]);
});

test("every stage's scenery stays behind fighters, and fog starts beyond the fight in every declared camera [provisional]", () => {
  const problems = STAGE_CATALOG.flatMap(stage => [...behindProblems(stage.id, stage.name, stageScenery(stage.id))]);
  expect(problems).toEqual([]);
});

test("no stage shows a scenery piece's base below the deck at either camera extreme: the stage floats [spec docs/design/stage-art.md]", () => {
  const problems = STAGE_CATALOG.flatMap(stage => [...floatingProblems(stage.id, stage.name, stageScenery(stage.id).pieces)]);
  expect(problems).toEqual([]);
});

test("no stage's scenery prop crosses its landmark, and every structure rests on a rock or the stage's ground band [spec docs/design/stage-art.md]", () => {
  const boundsOf = (model: string) => MODEL_FACTS[model]?.bounds;
  const problems = STAGE_CATALOG.flatMap(stage => [...landmarkProblems(stage.name, stageScenery(stage.id).pieces, boundsOf), ...groundProblems(stage.name, stageScenery(stage.id).pieces, boundsOf, hiddenBelow(stage.id))]);
  expect(problems).toEqual([]);
});

function sceneReport(client: HeadlessClient): SceneReport {
  const read = readSceneLines(client.files.get(sceneFile(client.slot, "smashcraft")) ?? []);
  if ("problem" in read) throw new Error(`scene report line ${read.line}: ${read.problem}`);
  return read;
}

test("development build: a match's scene report shows the stage and declares every effect the match creates [invariant]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment });
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing host client");
  let mainDeck = "";
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.demonHunter);
    selectCharacter(s.game, 1, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    mainDeck = deckModel(s.game.stageChoice, 0);

    startMatch(s);
    renderPersistentPresentation(s);
    trampoline("scene.report")();
  });
  const report = sceneReport(client);
  expect(sceneProblems(report, SMASHCRAFT_SCENE)).toEqual([]);
  const declared = new Set(SMASHCRAFT_SCENE.kinds.flatMap(({ models }) => models.map((model) => model.replaceAll("\\", "/"))));
  expect(report.models.filter(({ model }) => !declared.has(model)).map(({ model }) => model)).toEqual([]);
  expect(report.effects).toBeGreaterThan(200);
  expect(report.models.find(({ model }) => model === reportedModel(mainDeck))).toMatchObject({ live: 1, inView: 1, drawn: 1 });
  expect(client.errors).toEqual([]);
});

test("moving decks are visible and their effects follow the presented match frame [repro #242] [provisional]", () => {
  for (const stage of [DRIFTING_DECK_STAGE, PATTERNED_DECKS_STAGE]) {
    const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
    clients.start();
    clients.frames(30);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing client");
    client.run(() => {
      const s = shell();
      selectCharacter(s.game, 0, Character.rifleman);
      selectCharacter(s.game, 1, Character.rifleman);
      requestStageSelect(s.game, 0);
      s.game.stageChoice = stage;
      requestStart(s.game, 0);
      startMatch(s);
      drawStage(s);
      expect(s.stageDecks).toHaveLength(surfaceCount(stage));
      const movingModels = new Map<string, number>();
      for (let deck = 1; deck < surfaceCount(stage); deck++) {
        const model = reportedModel(deckModel(stage, deck));
        movingModels.set(model, (movingModels.get(model) ?? 0) + 1);
      }
      for (const frame of [0, 100, 210, 420, 600]) {
        s.game.matchFrame = frame;
        renderPersistentPresentation(s);
        lockArenaCamera(s);
        for (let deck = 1; deck < s.stageDecks.length; deck++) {
          const effect = s.stageDecks[deck];
          if (effect === undefined) throw new Error("missing deck");
          expect(BlzGetLocalSpecialEffectX(effect)).toBe(s.origin.x + (surfaceLeft(stage, deck, frame) + surfaceRight(stage, deck, frame)) / 2);
          expect(BlzGetLocalSpecialEffectZ(effect)).toBe(s.origin.z + surfaceZ(stage, deck, frame));
        }
        trampoline("scene.report")();
        const report = sceneReport(client);
        expect(sceneProblems(report, SMASHCRAFT_SCENE)).toEqual([]);
        for (const [model, count] of movingModels) {
          expect(report.models.find((entry) => entry.model === model)).toMatchObject({ live: count, drawn: count });
        }
      }
    });
    expect(client.errors).toEqual([]);
  }
});

test("Frozen Throne's raised decks draw their stock floes, rock and rubble in view, not the packaged slab [repro #290]", () => {
  const stage = FROZEN_THRONE_STAGE;
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  client.run(() => {
    const s = shell();
    selectCharacter(s.game, 0, Character.rifleman);
    selectCharacter(s.game, 1, Character.rifleman);
    requestStageSelect(s.game, 0);
    s.game.stageChoice = stage;
    requestStart(s.game, 0);
    startMatch(s);
    drawStage(s);
    renderPersistentPresentation(s);
    lockArenaCamera(s);
    trampoline("scene.report")();
  });
  const expected = new Map<string, number>();
  for (let deck = 1; deck < surfaceCount(stage); deck++) {
    const parts = platformParts(stage, deck);
    expect(parts.length).toBeGreaterThan(0);
    expect(deckModel(stage, deck)).toBe(parts[0]?.model);
    for (const { model } of parts) expected.set(reportedModel(model), (expected.get(reportedModel(model)) ?? 0) + 1);
  }
  const report = sceneReport(client);
  const drawn = Object.fromEntries([...expected.keys()].map((model) => {
    const entry = report.models.find((found) => found.model === model);
    return [model, { live: entry?.live, inView: entry?.inView, drawn: entry?.drawn }];
  }));
  expect(drawn).toEqual(Object.fromEntries([...expected].map(([model, count]) => [model, { live: count, inView: count, drawn: count }])));
  const slab = STAGE_DECK_MODELS[stage]?.slab;
  if (slab === undefined) throw new Error("Frozen Throne has no packaged slab");
  expect(report.models.find(({ model }) => model === reportedModel(slab))).toBeUndefined();
  expect(client.errors).toEqual([]);
});

test("every hazard stage keeps warning text off the match screen and draws wind, cannon and lava cues [spec #194] [spec #336] [spec #348]", () => {
  for (const [stage, frame, warning] of [
    [WIND_TEST_STAGE, 601, "Wind pushes right in 45 frames."],
    [WIND_TEST_STAGE, 645, "Wind pushes right in 1 frames."],
    [WIND_TEST_STAGE, 1520, "Wind pushes left in 45 frames."],
    [WIND_TEST_STAGE, 600, "Wind pushes right in 46 frames."],
    [CARRIED_TEST_STAGE, 30, "Platform moves in 30 frames."],
    [TIMED_TEST_STAGE, 60, "Platform moves in 30 frames."],
    [CANNON_TEST_STAGE, 31, "Cannon fires in 10 frames."],
    [CANNON_TEST_STAGE, 450, "Lava erupts on the right in 151 frames."],
  ] as const) {
    const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
    clients.start();
    clients.frames(30);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing client");
    client.run(() => {
      const s = shell();
      selectCharacter(s.game, 0, Character.rifleman);
      selectCharacter(s.game, 1, Character.rifleman);
      requestStageSelect(s.game, 0);
      s.game.stageChoice = stage;
      requestStart(s.game, 0);
      startMatch(s);
      s.game.matchFrame = frame;
      s.status.seconds = 0;
      const cannonShot = warning.startsWith("Cannon");
      if (cannonShot) {
        fighterAt(s.world, 0).cannon.held = 30;
        fighterAt(s.world, 0).cannon.firing = 1;
      }
      renderPersistentPresentation(s);
      renderUi(s);
      lockArenaCamera(s);

      expect(client.frames.shownText()).not.toContain(warning);
      trampoline("scene.report")();
      const report = sceneReport(client);
      expect(sceneProblems(report, SMASHCRAFT_SCENE)).toEqual([]);
      if (stage === WIND_TEST_STAGE) {
        const wind = report.models.find(({ model }) => model === reportedModel(WIND_STREAK_MODEL));
        if (frame === 600) expect(wind?.drawn ?? 0).toBe(0);
        else expect(wind).toMatchObject({ live: WIND_STREAK_COUNT, drawn: WIND_STREAK_COUNT });
      }
      if (stage === CANNON_TEST_STAGE) expect(report.models.find(({ model }) => model === reportedModel(CANNON_MODEL))).toMatchObject({ live: 1, drawn: 1 });

      if (!cannonShot && stage === CANNON_TEST_STAGE) expect(report.models.find(({ model }) => model === reportedModel(STAGE_LAVA_MODEL))).toMatchObject({ live: 1, drawn: 1 });
    });
    expect(client.errors).toEqual([]);
  }
});








test("a dust slot reused while shown is a new stay each use; a standing spark and a collapsed missile still fail [repro #26]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");

  let lingering: effect | undefined;
  let dustPool: CombatEffects | undefined;
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 6);
    selectCharacter(s.game, 0, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    s.game.timeLimitMinutes = 0;
    lingering = AddSpecialEffect(IMPACT_HIT_MODEL, s.origin.x, s.origin.y);
    dustPool = new CombatEffects(s.origin);
  });

  const stays = new Map<number, { frames: number; reuses: number; age: number | undefined }>();
  let longestReused = 0;
  const dust = createImpactEvents();
  const impacts = createImpactState();
  dust.launchTrail = true;


  for (let frame = 0; frame < 240; frame++) {
    client.run(() => {
      const { origin, participants } = shell();
      const { row } = participants[0].capture;
      const direction = Math.floor(frame / 40) % 2 === 0 ? Action.moveLeft : Action.moveRight;
      row.held = bit(direction);
      row.pressed = (frame % 9 === 0 ? bit(Action.jump) : 0) | (frame % 40 === 0 ? bit(direction) : 0);
      row.axisX = direction === Action.moveLeft ? -127 : 127;
      if (lingering !== undefined && frame % 60 === 0) BlzSetSpecialEffectPosition(lingering, origin.x + frame, origin.y, origin.z);
    });
    clients.frames(1);
    client.run(() => {
      const s = shell();
      if (dustPool === undefined) throw new Error("missing dust pool");
      if (frame < 208) emitImpacts(impacts, dust, frame);
      dustPool.present(impacts, 0, impacts, true);
      const pool = (dustPool as unknown as { impacts: readonly effect[] }).impacts;
      for (let use = 0; use < IMPACTS_PER_KIND; use++) {
        const slot = IMPACT_DUST * IMPACTS_PER_KIND + use;
        const handle = pool[slot];
        const shown = handle !== undefined && BlzGetLocalSpecialEffectZ(handle) > s.origin.z - FLOOR_HEIGHT + 1.0;
        const age = impacts.ages[slot];
        const stay = stays.get(slot) ?? { frames: 0, reuses: 0, age: undefined };
        const reuses = stay.reuses + (shown && stay.age !== undefined && age !== undefined && age < stay.age ? 1 : 0);
        stays.set(slot, shown ? { frames: stay.frames + 1, reuses, age } : { frames: 0, reuses: 0, age: undefined });
        if (shown && reuses > 0) longestReused = Math.max(longestReused, stay.frames + 1);
      }
      advanceImpacts(impacts);
    });
  }
  client.run(() => {

    const { origin } = shell();
    const missile = AddSpecialEffect(STOCK_MODELS.flyingMachineMissile, origin.x, origin.y);
    BlzSetSpecialEffectScale(missile, 0.0);
    BlzSetSpecialEffectPosition(missile, origin.x, origin.y, origin.z);
    trampoline("scene.report")();
  });


  expect(longestReused).toBeGreaterThan(seconds(3));
  const report = sceneReport(client);
  expect(report.models.find(({ model }) => model === reportedModel(impactModel(IMPACT_DUST)))?.longest).toBe(impactLifetime(IMPACT_DUST));
  expect(sceneProblems(report, SMASHCRAFT_SCENE).map(({ seen }) => seen)).toEqual([
    "a hit spark stayed in view for 4.00 s; it should be gone within 3.00 s",
    "1 hidden projectile in view still show particles",
  ]);
  expect(client.errors).toEqual([]);
});

test("a downward offscreen portrait and arrow stay entirely above the HUD at every supported aspect [spec #80]", () => {
  for (const aspect of [16 / 9, 16 / 10, 3 / 2]) {
    const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
    clients.start();
    clients.frames(30);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing client");
    clients.chat(0, "-dev camera");
    client.run(() => {
      const s = shell();
      if (s.ui === undefined) throw new Error("missing match UI");
      s.ui.bubbles[0].update(true, Character.rifleman, 0.5, 2, aspect);
      for (const [name, context] of [["OffscreenPortrait0", 920], ["OffscreenArrow0", 921]] as const) {
        const frame = client.frames.named(name, context);
        if (frame === undefined) throw new Error(`missing ${name}`);
        const point = frame.points.get(FRAMEPOINT_CENTER);
        if (point === undefined) throw new Error(`missing ${name} position`);
        expect(client.frames.shown(frame)).toBe(true);
        expect(frame.enabled).toBe(false);
        expect(point.y - frame.height / 2).toBeGreaterThanOrEqual(0.139);
      }
    });
  }
});


for (const { id: stage, name } of STAGE_CATALOG) test(`${name} keeps its camera inside the blast zones, shows every offscreen bubble and loses stocks outside the view at all supported aspects [spec #80]`, () => {
  for (const aspect of [16 / 9, 16 / 10, 3 / 2]) {
    const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
    clients.start();
    clients.frames(30);
    const client = clients.clients[0];
    if (client === undefined) throw new Error("missing client");
    aspects.set(client, aspect);
    client.run(() => {
      const s = shell();
      setParticipants(s.game, 1, 2);
      startQuickMatch(s, stage, "camera");
    });
    const check = new CameraFindings();
    const problems: string[] = [];
    for (let frame = 0; frame < 360; frame++) {
      clients.frames(1);
      client.run(() => {
        problems.push(...check.observe(client).map(({ text }) => text));
        const s = shell();
        const camera = cameras.get(client);
        if (camera === undefined) throw new Error("missing set camera");
        const bounds = stageBounds(stage);

        const field = (name: string) => camera.fields.get(name) ?? Number.NaN;
        const pitch = (field("CAMERA_FIELD_ANGLE_OF_ATTACK") - 360) * Math.PI / 180;
        const tangent = Math.tan(field("CAMERA_FIELD_FIELD_OF_VIEW") * Math.PI / 360) / aspect;
        const distance = field("CAMERA_FIELD_TARGET_DISTANCE");
        const targetZ = field("CAMERA_FIELD_ZOFFSET") - FLOOR_HEIGHT;
        for (const row of [0, HUD_TOP_ROW, 1]) {
          const vertical = (1 - 2 * row) * tangent;
          const dz = vertical * distance / (Math.cos(pitch) - vertical * Math.sin(pitch));
          const z = targetZ + dz;
          const halfWidth = (distance + dz * Math.sin(pitch)) * tangent * aspect;
          const x = camera.x - s.origin.x;
          expect(x - halfWidth).toBeGreaterThanOrEqual(bounds.camera.left - 0.01);
          expect(x + halfWidth).toBeLessThanOrEqual(bounds.camera.right + 0.01);
          expect(z).toBeLessThanOrEqual(bounds.camera.top + 0.01);
          expect(z).toBeGreaterThan(bounds.blast.bottom + 19.99);
          if (row <= HUD_TOP_ROW) expect(z).toBeGreaterThanOrEqual(bounds.camera.bottom - 0.01);
        }
      });
    }
    expect(problems).toEqual([]);
    expect(check.offscreenFrames).toBeGreaterThanOrEqual(180);
    expect(check.stockLosses).toBeGreaterThanOrEqual(1);
    expect(client.errors).toEqual([]);
  }
});


const HUD_TOP_ROW = 1 - 0.139 / 0.6;
type Point = readonly [x: number, y: number, z: number];








function framePoint(camera: SetCamera, origin: { readonly x: number; readonly y: number }, [x, y, z]: Point) {
  const field = (name: string) => camera.fields.get(name) ?? Number.NaN;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const attack = field("CAMERA_FIELD_ANGLE_OF_ATTACK");
  const pitch = radians(attack > 180 ? attack - 360 : attack);
  const yaw = radians(field("CAMERA_FIELD_ROTATION"));
  const forward = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)] as const;
  const right = [Math.sin(yaw), -Math.cos(yaw), 0] as const;
  const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]] as const;
  const distance = field("CAMERA_FIELD_TARGET_DISTANCE");
  const target = [camera.x - origin.x, camera.y - origin.y, field("CAMERA_FIELD_ZOFFSET") - FLOOR_HEIGHT] as const;
  const relative = [0, 1, 2].map((axis) => [x, y, z][axis]! - (target[axis]! - distance * forward[axis]!));
  const along = (axis: readonly number[]) => relative.reduce((sum, value, index) => sum + value * axis[index]!, 0);
  const across = Math.tan(radians(field("CAMERA_FIELD_FIELD_OF_VIEW") / 2));
  return { column: 0.5 + along(right) / (2 * along(forward) * across), row: 0.5 - along(up) / (2 * along(forward) * (across * 9) / 16) };
}

test("a fighter within 100 of the main deck's underside shows above the HUD with the underside, wherever the others are [spec #57]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  const camera = client === undefined ? undefined : cameras.get(client);
  if (client === undefined || camera === undefined) throw new Error("missing client");
  const near = 100;
  const underside = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(0, index))
    .find((line) => line.kind === SurfaceContact.ceiling && line.startZ === MAIN_DECK_UNDERSIDE_Z && line.endZ === MAIN_DECK_UNDERSIDE_Z);
  if (underside === undefined) throw new Error("the main deck has no level underside");

  const undersideNear = ([x]: Point): Point => [Math.min(Math.max(x, underside.endX), underside.startX), -MAIN_DECK_HALF_DEPTH, MAIN_DECK_UNDERSIDE_Z];

  const beside = (side: number, z: number): Point => {
    const wall = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(0, index))
      .find((line) => line.normalX * side > 0 && Math.min(line.startZ, line.endZ) <= z && Math.max(line.startZ, line.endZ) >= z);
    if (wall === undefined) throw new Error(`no wall at ${z}`);
    return [wall.startX + ((wall.endX - wall.startX) * (z - wall.startZ)) / (wall.endZ - wall.startZ) + 12 * side, 0, z];
  };
  const fighters: Point[] = [
    ...[underside.endX, 0, underside.startX].flatMap((x) => [MAIN_DECK_UNDERSIDE_Z - 1, MAIN_DECK_UNDERSIDE_Z - near].map((z): Point => [x, 0, z])),
    ...[-1, 1].flatMap((side) => [MAIN_DECK_UNDERSIDE_Z + near / 2, MAIN_DECK_UNDERSIDE_Z + near].map((z) => beside(side, z))),
  ];

  const others: (Point | undefined)[] = [undefined, [300, 0, 0], [-265, 0, 170], [0, 0, 465], [0, 0, stageBounds(0).blast.top - 1], [-(stageBounds(0).blast.right - 20), 0, 0]];
  const misses: string[] = [];
  let origin = { x: 0, y: 0 };
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 2);
    selectCharacter(s.game, 0, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    selectStage(s.game, 0, 0);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    origin = s.origin;
    for (const fighter of fighters) for (const other of others) {
      const low = fighterAt(s.world, 0).motion;
      [low.x, low.z] = [fighter[0], fighter[2]];
      const high = fighterAt(s.world, 1);
      high.status.out = other === undefined;
      [high.motion.x, high.motion.z] = [other?.[0] ?? 0, other?.[2] ?? 0];
      s.game.camera.initialized = false;
      advanceMatchCamera(s.game.camera, s.world, s.game.stageChoice);
      lockArenaCamera(s);
      const seen = [undersideNear(fighter), fighter].map((point) => framePoint(camera, origin, point));
      const outside = seen.filter(({ column, row }) => column < 0 || column > 1 || row < 0 || row > HUD_TOP_ROW);
      const otherSeen = other === undefined ? undefined : framePoint(camera, origin, other);
      if (outside.length > 0) {
        misses.push(`fighter at (${fighter[0].toFixed(0)}, ${fighter[2].toFixed(0)}) with the other at ${other === undefined ? "none" : `(${other[0]}, ${other[2]})`}: underside and fighter at ${seen.map(({ column, row }) => `(${column.toFixed(2)}, ${row.toFixed(2)})`).join(" and ")}${otherSeen === undefined ? "" : `, other ${otherSeen.row.toFixed(2)}`}`);
      }
    }
    trampoline("scene.report")();
  });
  expect(misses).toEqual([]);
  expect(sceneProblems(sceneReport(client), SMASHCRAFT_SCENE)).toEqual([]);
});


function insideMainDeck(x: number, z: number): boolean {
  const edges = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index): readonly [number, number, number, number] => {
    const line = solidSurfaceAt(0, index);
    return [line.startX, line.startZ, line.endX, line.endZ];
  });

  const ledges = edges.flatMap(([x0, z0, x1, z1]) => [[x0, z0], [x1, z1]]).filter(([, lz]) => lz === 0);
  const [left, right] = [Math.min(...ledges.map(([lx]) => lx!)), Math.max(...ledges.map(([lx]) => lx!))];
  let inside = false;
  for (const [x0, z0, x1, z1] of [...edges, [left, 0, right, 0] as const]) {
    if ((z0 > z) !== (z1 > z) && x < x0 + ((x1 - x0) * (z - z0)) / (z1 - z0)) inside = !inside;
  }
  return inside;
}

test("in the underside scenario's match, a fighter rising into the main deck's underside meets it with its ECB top and none of it inside the deck [invariant]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  const top = bodyTop(Character.rifleman) * WORLD_UNITS_PER_MELEE_UNIT;
  const flank = BODY_HALF_WIDTH * WORLD_UNITS_PER_MELEE_UNIT;

  const ecbInside = (x: number, z: number) =>
    [x - flank, x, x + flank].some((px) => [z, z + top / 2, z + top - 0.5].some((pz) => insideMainDeck(px, pz)));
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 2);
    selectCharacter(s.game, 0, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);

    selectStage(s.game, 0, 0);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    initializeScenario("underside", s.game, s.world);
  });
  clients.frames(30);
  client.run(() => {
    const fighter = fighterAt(shell().world, 0);

    expect(ecbInside(fighter.motion.x, fighter.motion.z)).toBe(false);

    fighter.status.frozenFrames = 0;
    fighter.motion.x = 200.0;
    fighter.motion.z = MAIN_DECK_UNDERSIDE_Z - top - 3.0;
    fighter.down.state = DownState.tumble;
    fighter.launch.hitstun = 60;
    fighter.launch.knockbackZ = 18.0;
  });
  let contacted = false;
  for (let frame = 1; frame <= 5 && !contacted; frame++) {
    clients.frames(1);
    client.run(() => {
      contacted = fighterAt(shell().world, 0).surfaceRecovery.contactSerial > 0;
    });
  }
  client.run(() => {

    const { motion, surfaceRecovery } = fighterAt(shell().world, 0);
    expect(surfaceRecovery.contactKind).toBe(SurfaceContact.ceiling);
    expect(surfaceRecovery.contactZ).toBe(MAIN_DECK_UNDERSIDE_Z);
    expect(motion.z + top).toBeCloseTo(MAIN_DECK_UNDERSIDE_Z, 3);
    expect(ecbInside(motion.x, motion.z)).toBe(false);
    expect(insideMainDeck(motion.x, motion.z + top + 0.5)).toBe(true);
  });
});

test("ranked stage lineup: both clients choose all ten stages and draw their decks and themed scenery [invariant]", () => {
  const stages = STAGE_CATALOG.filter(({ id }) => id !== 0);
  expect(stages).toHaveLength(10);
  for (const stage of stages) {
    const clients = headless.clients({ start: startDevelopment, install: installDevelopment });
    clients.start();
    clients.frames(30);
    clients.everywhere(() => {
      const s = shell();
      selectCharacter(s.game, 0, Character.rifleman);
      selectCharacter(s.game, 1, Character.rifleman);
      expect(requestStageSelect(s.game, 0)).toBe(true);
      selectStage(s.game, 0, stage.id);
      expect(s.game.stageChoice).toBe(stage.id);
      expect(requestStart(s.game, 0)).toBe(true);
      startMatch(s);
    });
    clients.frames(60);
    for (const client of clients.clients) {
      client.run(() => {
        const s = shell();
        expect(s.stageDecks).toHaveLength(surfaceCount(stage.id));
        expect(s.stageScenery).toHaveLength(placedPieces(stage.id).length);
        expect(s.stageScenery?.length).toBeGreaterThan(0);
        trampoline("scene.report")();
      });
      expect(sceneProblems(sceneReport(client), SMASHCRAFT_SCENE)).toEqual([]);
      expect(client.errors).toEqual([]);
    }
  }
});
