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
