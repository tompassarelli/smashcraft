import { expect, test } from "bun:test";
import { MAIN_DECK_HALF_DEPTH, type DeckFace, type OutlinePoint, mainDeckFaces, mainDeckMdl, mainDeckModelFile, mainDeckOutlineStage, paletteTexture } from "../scripts/stageDeck";
import { STAGE_DECK_MODELS, STAGE_MAIN_DECK_MODEL, STAGE_POINT_LIGHT_MODELS } from "../src/game/assets/stageAssetInfo";
import { STAGE_SKY_MODELS } from "../src/game/assets/stageSkyInfo";
import { STAGE_SKIES } from "../scripts/stageSky";
import { STAGE_POINT_LIGHTS } from "../src/game/assets/stagePointLights";
import { stagePointLightMdl, stagePointLightModelFile } from "../scripts/stageLight";
import { LIQUID_TEXTURE_SIZE, STOCK_BLOOM_THRESHOLD, lavaGlowTexel, liquidTexel } from "../scripts/stageLiquid";
import { luma } from "../src/game/assets/stagePalette";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { pointLightPieces, shadowCastingLights, stageScenery } from "../src/game/presentation/stageScenery";
import { STAGE_DECK_PALETTES } from "../src/game/assets/stagePalette";
import { platformDeckFaces, texturedDeckMdl } from "../scripts/stageMaterials";
import { parseMDL } from "war3-model";
import { ARENA_CAMERA, cameraFieldOfView, extremeCamera } from "../src/game/presentation/arenaCamera";
import { createMatchCamera, MATCH_CAMERA_ASPECT } from "../src/game/sim/matchCamera";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { CANNON_TEST_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckZ, solidSurfaceAt, solidSurfaceCount, surfaceLine } from "../src/game/sim/stage";


const SHIPPED_STAGES = [1, ...STAGE_DECK_PALETTES.map(({ stage }) => stage).filter((stage) => solidSurfaceCount(stage) > 0)];


function collisionCorners(stage: number): OutlinePoint[] {
  const left = mainDeckLeft(stage);
  const center = (left + mainDeckRight(stage)) / 2;
  const floor = mainDeckZ(stage);
  const walkingLine = surfaceLine(stage, 0);
  const corners: OutlinePoint[] = walkingLine === undefined
    ? [[left - center, 0]]
    : walkingLine.xs.slice(0, -1).map((x, index) => [x - center, (walkingLine.zs[index] ?? Number.NaN) - floor]);
  for (let index = 0; index < MAIN_DECK_BODY_SURFACES; index++) {
    const line = solidSurfaceAt(stage, index);
    corners.push([line.startX - center, line.startZ - floor]);
  }
  return corners;
}

const key = ([x, z]: OutlinePoint) => `${x},${z}`;






function frontOutline(faces: readonly DeckFace[], start: OutlinePoint): OutlinePoint[] {
  const edges = new Map<string, { readonly from: OutlinePoint; readonly to: OutlinePoint }>();
  for (const { normal, corners } of faces) {
    if (normal[0] !== 0 || normal[1] !== -1 || normal[2] !== 0) continue;
    corners.forEach(([x, , z], index) => {
      const next = corners[(index + 1) % corners.length] ?? corners[0];
      if (next === undefined) return;
      const from: OutlinePoint = [x, z];
      const to: OutlinePoint = [next[0], next[2]];
      const reverse = `${key(to)}>${key(from)}`;
      if (edges.has(reverse)) edges.delete(reverse);
      else edges.set(`${key(from)}>${key(to)}`, { from, to });
    });
  }

  const after = new Map([...edges.values()].map(({ from, to }) => [key(to), from]));
  const points: OutlinePoint[] = [start];
  for (let point = after.get(key(start)); point !== undefined && key(point) !== key(start); point = after.get(key(point))) {
    if (points.length > edges.size) throw new Error("the front faces' outline does not close");
    points.push(point);
  }
  return points.filter((point, index) => {
    const before = points[(index + points.length - 1) % points.length] ?? point;
    const next = points[(index + 1) % points.length] ?? point;
    const turn = (point[0] - before[0]) * (next[1] - point[1]) - (point[1] - before[1]) * (next[0] - point[0]);
    return Math.abs(turn) > 1e-6 * Math.hypot(point[0] - before[0], point[1] - before[1]) * Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
}


const area = (points: readonly OutlinePoint[]) => Math.abs(points.reduce((sum, [x, z], index) => {
  const [nextX, nextZ] = points[(index + 1) % points.length] ?? [x, z];
  return sum + x * nextZ - nextX * z;
}, 0)) / 2;

test("the map ships the main deck model drawn from the collision [invariant]", () => {
  expect(STAGE_MAIN_DECK_MODEL).toBe(STAGE_DECK_MODELS[0]?.main);
  for (const { stage, palette, materials } of STAGE_DECK_PALETTES) {
    const faces = mainDeckFaces(mainDeckOutlineStage(stage));
    const mdl = materials === undefined ? mainDeckMdl(faces, paletteTexture(palette).name) : texturedDeckMdl(faces, materials, palette);
    expect(STAGE_DECK_MODELS[stage]?.main).toBe(`war3mapImported\\${mainDeckModelFile(mdl)}`);
  }
});

test("the main deck model's outline is the main deck's collision lines on every shipped stage [invariant]", () => {
  for (const stage of SHIPPED_STAGES) {
    const corners = collisionCorners(stage);
    const [ledge] = corners;
    if (ledge === undefined) throw new Error(`stage ${stage} has no main deck`);
    const faces = mainDeckFaces(stage);
    const outline = frontOutline(faces, ledge);
    expect(outline.length).toBe(corners.length);
    outline.forEach(([x, z], index) => {
      expect(x).toBeCloseTo(corners[index]?.[0] ?? Number.NaN, 3);
      expect(z).toBeCloseTo(corners[index]?.[1] ?? Number.NaN, 3);
    });

    const fronts = faces.filter(({ normal }) => normal[1] === -1).map(({ corners: points }) => points.map(([x, , z]): OutlinePoint => [x, z]));
    expect(fronts.reduce((sum, face) => sum + area(face), 0)).toBeCloseTo(area(corners), 2);

    for (let index = 0; index < MAIN_DECK_BODY_SURFACES; index++) {
      const line = solidSurfaceAt(stage, index);
      const center = (mainDeckLeft(stage) + mainDeckRight(stage)) / 2;
      const floor = mainDeckZ(stage);
      const front = [[line.startX - center, -MAIN_DECK_HALF_DEPTH, line.startZ - floor], [line.endX - center, -MAIN_DECK_HALF_DEPTH, line.endZ - floor]];
      const side = faces.find(({ corners: points }) => JSON.stringify(points.slice(0, 2)) === JSON.stringify(front));
      expect(side?.normal).toEqual([line.normalX, 0, line.normalZ]);
      expect(side?.corners.map(([, y]) => y)).toEqual([-MAIN_DECK_HALF_DEPTH, -MAIN_DECK_HALF_DEPTH, MAIN_DECK_HALF_DEPTH, MAIN_DECK_HALF_DEPTH]);
    }
  }
});

test("every face of the main deck faces out along its normal, so Warcraft draws it from outside [invariant]", () => {
  for (const { normal, corners } of SHIPPED_STAGES.flatMap((stage) => mainDeckFaces(stage))) {

    const wound = [0, 0, 0];
    corners.forEach(([x, y, z], index) => {
      const [nextX, nextY, nextZ] = corners[(index + 1) % corners.length] ?? [x, y, z];
      wound[0] += (y - nextY) * (z + nextZ);
      wound[1] += (z - nextZ) * (x + nextX);
      wound[2] += (x - nextX) * (y + nextY);
    });
    expect(wound[0] * normal[0] + wound[1] * normal[1] + wound[2] * normal[2]).toBeGreaterThan(0);
  }
});


test("Blackrock's forge fires carry two warm omni lights, one shadow-casting, that fade out far behind the fight [spec #292]", () => {
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === CANNON_TEST_STAGE)?.lights ?? [];
  expect(lights).toHaveLength(2);
  for (const { color: [red, green, blue] } of lights) expect(red > green && green > blue).toBe(true);

  for (const light of lights) expect(light.y - light.radius - 200).toBeGreaterThan(3000);

  const fires = stageScenery(CANNON_TEST_STAGE).pieces.filter(({ model }) => model.includes("Fire"));
  for (const light of lights) expect(fires.some((fire) => Math.hypot(fire.x - light.x, fire.y - light.y, fire.z - light.z) <= 300)).toBe(true);

  for (const light of lights) expect(light.loopMs).toBeGreaterThanOrEqual(1000);
  expect(shadowCastingLights(CANNON_TEST_STAGE)).toBe(1);
  for (const { id } of STAGE_CATALOG) if (!STAGE_POINT_LIGHTS.some(({ stage }) => stage === id)) expect(pointLightPieces(id)).toEqual([]);
});

test("Hellfire recesses fel flames and green lights into haze under the stock Outland sky [spec #293]", () => {
  const scenery = stageScenery(HELLFIRE_STAGE);
  expect(scenery.sky).toContain("Outland_Sky");
  const fog = scenery.fog;
  if (fog === undefined) throw new Error("Hellfire has no haze");
  expect(fog.green > fog.red && fog.green > fog.blue).toBe(true);
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === HELLFIRE_STAGE)?.lights ?? [];
  expect(lights.length).toBeGreaterThan(0);
  for (const { color: [red, green, blue] } of lights) expect(green > red && green > blue).toBe(true);
  const flames = scenery.pieces.filter(({ model }) => model.includes("ImmolationTarget"));
  for (const light of lights) {
    expect(light.y - light.radius - 200).toBeGreaterThan(3000);
    expect(flames.some(({ x, y, z }) => x === light.x && y === light.y && z === light.z)).toBe(true);
  }
  expect(shadowCastingLights(HELLFIRE_STAGE)).toBe(1);
});

test("Hellfire's fel trim uses neutral stock runes with a green tint even without scene lighting [repro #293]", () => {
  const deck = STAGE_DECK_PALETTES.find(({ stage }) => stage === HELLFIRE_STAGE);
  if (deck?.materials === undefined) throw new Error("Hellfire has no stock materials");
  const model = parseMDL(texturedDeckMdl(mainDeckFaces(HELLFIRE_STAGE), deck.materials, deck.palette));
  expect(model.Textures[1]?.Image).toBe("Textures\\DemonRune1.blp");
  const tint = model.GeosetAnims[1]?.Color;
  if (!(tint instanceof Float32Array)) throw new Error("Hellfire's trim has no static tint");
  expect(tint[1]).toBeGreaterThan(2 * (tint[0] ?? 0));
  expect(tint[1]).toBeGreaterThan(2 * (tint[2] ?? 0));
  expect(model.Materials[1]?.Layers[0]?.Shading).toBe(1);
  const uv = model.Geosets[0]?.TVertices[0];
  if (uv === undefined) throw new Error("Hellfire's top has no tile coordinates");
  for (let i = 0; i < uv.length; i += 2) {
    expect(uv[i]).toBeLessThanOrEqual(64 / 512);
    expect(uv[i + 1]).toBeLessThanOrEqual(64 / 256);
  }
});

test("Hellfire's Demon Gate clears the deck on the left third at the far camera [repro #191]", () => {
  const gate = stageScenery(HELLFIRE_STAGE).pieces.find(({ model }) => model.includes("DemonGate"));
  if (gate === undefined) throw new Error("Hellfire has no Demon Gate");
  const camera = createMatchCamera();
  extremeCamera(camera, HELLFIRE_STAGE, MATCH_CAMERA_ASPECT, "far");
  const angle = 10 * Math.PI / 180;
  const dz = gate.z - camera.z;
  const depth = camera.distance + gate.y * Math.cos(angle) - dz * Math.sin(angle);
  const column = 0.5 + (gate.x - camera.x) / (2 * depth * camera.tangent * MATCH_CAMERA_ASPECT);
  const row = 0.5 - (dz * Math.cos(angle) + gate.y * Math.sin(angle)) / (2 * depth * camera.tangent);
  expect(depth).toBeLessThan(ARENA_CAMERA.farZ);
  expect(column).toBeGreaterThan(0);
  expect(column).toBeLessThan(1 / 3);
  expect(row).toBeGreaterThan(0);
  const deckDz = mainDeckZ(HELLFIRE_STAGE) - camera.z;
  const deckDepth = camera.distance - deckDz * Math.sin(angle);
  const deckRow = 0.5 - deckDz * Math.cos(angle) / (2 * deckDepth * camera.tangent);
  expect(row).toBeLessThan(deckRow);
});

test("World Tree and aviary stay inside the far clip, and the aviary roof clears the deck on the right third [repro #191]", () => {
  const tilt = 10 * Math.PI / 180;
  for (const stage of [10, 11]) {
    const landmark = stageScenery(stage).pieces[0];
    if (landmark === undefined) throw new Error(`stage ${stage} has no landmark`);
    const camera = createMatchCamera();
    extremeCamera(camera, stage, MATCH_CAMERA_ASPECT, "far");
    const distance = Math.hypot(landmark.x - camera.x, landmark.y + camera.distance * Math.cos(tilt), landmark.z - camera.z - camera.distance * Math.sin(tilt));
    expect(distance, landmark.model).toBeLessThan(ARENA_CAMERA.farZ);
    if (stage !== 11) continue;
    const bounds = MODEL_FACTS[landmark.model]?.bounds;
    if (bounds === undefined) throw new Error("aviary has no measured model bounds");
    const roof = landmark.z + landmark.scale * bounds.max[2];
    const dz = roof - camera.z;
    const depth = camera.distance + landmark.y * Math.cos(tilt) - dz * Math.sin(tilt);
    const column = 0.5 + landmark.x / (2 * depth * camera.tangent * MATCH_CAMERA_ASPECT);
    const row = 0.5 - (dz * Math.cos(tilt) + landmark.y * Math.sin(tilt)) / (2 * depth * camera.tangent);
    const deckDepth = camera.distance + camera.z * Math.sin(tilt);
    const deckRow = 0.5 + camera.z * Math.cos(tilt) / (2 * deckDepth * camera.tangent);
    expect(column).toBeGreaterThan(2 / 3);
    expect(column).toBeLessThan(1);
    expect(row).toBeGreaterThan(0);
    expect(row).toBeLessThan(deckRow);
  }
});

test("Hellfire and Naxxramas rock bases extend below the wide far capture [repro #191]", () => {
  const aspect = 2560 / 1080;
  const tilt = 10 * Math.PI / 180;
  for (const stage of [HELLFIRE_STAGE, PATTERNED_DECKS_STAGE]) {
    const camera = createMatchCamera();
    extremeCamera(camera, stage, aspect, "far");
    const tangent = Math.tan(cameraFieldOfView(camera, aspect) * Math.PI / 360);
    for (const piece of stageScenery(stage).pieces.filter(({ model }) => /Barrens_Rocks0|Glacier5|IceCrownObelisk1/.test(model))) {
      const bounds = MODEL_FACTS[piece.model]?.bounds;
      if (bounds === undefined) throw new Error(`missing rock bounds: ${piece.model}`);
      const z = piece.z + bounds.min[2] * piece.scale * (piece.matrixScale?.[2] ?? 1);
      const dz = z - camera.z;
      const depth = camera.distance + piece.y * Math.cos(tilt) - dz * Math.sin(tilt);
      const row = 0.5 - (dz * Math.cos(tilt) + piece.y * Math.sin(tilt)) / (2 * depth * tangent);
      expect(row, `rock at ${piece.x},${piece.y}`).toBeGreaterThan(1);
    }
  }
});

test("Naxxramas's Necropolis clears the deck on the right third at both far camera widths [repro #191]", () => {
  const citadel = stageScenery(PATTERNED_DECKS_STAGE).pieces.find(({ model }) => model.includes("Necropolis"));
  if (citadel === undefined) throw new Error("missing Naxxramas necropolis");
  const tilt = 10 * Math.PI / 180;
  for (const aspect of [MATCH_CAMERA_ASPECT, 2560 / 1080]) {
    const camera = createMatchCamera();
    extremeCamera(camera, PATTERNED_DECKS_STAGE, aspect, "far");
    const dz = citadel.z - camera.z;
    const depth = camera.distance + citadel.y * Math.cos(tilt) - dz * Math.sin(tilt);
    const column = 0.5 + (citadel.x - camera.x) / (2 * depth * camera.tangent * aspect);
    const row = 0.5 - (dz * Math.cos(tilt) + citadel.y * Math.sin(tilt)) / (2 * depth * camera.tangent);
    const deckDz = mainDeckZ(PATTERNED_DECKS_STAGE) - camera.z;
    const deckDepth = camera.distance - deckDz * Math.sin(tilt);
    const deckRow = 0.5 - deckDz * Math.cos(tilt) / (2 * deckDepth * camera.tangent);
    expect(depth).toBeLessThan(ARENA_CAMERA.farZ);
    expect(column).toBeGreaterThan(2 / 3);
    expect(column).toBeLessThan(1);
    expect(row).toBeGreaterThan(0);
    expect(row).toBeLessThan(deckRow);
  }
});

test("Naxxramas's cold green light frames the necropolis with one shadow and leaves fighters outside its reach [spec #296]", () => {
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === PATTERNED_DECKS_STAGE)?.lights ?? [];
  expect(lights).toHaveLength(1);
  for (const { color: [red, green, blue] } of lights) expect(green > red && blue > red).toBe(true);
  expect(shadowCastingLights(PATTERNED_DECKS_STAGE)).toBe(1);
  for (const light of lights) expect(light.y - light.radius - 200).toBeGreaterThan(3000);
  const scenery = stageScenery(PATTERNED_DECKS_STAGE).pieces;
  const citadel = scenery.find(({ model }) => model.includes("Necropolis"));
  expect(citadel).toBeDefined();
  if (citadel === undefined) throw new Error("missing Naxxramas necropolis");
  for (const light of lights) expect(Math.hypot(citadel.x - light.x, citadel.y - light.y, citadel.z - light.z)).toBeLessThan(light.radius);
});

test("Stratholme keeps its cathedral against a dark dusk horizon and limits warm lights to town fires [spec #297]", () => {
  const scenery = stageScenery(6);
  expect(scenery.sky).toBe(STAGE_SKY_MODELS[6]);
  const horizon = STAGE_SKIES.find(({ stage }) => stage === 6)?.horizon;
  if (horizon === undefined) throw new Error("Stratholme has no dusk horizon");
  expect(luma(horizon)).toBeLessThan(0.5 * 255);
  const cathedral = scenery.pieces.find(({ model }) => model.includes("CathedralRuined"));
  if (cathedral === undefined) throw new Error("missing Stratholme cathedral");
  for (const view of ["near", "far"] as const) {
    const camera = createMatchCamera();
    extremeCamera(camera, 6, MATCH_CAMERA_ASPECT, view);
    const tilt = 10 * Math.PI / 180;
    const distance = Math.hypot(cathedral.x - camera.x, cathedral.y + camera.distance * Math.cos(tilt), cathedral.z - camera.z - camera.distance * Math.sin(tilt));
    expect(distance, view).toBeLessThan(7500);
  }
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === 6)?.lights ?? [];
  expect(lights.length).toBeGreaterThan(0);
  for (const { color: [red, green, blue] } of lights) expect(red > green && green > blue).toBe(true);
  const fires = scenery.pieces.filter(({ model }) => model.includes("TownBurningFireEmitter"));
  for (const light of lights) {
    expect(fires.some(fire => fire.x === light.x && fire.y === light.y && fire.z === light.z)).toBe(true);
    expect(light.y - light.radius - 200).toBeGreaterThan(1500);
    expect(light.loopMs).toBeGreaterThanOrEqual(1000);
  }
  expect(shadowCastingLights(6)).toBe(1);
});

test("the map ships each point light model its light declares [invariant]", () => {
  for (const { stage, lights } of STAGE_POINT_LIGHTS) {
    expect(STAGE_POINT_LIGHT_MODELS[stage]).toEqual(lights.map((light) => `war3mapImported\\${stagePointLightModelFile(stagePointLightMdl(light))}`));
  }
  expect(pointLightPieces(CANNON_TEST_STAGE).map(({ model }) => model)).toEqual([...(STAGE_POINT_LIGHT_MODELS[CANNON_TEST_STAGE] ?? [])]);
});


test("Blackrock's lava glows above the bloom threshold only on its crests [spec #292]", () => {
  const threshold = STOCK_BLOOM_THRESHOLD * 255;
  let bodyMax = 0;
  let glowing = 0;
  let peak = 0;
  const texels = LIQUID_TEXTURE_SIZE * LIQUID_TEXTURE_SIZE;
  for (let y = 0; y < LIQUID_TEXTURE_SIZE; y++) for (let x = 0; x < LIQUID_TEXTURE_SIZE; x++) {
    const [r, g, b] = liquidTexel("Lava", x, y);
    const [gr, gg, gb, ga] = lavaGlowTexel(x, y);
    bodyMax = Math.max(bodyMax, luma([r, g, b]));
    const lit = luma([Math.min(255, r + gr * ga / 255), Math.min(255, g + gg * ga / 255), Math.min(255, b + gb * ga / 255)]);
    peak = Math.max(peak, lit);
    if (lit > threshold) glowing++;
  }
  expect(bodyMax).toBeLessThan(threshold);

  expect(peak).toBeGreaterThan(0.9 * 255);
  expect(glowing / texels).toBeGreaterThan(0.05);
  expect(glowing / texels).toBeLessThan(0.3);
});

test("Naxxramas patrol tops and front bodies carry distinct green and blue hues [repro #276]", () => {
  const deck = STAGE_DECK_PALETTES.find(entry => entry.stage === PATTERNED_DECKS_STAGE);
  if (deck?.materials?.alternatePlatform === undefined) throw new Error("Naxxramas has no second patrol material");
  const green = parseMDL(texturedDeckMdl(platformDeckFaces(), deck.materials.platform, deck.palette));
  const blue = parseMDL(texturedDeckMdl(platformDeckFaces(), deck.materials.alternatePlatform, deck.palette));
  for (const part of [0, 2]) {
    const greenTint = green.GeosetAnims[part]?.Color;
    const blueTint = blue.GeosetAnims[part]?.Color;
    if (!(greenTint instanceof Float32Array) || !(blueTint instanceof Float32Array)) throw new Error("patrol face has no static tint");
    expect(greenTint[1]).toBeGreaterThan(1.5 * (greenTint[0] ?? 0));
    expect(greenTint[1]).toBeGreaterThan(1.5 * (greenTint[2] ?? 0));
    expect(blueTint[2]).toBeGreaterThan(1.5 * (blueTint[1] ?? 0));
    expect(blueTint[2]).toBeGreaterThan(1.5 * (blueTint[0] ?? 0));
  }
});

test("Tomb's carved platform face maps a complete brick cell rather than its bottom sliver [repro #276]", () => {
  const deck = STAGE_DECK_PALETTES.find(entry => entry.stage === 7);
  if (deck?.materials === undefined) throw new Error("Tomb has no stock materials");
  const model = parseMDL(texturedDeckMdl(platformDeckFaces(), deck.materials.platform, deck.palette));
  const body = model.Geosets[2];
  if (body === undefined) throw new Error("Tomb has no platform body");
  const heights = Array.from(body.Vertices).filter((_, index) => index % 3 === 2);
  const uv = body.TVertices[0];
  if (uv === undefined) throw new Error("Tomb has no platform texture coordinates");
  for (const height of [Math.min(...heights), Math.max(...heights)]) {
    const atHeight = heights.flatMap((z, index) => z === height && Math.abs(body.Normals[index * 3 + 2] ?? 0) < 0.5 ? [uv[index * 2 + 1] ?? Number.NaN] : []);
    expect(Math.max(...atHeight) - Math.min(...atHeight)).toBeLessThan(0.00001);
    expect(atHeight[0]).toBeCloseTo(height === Math.min(...heights) ? 0 : 0.25, 5);
  }
});
