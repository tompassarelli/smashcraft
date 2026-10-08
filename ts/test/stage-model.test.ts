import { expect, test } from "bun:test";
import { MAIN_DECK_HALF_DEPTH, STAGE_PALETTE_TEXTURE, type DeckFace, type OutlinePoint, mainDeckFaces, mainDeckMdl, mainDeckModelFile, mainDeckOutlineStage, paletteTexture } from "../scripts/stageDeck";
import { STAGE_DECK_MODELS, STAGE_LIGHT_MODELS, STAGE_MAIN_DECK_MODEL } from "../src/game/assets/stageAssetInfo";
import { STAGE_LIGHTS } from "../src/game/assets/stageLighting";
import { stageLightMdl, stageLightModelFile } from "../scripts/stageLight";
import { STAGE_DECK_PALETTES } from "../src/game/assets/stagePalette";
import { MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckZ, solidSurfaceAt, solidSurfaceCount, surfaceLine } from "../src/game/sim/stage";

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
