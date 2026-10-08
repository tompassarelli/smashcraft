import { expect, test } from "bun:test";
import { MAIN_DECK_HALF_DEPTH, STAGE_PALETTE_TEXTURE, type DeckFace, type OutlinePoint, mainDeckFaces, mainDeckMdl, mainDeckModelFile, mainDeckOutlineStage, paletteTexture } from "../scripts/stageDeck";
import { STAGE_DECK_MODELS, STAGE_LIGHT_MODELS, STAGE_MAIN_DECK_MODEL, STAGE_POINT_LIGHT_MODELS } from "../src/game/assets/stageAssetInfo";
import { STAGE_LIGHTS } from "../src/game/assets/stageLighting";
import { STAGE_POINT_LIGHTS } from "../src/game/assets/stagePointLights";
import { stageLightMdl, stageLightModelFile, stagePointLightMdl, stagePointLightModelFile } from "../scripts/stageLight";
import { LAVA_GLOW, LIQUID_TEXTURE_SIZE, STOCK_BLOOM_THRESHOLD, lavaGlowTexel, liquidTexel } from "../scripts/stageLiquid";
import { luma } from "../src/game/assets/stagePalette";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { pointLightPieces, shadowCastingLights, stageScenery } from "../src/game/presentation/stageScenery";
import { STAGE_DECK_PALETTES } from "../src/game/assets/stagePalette";
import { CANNON_TEST_STAGE, HELLFIRE_STAGE, PATTERNED_DECKS_STAGE, MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckZ, solidSurfaceAt, solidSurfaceCount, surfaceLine } from "../src/game/sim/stage";

/** The stages whose main deck has walls and an underside, each drawn from its own outline. */
const SHIPPED_STAGES = [1, ...STAGE_DECK_PALETTES.map(({ stage }) => stage).filter((stage) => solidSurfaceCount(stage) > 0)];
/** The neutral main deck model, which stages without a profile of their own draw. */
const MAIN_DECK = mainDeckFaces(0);

/** The main deck's collision corners on `stage`, from its left ledge along the walking line, then down its walls and underside, in model units. */
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

/**
 * The front faces' outline, from the edges that only one front face has,
 * walked from `start` against the faces' winding (clockwise, as the
 * collision lines run) with straight runs joined into one line.
 */
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
  // Clockwise: each outline edge reversed, keyed by where it starts.
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

/** The area inside a closed outline. */
const area = (points: readonly OutlinePoint[]) => Math.abs(points.reduce((sum, [x, z], index) => {
  const [nextX, nextZ] = points[(index + 1) % points.length] ?? [x, z];
  return sum + x * nextZ - nextX * z;
}, 0)) / 2;

test("the map ships the main deck model drawn from the collision [invariant]", () => {
  expect(STAGE_MAIN_DECK_MODEL).toBe(`war3mapImported\\${mainDeckModelFile(mainDeckMdl(MAIN_DECK, STAGE_PALETTE_TEXTURE.name))}`);
  for (const { stage, palette } of STAGE_DECK_PALETTES) {
    expect(STAGE_DECK_MODELS[stage]?.main).toBe(`war3mapImported\\${mainDeckModelFile(mainDeckMdl(mainDeckFaces(mainDeckOutlineStage(stage)), paletteTexture(palette).name))}`);
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
    // The front faces fill the outline once: no gaps, no overlaps.
    const fronts = faces.filter(({ normal }) => normal[1] === -1).map(({ corners: points }) => points.map(([x, , z]): OutlinePoint => [x, z]));
    expect(fronts.reduce((sum, face) => sum + area(face), 0)).toBeCloseTo(area(corners), 2);
    // Each collision line is drawn through the deck's depth, facing out along its normal.
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
    // Newell's normal of the polygon as wound.
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

test("each stage's shipped lighting model is the one its light declares [invariant]", () => {
  for (const { stage, theme, light } of STAGE_LIGHTS) {
    expect(STAGE_LIGHT_MODELS[stage], theme).toBe(`war3mapImported\\${stageLightModelFile(stageLightMdl(light))}`);
  }
});

// #292, Blackrock: forge-fire omni lights (visual-quality.md, "Levers worth using, per stage").
test("Blackrock's forge fires carry two warm omni lights, one shadow-casting, that fade out far behind the fight [spec #292]", () => {
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === CANNON_TEST_STAGE)?.lights ?? [];
  expect(lights.map(({ x, y, z, color, intensity, flicker, loopMs, radius, castsShadow }) => `${x},${y},${z} ${color.join(",")}@${intensity}±${flicker}/${loopMs}ms r${radius}${castsShadow ? " shadow" : ""}`)).toEqual([
    "-2100,4600,-1250 255,150,70@1.25±0.125/1600ms r1100 shadow",
    "2050,6000,-1300 255,132,56@0.875±0.125/2100ms r900",
  ]);
  // stage-art.md, "light the play, not the backdrop": the fighting volume (y within 200 of the plane) stays outside every light by 3,000 units, so no fighter is tinted toward the ember ring.
  for (const light of lights) expect(light.y - light.radius - 200).toBeGreaterThan(3000);
  // Each light sits on one of the stage's fire pieces, within 300 units.
  const fires = stageScenery(CANNON_TEST_STAGE).pieces.filter(({ model }) => model.includes("Fire"));
  for (const light of lights) expect(fires.some((fire) => Math.hypot(fire.x - light.x, fire.y - light.y, fire.z - light.z) <= 300)).toBe(true);
  // Rule 8: the flicker loops slower than once a second, far below three flashes a second.
  for (const light of lights) expect(light.loopMs).toBeGreaterThanOrEqual(1000);
  expect(shadowCastingLights(CANNON_TEST_STAGE)).toBe(1);
  for (const { id } of STAGE_CATALOG) if (!STAGE_POINT_LIGHTS.some(({ stage }) => stage === id)) expect(pointLightPieces(id)).toEqual([]);
});

test("Hellfire recesses fel flames and green lights into haze under the stock Outland sky [spec #293]", () => {
  const scenery = stageScenery(HELLFIRE_STAGE);
  expect(scenery.sky).toBe("Environment\\Sky\\Outland_Sky\\Outland_Sky.mdl");
  expect(scenery.fog).toEqual({ start: 5000, end: 11000, red: 0.25, green: 0.5, blue: 0.125 });
  const gate = scenery.pieces.find(({ model }) => model.includes("DemonGate"));
  expect([gate?.x, gate?.y, gate?.scale]).toEqual([-1450, 6000, 1.25]);
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === HELLFIRE_STAGE)?.lights ?? [];
  expect(lights.map(({ x, y, z, color, intensity, flicker, loopMs, radius, castsShadow }) => `${x},${y},${z} ${color.join(",")}@${intensity}±${flicker}/${loopMs}ms r${radius}${castsShadow ? " shadow" : ""}`)).toEqual([
    "-1450,6000,-1400 96,255,40@0.875±0.125/2400ms r950 shadow",
    "2150,3700,-1450 80,255,32@0.625±0.125/2800ms r450",
  ]);
  const flames = scenery.pieces.filter(({ model }) => model.includes("ImmolationTarget"));
  expect(flames.map(({ scale }) => scale)).toEqual([0.75, 0.5]);
  for (const light of lights) {
    expect(light.y - light.radius - 200).toBeGreaterThan(3000);
    expect(flames.some(({ x, y, z }) => x === light.x && y === light.y && z === light.z)).toBe(true);
  }
  expect(shadowCastingLights(HELLFIRE_STAGE)).toBe(1);
});

test("Naxxramas's cold green light frames the necropolis with one shadow and leaves fighters outside its reach [spec #296]", () => {
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === PATTERNED_DECKS_STAGE)?.lights ?? [];
  expect(lights.map(({ x, y, z, color, intensity, flicker, loopMs, radius, castsShadow }) => `${x},${y},${z} ${color.join(",")}@${intensity}±${flicker}/${loopMs}ms r${radius}${castsShadow ? " shadow" : ""}`)).toEqual([
    "1450,6000,-900 96,220,168@0.875±0/2400ms r1400 shadow",
  ]);
  expect(shadowCastingLights(PATTERNED_DECKS_STAGE)).toBe(1);
  for (const light of lights) expect(light.y - light.radius - 200).toBeGreaterThan(3000);
  expect(stageScenery(PATTERNED_DECKS_STAGE).fog).toEqual({ start: 5000, end: 11000, red: 0.25, green: 0.5, blue: 0.625 });
  const scenery = stageScenery(PATTERNED_DECKS_STAGE).pieces;
  expect(scenery.filter(({ model }) => model.includes("NaxxDeco")).map(({ x, y, z, scale }) => [x, y, z, scale])).toEqual([[1700, 5900, -1250, 0.5]]);
  expect(scenery.filter(({ model }) => model.includes("Necropolis")).map(({ x, y }) => [x, y])).toEqual([[1450, 6200]]);
});

test("Stratholme keeps its cathedral against the fall sky and limits warm lights to town fires [spec #297]", () => {
  const scenery = stageScenery(6);
  expect(scenery.sky).toBe("Environment\\Sky\\LordaeronFallSky\\LordaeronFallSky.mdx");
  expect(scenery.fog).toEqual({ start: 5000, end: 11000, red: 0.5, green: 0.28125, blue: 0.1875 });
  const cathedral = scenery.pieces.find(({ model }) => model.includes("CathedralRuined"));
  expect(cathedral?.x).toBe(1500);
  expect(cathedral?.y).toBe(6200);
  const city = scenery.pieces.filter(({ model }) => model.includes("LordaeronFall"));
  expect(city.map(({ x, y, z, scale, yaw }) => [x, y, z, scale, yaw])).toEqual([[-1600, 7600, -1800, 2, 270]]);
  const lights = STAGE_POINT_LIGHTS.find(({ stage }) => stage === 6)?.lights ?? [];
  expect(lights.map(({ x, y, z, color, intensity, radius }) => [x, y, z, color, intensity, radius])).toEqual([
    [1250, 6000, -900, [255, 150, 70], 1.25, 1100],
    [-2250, 2650, -1000, [255, 132, 56], 0.875, 900],
  ]);
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

// #292: lava blooms under the map-wide post-processing (#288) through its crest glow; the body, decks and fighters stay below the threshold.
test("Blackrock's lava glows above the bloom threshold only on its crests [spec #292]", () => {
  expect(`${LAVA_GLOW.color.join(",")} from ${LAVA_GLOW.crest}`).toBe("255,196,96 from 0.8");
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
  // The crest peak clears even a threshold raised to 0.9.
  expect(peak).toBeGreaterThan(0.9 * 255);
  expect(glowing / texels).toBeGreaterThan(0.05);
  expect(glowing / texels).toBeLessThan(0.3);
});
