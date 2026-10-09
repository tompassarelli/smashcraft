import type { StageLight } from "../assets/stageLighting";
import { luma, type DeckPalette } from "../assets/stagePalette";
import { PATTERNED_DECKS_STAGE } from "../sim/stage";
import type { SceneryPiece, StageScenery } from "./stageScenery";

export const FOG_START_MINIMUM = 5000;

export function fogProblems(name: string, { fog, heightFog }: Pick<StageScenery, "fog" | "heightFog">): readonly string[] {
  const problems: string[] = [];
  if (fog === undefined) return [`${name}: missing fog`];
  if (!(fog.start >= FOG_START_MINIMUM && fog.end > fog.start)) problems.push(`${name}: fog reaches the fighting plane or has no range`);
  for (const channel of [fog.red, fog.green, fog.blue]) {
    if (!(channel >= 0 && channel <= 1)) problems.push(`${name}: fog colour ${channel} is outside [0, 1]`);
  }
  if (heightFog === undefined) return problems;
  if (!(heightFog.heightStart < heightFog.heightEnd && heightFog.heightEnd < 0)) problems.push(`${name}: height fog reaches the deck`);
  if (!(heightFog.start >= FOG_START_MINIMUM && heightFog.end > heightFog.start)) problems.push(`${name}: height fog reaches the fighting plane or has no range`);
  return problems;
}

export function mirrorProblems(name: string, pieces: readonly SceneryPiece[]): readonly string[] {
  const problems: string[] = [];
  for (const [index, a] of pieces.entries()) {
    for (const b of pieces.slice(index + 1)) {
      const mirrored = a.model === b.model && Math.abs(a.x) >= 200.0 && Math.abs(a.x + b.x) < 400.0
        && Math.abs(a.y - b.y) < 600.0 && Math.abs(a.z - b.z) < 300.0
        && Math.max(a.scale, b.scale) < 1.25 * Math.min(a.scale, b.scale);
      if (mirrored) problems.push(`${name}: ${a.model} at x ${a.x} mirrors x ${b.x}`);
    }
  }
  return problems;
}

export function deckProblems(theme: string, palette: DeckPalette, fog: StageScenery["fog"]): readonly string[] {
  const problems: string[] = [];
  const top = luma(palette.top);
  if (luma(palette.body) > top - 50) problems.push(`${theme}: body ${luma(palette.body)} is within 50 of top ${top}`);
  if (fog === undefined) return problems;
  const background = luma([fog.red * 255, fog.green * 255, fog.blue * 255]);
  if (Math.abs(top - background) < 40) problems.push(`${theme}: top ${top} is within 40 of fog ${background}`);
  return problems;
}

export function lightProblems(theme: string, light: StageLight): readonly string[] {
  const problems: string[] = [];
  const key = luma(light.key);
  const ambient = luma(light.ambient);
  if (key < 210) problems.push(`${theme}: key light luma ${key} is below 210`);
  if (ambient < 120) problems.push(`${theme}: ambient luma ${ambient} is below 120`);
  if (ambient > key) problems.push(`${theme}: ambient luma ${ambient} exceeds key ${key}`);
  for (const part of ["key", "ambient"] as const) {
    const chroma = Math.max(...light[part]) - Math.min(...light[part]);
    if (chroma > 80) problems.push(`${theme}: ${part} light chroma ${chroma} exceeds 80`);
  }
  return problems;
}

export function intensityProblems(theme: string, stage: number, light: StageLight): readonly string[] {
  const intensity = light.intensity ?? 1, limit = stage === PATTERNED_DECKS_STAGE ? 2 : 1.25;
  return intensity > 0 && intensity <= limit ? [] : [`${theme}: intensity ${intensity} is outside (0, ${limit}]`];
}

export interface ModelBox { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] }
export type BoundsOf = (model: string) => ModelBox | undefined;
interface Placed { readonly left: number; readonly right: number; readonly front: number; readonly back: number; readonly bottom: number; readonly top: number }

// Lowest of the classic and Definitive mesh tops: a structure resting on one of these rocks touches it in both looks.
export const SUPPORT_TOPS: Readonly<Record<string, number>> = {
  "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks0.mdx": 38,
  "Doodads\\Barrens\\Rocks\\Barrens_Rocks\\Barrens_Rocks2.mdx": 79,
  "Doodads\\Icecrown\\Rocks\\Glacier\\Glacier0.mdx": 380,
  "Doodads\\Outland\\Rocks\\Outland_Spires\\Outland_Spires7.mdx": 459,
  "Doodads\\Ruins\\Rocks\\Ruins_Rock\\Ruins_Rock0.mdx": 77,
};

export const isStructure = (model: string): boolean => model.toLowerCase().startsWith("buildings\\") || model.toLowerCase().includes("\\structures\\");
const isEffect = (model: string): boolean => model.toLowerCase().startsWith("abilities\\");

function placed(piece: SceneryPiece, box: ModelBox): Placed {
  const [mx, my, mz] = piece.matrixScale ?? [1, 1, 1];
  const turn = (piece.yaw * Math.PI) / 180;
  const xs: number[] = [], ys: number[] = [];
  for (const x of [box.min[0] * mx, box.max[0] * mx]) for (const y of [box.min[1] * my, box.max[1] * my]) {
    xs.push((x * Math.cos(turn) - y * Math.sin(turn)) * piece.scale + piece.x);
    ys.push((x * Math.sin(turn) + y * Math.cos(turn)) * piece.scale + piece.y);
  }
  return { left: Math.min(...xs), right: Math.max(...xs), front: Math.min(...ys), back: Math.max(...ys), bottom: box.min[2] * mz * piece.scale + piece.z, top: box.max[2] * mz * piece.scale + piece.z };
}

function supports(rock: SceneryPiece, piece: SceneryPiece, boundsOf: BoundsOf): boolean {
  const top = SUPPORT_TOPS[rock.model], box = boundsOf(rock.model);
  if (rock === piece || top === undefined || box === undefined) return false;
  const under = placed(rock, box), surface = rock.z + top * (rock.matrixScale?.[2] ?? 1) * rock.scale;
  const height = (boundsOf(piece.model)?.max[2] ?? 0) * piece.scale;
  return piece.x >= under.left && piece.x <= under.right && piece.y >= under.front && piece.y <= under.back && piece.z <= surface && surface <= piece.z + height / 4;
}

export function landmarkProblems(name: string, pieces: readonly SceneryPiece[], boundsOf: BoundsOf): readonly string[] {
  const landmark = pieces.find((piece) => isStructure(piece.model)) ?? pieces[0];
  const box = landmark === undefined ? undefined : boundsOf(landmark.model);
  if (landmark === undefined || box === undefined) return [];
  const whole = placed(landmark, box);
  const mark = { left: (landmark.x + whole.left) / 2, right: (landmark.x + whole.right) / 2, front: (landmark.y + whole.front) / 2, back: (landmark.y + whole.back) / 2, };
  const problems: string[] = [];
  for (const [index, piece] of pieces.entries()) {
    const own = boundsOf(piece.model);
    if (piece === landmark || own === undefined || isEffect(piece.model)) continue;
    const top = piece.z + (supports(piece, landmark, boundsOf) ? SUPPORT_TOPS[piece.model] ?? own.max[2] : own.max[2]) * (piece.matrixScale?.[2] ?? 1) * piece.scale;
    const crossed = piece.x > mark.left && piece.x < mark.right && piece.y > mark.front && piece.y < mark.back && top > landmark.z + (whole.top - landmark.z) / 4;
    if (crossed) problems.push(`${name}: piece ${index} ${piece.model} crosses the landmark ${landmark.model} (core x ${Math.round(mark.left)}..${Math.round(mark.right)}, y ${Math.round(mark.front)}..${Math.round(mark.back)})`);
  }
  return problems;
}

export function groundProblems(name: string, pieces: readonly SceneryPiece[], boundsOf: BoundsOf, ground: number | undefined): readonly string[] {
  const problems: string[] = [];
  for (const [index, piece] of pieces.entries()) {
    if (!isStructure(piece.model) || piece.flying === true) continue;
    if (ground !== undefined && piece.z <= ground) continue;
    const supported = pieces.some((other) => supports(other, piece, boundsOf));
    if (!supported) problems.push(`${name}: piece ${index} ${piece.model} at z ${piece.z} stands on nothing`);
  }
  return problems;
}
