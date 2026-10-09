// The development build's scene report, read the way the host reads it, against
// Smashcraft's declared player view (scripts/wisp/playerView.ts), with the model
// facts and arena cameras of its render visibility.
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
import { ARENA_CAMERA, FLOOR_HEIGHT, PLAYABLE_BOUNDS, WORLD_BOUNDS, extremeCamera } from "../src/game/presentation/arenaCamera";
import { CANNON_MODEL, WIND_STREAK_MODEL } from "../src/game/presentation/stageHazards";
import { deckModel } from "../src/game/presentation/stagePreload";
import { platformParts } from "../src/game/presentation/stockPlatforms";
import { STAGE_DECK_MODELS } from "../src/game/assets/stageAssetInfo";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { placedPieces, stageScenery } from "../src/game/presentation/stageScenery";
import { modelReach } from "wisp/scripts/wisp/models";
import { boxSeen } from "wisp/scripts/wisp/visibility";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { FROZEN_THRONE_QUICK_COMMAND } from "../src/game/shell/devSettings";
import { STOCK_MODELS } from "../src/game/render/effects";
import { IMPACT_DUST, IMPACTS_PER_KIND, advanceImpacts, createImpactState, emitImpacts, impactLifetime } from "../src/game/presentation/impactState";
import { CombatEffects } from "../src/game/render/combatEffects";
import { createImpactEvents } from "../src/game/presentation/impactEvents";
import { Character, DownState, SurfaceContact } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, FROZEN_THRONE_STAGE, TIMED_TEST_STAGE, WIND_TEST_STAGE, DRIFTING_DECK_STAGE, PATTERNED_DECKS_STAGE, MAIN_DECK_BODY_SURFACES, MAIN_DECK_UNDERSIDE_Z, solidSurfaceAt, surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "../src/game/sim/stage";
import { stageBounds } from "../src/game/sim/stageBounds";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "../src/game/sim/knockback";
import { MATCH_CAMERA_ASPECT, advanceMatchCamera, createMatchCamera } from "../src/game/sim/matchCamera";
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
import { MAIN_DECK_HALF_DEPTH, mainDeckOutlineStage } from "../scripts/stageDeck";
import { CameraFindings } from "./cameraFindings";

// Nothing here compares clients' native calls, so none are logged: the dense-dust match runs 240 frames.
const declarations = readNativeDeclarations();
const unlogged = Object.fromEntries(declarations.functions.map(([name]) => [name, "this file compares no calls"]));
/** The camera fields and position each client last set. */
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
  // Warcraft multiplies matrix scales, so reapplying a stretch without a reset stacks it.
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

test("Frozen Throne: a selectable match draws four platforms and the winter background without scene problems [provisional]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment });
  clients.start();
  clients.frames(30);
  clients.chat(0, FROZEN_THRONE_QUICK_COMMAND);
  clients.frames(60);
  for (const client of clients.clients) {
    client.run(() => {
      const s = shell();
      expect(s.game.stageChoice).toBe(2);
      expect(s.stageDecks).toHaveLength(4);
      expect(s.stageScenery).toHaveLength(stageScenery(2).pieces.length);
      trampoline("scene.report")();
    });
    expect(sceneProblems(sceneReport(client), SMASHCRAFT_SCENE)).toEqual([]);
    expect(client.errors).toEqual([]);
  }
});

const TEMPLE_OF_TIDES = "Buildings\\Naga\\TempleOfTides\\TempleOfTides.mdx";
/**
 * Where a scenery model draws while it stands, for models whose facts box also holds
 * geosets other sequences show (scenery plays Stand: src/platform/shell/stageScenery.ts).
 * TempleOfTides.mdx: vertices of geosets 0, 2, 3 and 5, the only ones with alpha in Stand;
 * geoset 1 (Portrait only) stretches its facts box to z -573..803.
 */
const STAND_BOUNDS: Readonly<Record<string, { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] }>> = {
  [TEMPLE_OF_TIDES]: { min: [-180.0, -170.0, -91.0], max: [176.0, 183.0, 374.0] },
};

test("Tomb's Temple of Tides draws its whole standing body and roof above the deck's top edge on the right third at both camera extremes and client widths [repro #299]", () => {
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
    // The deck's top back edge is its highest line on screen at both extremes; the temple must clear it.
    const deckTop = Math.min(...[-600, 600].map(x => project(x, MAIN_DECK_HALF_DEPTH, 0)[1]));
    for (const [x, y, z] of corners) {
      expect(depth(y, z), extreme).toBeLessThan(ARENA_CAMERA.farZ);
      const [column, row] = project(x, y, z);
      expect(column, extreme).toBeGreaterThan(0);
      expect(column, extreme).toBeLessThan(1);
      expect(row, extreme).toBeGreaterThan(0);
      expect(row, extreme).toBeLessThan(deckTop);
    }
    const centre = corners.reduce((sum, [x, y, z]) => [sum[0] + x / 8, sum[1] + y / 8, sum[2] + z / 8], [0, 0, 0]);
    expect(project(centre[0], centre[1], centre[2])[0], extreme).toBeGreaterThanOrEqual(2 / 3);
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
  // Natively Stratholme's cathedral (y +6,200) and Tomb's temple and waterfall (+5,600) went undrawn from a playable-centre origin.
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.client(0);
  const outside: string[] = [];
  client.run(() => {
    const s = shell();
    // Headless centres the playable map at 0; the base map centres it at PLAYABLE_BOUNDS.centreY.
    const inside = (x: number, y: number) => {
      const nativeY = y + PLAYABLE_BOUNDS.centreY;
      return x >= WORLD_BOUNDS.left && x <= WORLD_BOUNDS.right && nativeY >= WORLD_BOUNDS.front && nativeY <= WORLD_BOUNDS.back;
    };
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

// Warcraft keeps units inside the playable bounds: an arena moved 3,500 south left fighters short of the blast zones (e2e34176).
const BLAST_MARGIN = 512.0;
for (const { id: stage, name } of STAGE_CATALOG) test(`${name}: every blast zone lies ${BLAST_MARGIN} inside the playable bounds, and a fighter launched past each one is KO'd [repro #298]`, () => {
  // Solo quick matches add a computer, whose attacks can freeze a crossing during hitlag.
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
    // Headless centres the playable map at 0; the base map centres it at PLAYABLE_BOUNDS.centreY.
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
    // Past the respawn and its invincibility.
    clients.frames(160);
  }
  expect(stocks).toEqual(sides.map(({ side }) => `${side}: 1`));
  expect(client.errors).toEqual([]);
});

test("every stage's scenery stays behind fighters, and fog starts beyond the fight in every declared camera [provisional]", () => {
  const visibility = SMASHCRAFT_SCENE.visibility;
  if (visibility === undefined) throw new Error("missing visibility");
  const problems: string[] = [];
  for (const stage of STAGE_CATALOG) {
    const scenery = stageScenery(stage.id);
    const corners = (box: { min: readonly number[]; max: readonly number[] }) =>
      [box.min[0]!, box.max[0]!].flatMap(x => [box.min[1]!, box.max[1]!].flatMap(y => [box.min[2]!, box.max[2]!].map(z => [x, y, z] as const)));
    for (const camera of visibility.cameras) {
      const radians = (degrees: number) => degrees * Math.PI / 180;
      const pitch = radians(camera.angleOfAttack > 180 ? camera.angleOfAttack - 360 : camera.angleOfAttack);
      const yaw = radians(camera.rotation);
      const forward = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch)] as const;
      const along = (point: readonly number[]) => point.reduce((sum, value, axis) => sum + value * forward[axis]!, 0);
      // Includes the complete visible fighting volume and a 200-unit allowance for fighter bodies.
      const blast = stageBounds(stage.id).blast;
      const fight = { min: [blast.left - 200, -200, blast.bottom - 200], max: [blast.right + 200, 200, blast.top + 200] };
      const farthestFighter = Math.max(...corners(fight).map(along));
      const eye = camera.target.map((value, axis) => value - camera.distance * forward[axis]!);
      if (scenery.fog !== undefined) expect(farthestFighter - along(eye)).toBeLessThan(scenery.fog.start);
      for (const piece of scenery.pieces) {
        const turn = radians(piece.yaw);
        const turned = (x: number, y: number) => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const;
        const facts = MODEL_FACTS[piece.model];
        if (facts === undefined) throw new Error(`missing facts for ${piece.model}`);
        const reach = modelReach(facts);
        expect(reach.unknown).toEqual([]);
        for (const box of reach.boxes) {
          const flat = [box.min[0], box.max[0]].flatMap(x => [box.min[1], box.max[1]].map(y => turned(x, y)));
          const placed = {
            min: [Math.min(...flat.map(p => p[0])) * piece.scale + piece.x, Math.min(...flat.map(p => p[1])) * piece.scale + piece.y, box.min[2] * piece.scale + piece.z] as const,
            max: [Math.max(...flat.map(p => p[0])) * piece.scale + piece.x, Math.max(...flat.map(p => p[1])) * piece.scale + piece.y, box.max[2] * piece.scale + piece.z] as const,
          };
          if (boxSeen(placed, camera) && Math.min(...corners(placed).map(along)) <= farthestFighter) problems.push(`${stage.name}: ${piece.model}`);
        }
      }
    }
  }
  expect([...new Set(problems)]).toEqual([]);
});

test("no stage shows a scenery piece's base below the deck at either camera extreme: the stage floats [spec docs/design/stage-art.md]", () => {
  // Rule 11: every base reaches below the frame or hides behind the main deck or a nearer piece (a rock it stands on).
  const tilt = (10 * Math.PI) / 180;
  const problems: string[] = [];
  for (const stage of STAGE_CATALOG) {
    const placed = stageScenery(stage.id).pieces.flatMap((piece) => {
      const bounds = STAND_BOUNDS[piece.model] ?? MODEL_FACTS[piece.model]?.bounds;
      if (bounds === undefined) return [];
      const turn = (piece.yaw * Math.PI) / 180;
      const flat = [bounds.min[0], bounds.max[0]].flatMap(x => [bounds.min[1], bounds.max[1]].map(y => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)] as const));
      const stretch = (piece.matrixScale?.[2] ?? 1) * piece.scale;
      return [{
        model: piece.model,
        left: Math.min(...flat.map(p => p[0])) * piece.scale + piece.x, right: Math.max(...flat.map(p => p[0])) * piece.scale + piece.x,
        front: Math.min(...flat.map(p => p[1])) * piece.scale + piece.y,
        bottom: bounds.min[2] * stretch + piece.z, top: bounds.max[2] * stretch + piece.z,
      }];
    });
    for (const extreme of ["near", "far"] as const) {
      const camera = createMatchCamera();
      extremeCamera(camera, stage.id, MATCH_CAMERA_ASPECT, extreme);
      const depth = (y: number, z: number) => camera.distance + y * Math.cos(tilt) - (z - camera.z) * Math.sin(tilt);
      const project = (x: number, y: number, z: number) => [
        0.5 + (x - camera.x) / (2 * depth(y, z) * camera.tangent * MATCH_CAMERA_ASPECT),
        0.5 - (y * Math.sin(tilt) + (z - camera.z) * Math.cos(tilt)) / (2 * depth(y, z) * camera.tangent),
      ] as const;
      const deck = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index) => solidSurfaceAt(mainDeckOutlineStage(stage.id), index)).map(line => project(line.startX, -MAIN_DECK_HALF_DEPTH, line.startZ));
      const behindDeck = ([column, row]: readonly [number, number]) => deck.reduce((inside, [x1, y1], index) => {
        const [x2, y2] = deck[(index + deck.length - 1) % deck.length]!;
        return (y1 > row) !== (y2 > row) && column < ((x2 - x1) * (row - y1)) / (y2 - y1) + x1 ? !inside : inside;
      }, false);
      for (const piece of placed) {
        const shown = Array.from({ length: 21 }, (_, step) => piece.left + ((piece.right - piece.left) * step) / 20).filter((x) => {
          if (depth(piece.front, piece.bottom) > ARENA_CAMERA.farZ) return false;
          const at = project(x, piece.front, piece.bottom);
          if (at[0] < 0 || at[0] > 1 || at[1] < 0 || at[1] > 1 || behindDeck(at)) return false;
          return !placed.some((other) => other !== piece && other.front <= piece.front && x >= other.left && x <= other.right && piece.bottom >= other.bottom && piece.bottom <= other.top);
        });
        if (shown.length > 0) problems.push(`${stage.name} ${extreme}: ${piece.model} base at z ${Math.round(piece.bottom)}`);
      }
    }
  }
  expect(problems).toEqual([]);
});

/** The client's latest scene report, from the lines it wrote. */
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
    // Every effect pool is created when the match starts.
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
      // During play the screen shows no hazard text; the stage itself warns (#336).
      expect(client.frames.shownText()).not.toContain(warning);
      trampoline("scene.report")();
      const report = sceneReport(client);
      expect(sceneProblems(report, SMASHCRAFT_SCENE)).toEqual([]);
      if (stage === WIND_TEST_STAGE) {
        const wind = report.models.find(({ model }) => model === reportedModel(WIND_STREAK_MODEL));
        if (frame === 600) expect(wind?.drawn ?? 0).toBe(0);
        else expect(wind).toMatchObject({ live: 6, drawn: 6 });
      }
      if (stage === CANNON_TEST_STAGE) expect(report.models.find(({ model }) => model === reportedModel(CANNON_MODEL))).toMatchObject({ live: 1, drawn: 1 });
      // The warning glows at the lava's own spot.
      if (!cannonShot && stage === CANNON_TEST_STAGE) expect(report.models.find(({ model }) => model === reportedModel(STAGE_LAVA_MODEL))).toMatchObject({ live: 1, drawn: 1 });
    });
    expect(client.errors).toEqual([]);
  }
});

/**
 * Dense play's dust: an rifleman jumping every 9 frames while running back and
 * forth, with two computers chasing it, takes the eight-slot dust pool's next
 * slot before the last dust in it fades. Counted as one stay, a reused slot
 * stayed in view over 180 frames and failed the rematch of #26's clean-folders
 * capture (240 frames) and its headless run (687).
 */
test("a dust slot reused while shown is a new stay each use; a standing spark and a collapsed missile still fail [repro #26]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  if (client === undefined) throw new Error("missing client");
  // A hit spark left standing at the stage center, moved in view but never parked: the defect the check is for.
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
  // Per frame, how long each dust slot has been in view and how often its slot was reused meanwhile.
  const stays = new Map<number, { frames: number; reuses: number; age: number | undefined }>();
  let longestReused = 0;
  const dust = createImpactEvents();
  const impacts = createImpactState();
  dust.launchTrail = true;
  // Keep the reproduced pool reuse independent of changing combat outcomes:
  // one trail per frame for 208 frames, then allow its final stays to expire.
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
    // And 05266a3's defect: a collapsed missile waiting at the floor, where the camera sees its smoke.
    const { origin } = shell();
    const missile = AddSpecialEffect(STOCK_MODELS.gyroCopterMissile, origin.x, origin.y);
    BlzSetSpecialEffectScale(missile, 0.0);
    BlzSetSpecialEffectPosition(missile, origin.x, origin.y, origin.z);
    trampoline("scene.report")();
  });
  // A dust slot stayed in view across uses for longer than a hit spark may stay;
  // each use was a stay of its own, and only the standing spark and the collapsed missile fail.
  expect(longestReused).toBeGreaterThan(seconds(3));
  const report = sceneReport(client);
  expect(report.models.find(({ model }) => model === reportedModel(impactModel(IMPACT_DUST)))?.longest).toBe(impactLifetime(IMPACT_DUST));
  expect(sceneProblems(report, SMASHCRAFT_SCENE).map(({ seen }) => seen)).toEqual([
    "a hit spark stayed in view for 4.00 s; it should be gone within 3.00 s",
    "1 hidden projectile, special cue in view still show particles",
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

// One test a stage: the catalog grows, and each stage's three 360-frame matches take 0.2-0.5 s alone.
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
        // Intersect rays from the actual camera fields with the fighters' plane.
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

/** The match HUD's panels reach 0.139 up the 0.6-high screen (src/game/ui/matchHud.ts). */
const HUD_TOP_ROW = 1 - 0.139 / 0.6;
type Point = readonly [x: number, y: number, z: number];

/**
 * Where an arena point shows in the frame of the camera a client set, as
 * fractions of the frame's width and height from its top left. The ground is
 * level, so the camera's target is its z offset above the ground, FLOOR_HEIGHT
 * below the floor. The clients run 16:9 and Warcraft spreads the field of
 * view across the width, as wisp:scripts/wisp/visibility.ts frames a camera.
 */
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
  // The underside's front edge where it is nearest the fighter.
  const undersideNear = ([x]: Point): Point => [Math.min(Math.max(x, underside.endX), underside.startX), -MAIN_DECK_HALF_DEPTH, MAIN_DECK_UNDERSIDE_Z];
  // Beside a wall, 12 outside it as a fighter stands against it; under the underside, down to the blast zone.
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
  // The other fighter: KO'd, on the main deck, on a raised deck, high, at the top blast zone, far to a side.
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

test("the underside scenario holds a fighter under the main deck, shown above the HUD with the underside, through fresh's frame 30 [spec #57]", () => {
  const clients = headless.clients({ start: startDevelopment, install: installDevelopment }, [0]);
  clients.start();
  clients.frames(30);
  const client = clients.clients[0];
  const camera = client === undefined ? undefined : cameras.get(client);
  if (client === undefined || camera === undefined) throw new Error("missing client");
  let origin = { x: 0, y: 0 };
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 2);
    selectCharacter(s.game, 0, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    // Final Destination's reference underside, which these checks measure.
    selectStage(s.game, 0, 0);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    initializeScenario("underside", s.game, s.world);
    origin = s.origin;
  });
  clients.frames(30);
  client.run(() => {
    const { motion, status } = fighterAt(shell().world, 0);
    expect([motion.x, motion.z, status.frozenFrames > 0]).toEqual([520, MAIN_DECK_UNDERSIDE_Z, true]);
  });
  // The underside's right end, and the fighter's feet.
  const shown: Point[] = [[371, -MAIN_DECK_HALF_DEPTH, MAIN_DECK_UNDERSIDE_Z], [520, 0, MAIN_DECK_UNDERSIDE_Z]];
  for (const { column, row } of shown.map((point) => framePoint(camera, origin, point))) {
    expect(column).toBeGreaterThan(0);
    expect(column).toBeLessThan(1);
    expect(row).toBeGreaterThan(0);
    expect(row).toBeLessThan(HUD_TOP_ROW);
  }
});

/** Whether a point lies inside the main deck: between its floor and its walls and underside (even-odd crossings). */
function insideMainDeck(x: number, z: number): boolean {
  const edges = Array.from({ length: MAIN_DECK_BODY_SURFACES }, (_, index): readonly [number, number, number, number] => {
    const line = solidSurfaceAt(0, index);
    return [line.startX, line.startZ, line.endX, line.endZ];
  });
  // The floor closes the outline between the two ledges.
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
  // The ECB as collision uses it: the position up to the top, the 2-unit flank each side.
  const ecbInside = (x: number, z: number) =>
    [x - flank, x, x + flank].some((px) => [z, z + top / 2, z + top - 0.5].some((pz) => insideMainDeck(px, pz)));
  client.run(() => {
    const s = shell();
    setParticipants(s.game, 1, 2);
    selectCharacter(s.game, 0, Character.rifleman);
    expect(requestStageSelect(s.game, 0)).toBe(true);
    // Final Destination's reference underside, which these checks measure.
    selectStage(s.game, 0, 0);
    expect(requestStart(s.game, 0)).toBe(true);
    startMatch(s);
    initializeScenario("underside", s.game, s.world);
  });
  clients.frames(30);
  client.run(() => {
    const fighter = fighterAt(shell().world, 0);
    // Frozen beside the deck's lower right corner: none of its ECB is inside the deck.
    expect(ecbInside(fighter.motion.x, fighter.motion.z)).toBe(false);
    // Thawed under the underside's middle, its top 3 under it, and launched up into it.
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
    // On the contact frame.
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
