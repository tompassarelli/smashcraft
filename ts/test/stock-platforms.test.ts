import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { platformParts, type PlatformPart } from "../src/game/presentation/stockPlatforms";
import { deckModel, slabScale } from "../src/game/presentation/stagePreload";
import { HERO_REFERENCE_HEIGHT } from "../src/game/sim/heroMoves";
import { surfaceCount, surfaceLeft, surfaceRight, surfaceTopZ, surfaceZ } from "../src/game/sim/stage";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";
import { STAGE_DECK_MODEL } from "../src/game/assets/stageAssetInfo";

type Bounds = { readonly min: readonly number[]; readonly max: readonly number[] };

/**
 * Reforged and Definitive draw a stock path's HD file (`_hd.w3mod`, the same
 * bytes as `_de.w3mod`), whose geometry differs from the classic file that
 * MODEL_FACTS reads: these are its MODL extents, read from Warcraft 3.0.1's
 * CASC storage on 8 Oct 2026 (#322). Imported models draw one file in every mode.
 */
const HD_BOUNDS: Readonly<Record<string, Bounds>> = {
  "Doodads\\Northrend\\Water\\North_IceFloe3\\North_IceFloe3.mdx": { min: [-115.22, -129.81, -76.13], max: [116.05, 147.26, 60.67] },
  "Doodads\\Icecrown\\Rocks\\Ice_Rock\\Ice_Rock0.mdx": { min: [-61.33, -60.04, -16.0], max: [63.01, 63.84, 120.78] },
  "Doodads\\Icecrown\\Structures\\Icecrown_Rubble\\Icecrown_Rubble0.mdx": { min: [-51.53, -67.87, -1.82], max: [65.04, 66.45, 81.54] },
};

/** Each graphics mode's bounds for a model: classic, then HD when its stock HD file differs. */
function modeBounds(model: string): readonly Bounds[] {
  const classic = MODEL_FACTS[model]?.bounds;
  if (classic === undefined) throw new Error(`${model} has no model facts`);
  if (model.startsWith("war3mapImported\\")) return [classic];
  const hd = HD_BOUNDS[model];
  if (hd === undefined) throw new Error(`${model} is a stock model with no HD bounds`);
  return [classic, hd];
}

interface Drawn { readonly model: string; readonly left: number; readonly right: number; readonly bottom: number; readonly top: number }

/** A part's drawn box in the fighting plane, in stage units: its bounds scaled per model axis, turned by its yaw, then offset. */
function drawnBox(part: Readonly<PlatformPart>, bounds: Bounds, centerX: number, z: number): Drawn {
  const [sx, sy, sz] = part.scale;
  const turn = part.yaw * (Math.PI / 180);
  const xs = [bounds.min[0] ?? 0, bounds.max[0] ?? 0].flatMap((x) => [bounds.min[1] ?? 0, bounds.max[1] ?? 0].map((y) => x * sx * Math.cos(turn) - y * sy * Math.sin(turn)));
  const zs = [(bounds.min[2] ?? 0) * sz, (bounds.max[2] ?? 0) * sz];
  return {
    model: part.model,
    left: centerX + part.x + Math.min(...xs),
    right: centerX + part.x + Math.max(...xs),
    bottom: z + part.z + Math.min(...zs),
    top: z + part.z + Math.max(...zs),
  };
}

/** Every part the shell draws for one deck at match start, as stockPlatforms and the palette slab place it, in every graphics mode. */
function drawnDeck(stage: number, index: number): { readonly walking: readonly Drawn[]; readonly dressing: readonly Drawn[] } {
  const left = surfaceLeft(stage, index, 0);
  const right = surfaceRight(stage, index, 0);
  const centerX = (left + right) / 2;
  const z = surfaceZ(stage, index, 0);
  const stock = platformParts(stage, index);
  const [walkingPart, ...dressingParts]: readonly PlatformPart[] = stock.length > 0
    ? stock
    : [{ model: deckModel(stage, index), x: 0, y: 0, z: 0, scale: slabScale(stage, index, right - left) ?? [1, 1, 1], yaw: 0 }];
  if (walkingPart === undefined) throw new Error(`stage ${stage} deck ${index} draws nothing`);
  const boxes = (part: Readonly<PlatformPart>) => modeBounds(part.model).map((bounds) => drawnBox(part, bounds, centerX, z));
  return { walking: boxes(walkingPart), dressing: dressingParts.flatMap(boxes) };
}

const decks = () => STAGE_CATALOG.flatMap(({ id }) => Array.from({ length: surfaceCount(id) }, (_, index) => ({ stage: id, index })));

const TOP_TOLERANCE = 3;
/** The palette slab's body below its walking line: a deck drawn no deeper than it reads as the deck itself, wherever it stands. */
const SLAB_BODY = -(MODEL_FACTS[STAGE_DECK_MODEL]?.bounds?.min[2] ?? Number.NaN);
const END_TOLERANCE = 4;

test("every deck's drawn walking piece meets its collision: top within 3 units, ends within 4, in classic and HD [repro #322]", () => {
  const misses: string[] = [];
  for (const { stage, index } of decks()) {
    const left = surfaceLeft(stage, index, 0);
    const right = surfaceRight(stage, index, 0);
    const top = surfaceTopZ(stage, index, 0);
    for (const drawn of drawnDeck(stage, index).walking) {
      const off = { top: drawn.top - top, left: drawn.left - left, right: drawn.right - right };
      if (Math.abs(off.top) > TOP_TOLERANCE || Math.abs(off.left) > END_TOLERANCE || Math.abs(off.right) > END_TOLERANCE) {
        misses.push(`stage ${stage} deck ${index} ${drawn.model}: top ${off.top.toFixed(1)}, left ${off.left.toFixed(1)}, right ${off.right.toFixed(1)}`);
      }
    }
  }
  expect(misses).toEqual([]);
});

test("no drawn deck part deeper than a slab reaches into the space a fighter stands in above another deck, or rises above its own [repro #322]", () => {
  const all = decks();
  const misses: string[] = [];
  for (const { stage, index } of all) {
    const { walking, dressing } = drawnDeck(stage, index);
    const own = surfaceTopZ(stage, index, 0);
    for (const drawn of [...walking, ...dressing]) {
      if (drawn.top > own + TOP_TOLERANCE) misses.push(`stage ${stage} deck ${index} ${drawn.model} rises ${(drawn.top - own).toFixed(1)} above its walking line`);
      for (const other of all) {
        if (other.stage !== stage || other.index === index) continue;
        const floor = surfaceTopZ(stage, other.index, 0);
        const across = drawn.left < surfaceRight(stage, other.index, 0) && drawn.right > surfaceLeft(stage, other.index, 0);
        if (across && drawn.bottom < floor + HERO_REFERENCE_HEIGHT && drawn.top > floor && own - drawn.bottom > SLAB_BODY) {
          misses.push(`stage ${stage} deck ${index} ${drawn.model} hangs ${(floor + HERO_REFERENCE_HEIGHT - drawn.bottom).toFixed(1)} into deck ${other.index}'s standing space`);
        }
      }
    }
  }
  expect(misses).toEqual([]);
});
