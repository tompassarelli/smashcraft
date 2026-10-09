// Judges how evenly the portraits are lit: each fighter's head-and-shoulders
// bust (FighterBust*P1, the crop the tiles share) in Classic and Definitive.
// Usage: bun scripts/portraitLight.ts [FIGHTER_RENDERS]  (default: the stored fighter-renders family)
import { join } from 'node:path';
import { Effect } from 'effect';
import { assetsView, readManifest } from './wisp/buildInputs';
import { RENDERED_FIGHTERS, fighterRenderName } from '../src/game/sim/heroes/registry';
import { CARD_PREVIEW, CARD_TEXTURE_PX, TILE_TEXTURE_PX, cardPortrait } from '../src/game/ui/portraitFrames';

/** Calibrated on Peon, Blademaster and Thrall, the portraits Tom accepts as well lit (#363). */
export const LIGHT_BAND = { target: 110, lowest: 85, highest: 150, spread: 1.6, floor: 50, lit: 0.8 } as const;

export interface Light { readonly mean: number; readonly lit: number }

/** Mean Rec. 709 luma of a bust's opaque pixels and the share of them brighter than the floor. */
export function lightOf(rgba: Uint8Array, floor = LIGHT_BAND.floor): Light {
  let total = 0, count = 0, lit = 0;
  for (let at = 0; at + 3 < rgba.length; at += 4) {
    if ((rgba[at + 3] ?? 0) < 128) continue;
    const luma = 0.2126 * (rgba[at] ?? 0) + 0.7152 * (rgba[at + 1] ?? 0) + 0.0722 * (rgba[at + 2] ?? 0);
    total += luma; count++;
    if (luma > floor) lit++;
  }
  return count === 0 ? { mean: 0, lit: 0 } : { mean: total / count, lit: lit / count };
}

const toLinear = Array.from({ length: 256 }, (_, value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const toDisplay = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

/**
 * Light passes summed with weights where the renderer adds its lights (display
 * values in Classic, linear in Definitive), then lifted by gamma (out = in^(1/gamma)).
 */
export function combine(passes: readonly Uint8Array[], weights: readonly number[], linear: boolean, gamma: number): Uint8Array {
  const first = passes[0];
  if (first === undefined) throw new Error('no light passes');
  const out = new Uint8Array(first.length);
  for (let at = 0; at < first.length; at += 4) {
    for (let channel = 0; channel < 3; channel++) {
      let sum = 0;
      passes.forEach((pass, index) => { const value = pass[at + channel] ?? 0; sum += (weights[index] ?? 0) * (linear ? (toLinear[value] ?? 0) : value / 255); });
      const shown = Math.min(1, Math.max(0, linear ? toDisplay(Math.min(1, sum)) : sum));
      out[at + channel] = Math.round(255 * shown ** (1 / gamma));
    }
    out[at + 3] = passes.reduce((alpha, pass) => Math.max(alpha, pass[at + 3] ?? 0), 0);
  }
  return out;
}

/** The scale on a variant's weights that brings its mean luma to the target, within the exposure range. */
export function exposureFor(mean: (scale: number) => number, target = LIGHT_BAND.target, range: readonly [number, number] = [0.5, 3]): number {
  let [low, high] = range;
  if (mean(high) <= target) return high;
  if (mean(low) >= target) return low;
  for (let step = 0; step < 14; step++) { const middle = (low + high) / 2; if (mean(middle) < target) low = middle; else high = middle; }
  return (low + high) / 2;
}

/** Where a render's opaque pixels sit in its square: their box and centroid as fractions of the side, and the share of the square they cover. */
export interface Placement { readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }; readonly centroid: { readonly x: number; readonly y: number }; readonly cover: number }
export function placementOf(rgba: Uint8Array, side: number): Placement {
  let left = side, right = -1, top = side, bottom = -1, count = 0, sx = 0, sy = 0;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    if ((rgba[(y * side + x) * 4 + 3] ?? 0) < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); count++; sx += x; sy += y;
  }
  if (count === 0) return { box: { x: 0, y: 0, w: 0, h: 0 }, centroid: { x: 0, y: 0 }, cover: 0 };
  return { box: { x: left / side, y: top / side, w: (right + 1 - left) / side, h: (bottom + 1 - top) / side }, centroid: { x: (sx / count + 0.5) / side, y: (sy / count + 0.5) / side }, cover: count / (side * side) };
}

/** Calibrated on the accepted fighters' cards and chips (#363). */
export const PLACE_BAND = { cardCentre: 0.02, cardFill: [0.9, 0.96], chipCentre: 0.15, chipCover: [0.3, 0.9] } as const;

/** A card's problems: its box off the texture's centre or filling too little or too much of it. */
export function judgeCard(name: string, { box }: Placement): string[] {
  const problems: string[] = [];
  const dx = box.x + box.w / 2 - 0.5, dy = box.y + box.h / 2 - 0.5, fill = Math.max(box.w, box.h);
  if (Math.abs(dx) > PLACE_BAND.cardCentre || Math.abs(dy) > PLACE_BAND.cardCentre) problems.push(`${name}: card box centre off by ${dx.toFixed(3)}, ${dy.toFixed(3)}`);
  if (fill < PLACE_BAND.cardFill[0] || fill > PLACE_BAND.cardFill[1]) problems.push(`${name}: card fill ${fill.toFixed(2)} outside ${PLACE_BAND.cardFill.join('-')}`);
  return problems;
}

/** A chip's problems: its fighter's mass off the chip's centre line or covering too little or too much of it. */
export function judgeChip(name: string, { centroid, cover }: Placement): string[] {
  const problems: string[] = [];
  if (Math.abs(centroid.x - 0.5) > PLACE_BAND.chipCentre) problems.push(`${name}: chip centroid ${centroid.x.toFixed(2)} off centre`);
  if (cover < PLACE_BAND.chipCover[0] || cover > PLACE_BAND.chipCover[1]) problems.push(`${name}: chip cover ${cover.toFixed(2)} outside ${PLACE_BAND.chipCover.join('-')}`);
  return problems;
}

/** The player-preview frame's problems: its square off the centre of its card's preview area. */
export function judgePreview(): string[] {
  return [false, true].flatMap((computer) => {
    const { top, size } = cardPortrait(computer), bottom = computer ? CARD_PREVIEW.computerBottom : CARD_PREVIEW.bottom;
    const off = (top - size / 2) - (CARD_PREVIEW.top + bottom) / 2;
    return Math.abs(off) > 1e-4 ? [`${computer ? 'computer' : 'player'} preview off its area's centre by ${off.toFixed(4)}`] : [];
  });
}

/** Each look's problems: a bust outside the band or under the lit share, and the roster's spread. */
export function judge(lights: ReadonlyMap<string, Light>): string[] {
  const problems: string[] = [];
  for (const [name, { mean, lit }] of lights) {
    if (mean < LIGHT_BAND.lowest || mean > LIGHT_BAND.highest) problems.push(`${name}: mean luma ${mean.toFixed(1)} outside ${LIGHT_BAND.lowest}-${LIGHT_BAND.highest}`);
    if (lit < LIGHT_BAND.lit) problems.push(`${name}: lit fraction ${lit.toFixed(2)} under ${LIGHT_BAND.lit}`);
  }
  const means = [...lights.values()].map((light) => light.mean);
  const spread = Math.max(...means) / Math.max(1, Math.min(...means));
  if (spread > LIGHT_BAND.spread) problems.push(`spread max/min ${spread.toFixed(2)} over ${LIGHT_BAND.spread}`);
  return problems;
}

export const pixels = (path: string): Uint8Array => {
  const result = Bun.spawnSync(['magick', path, '-depth', '8', 'RGBA:-'], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(`${path}: ${result.stderr.toString()}`);
  return new Uint8Array(result.stdout);
};
export const bustPixels = pixels;

const portrait = (renders: string, look: 'classic' | 'definitive', kind: string, name: string) => join(renders, ...(look === 'definitive' ? ['de'] : []), `Fighter${kind}${name}P1.tga`);

export const lookLights = (renders: string, look: 'classic' | 'definitive', names = RENDERED_FIGHTERS.map(fighterRenderName)): Map<string, Light> =>
  new Map(names.map((name) => [name, lightOf(pixels(portrait(renders, look, 'Bust', name)))]));

if (import.meta.main) {
  const renders = process.argv[2] ?? join(assetsView(await Effect.runPromise(readManifest())), 'fighter-renders');
  const problems = judgePreview();
  for (const look of ['classic', 'definitive'] as const) {
    const lights = lookLights(renders, look);
    for (const [name, { mean, lit }] of lights) {
      const card = placementOf(pixels(portrait(renders, look, 'Card', name)), CARD_TEXTURE_PX), chip = placementOf(pixels(portrait(renders, look, 'Bust', name)), TILE_TEXTURE_PX);
      console.log(`${look} ${name}: mean ${mean.toFixed(1)} lit ${lit.toFixed(2)}; card centre ${(card.box.x + card.box.w / 2).toFixed(3)},${(card.box.y + card.box.h / 2).toFixed(3)} fill ${Math.max(card.box.w, card.box.h).toFixed(2)}; chip centroid ${chip.centroid.x.toFixed(2)} cover ${chip.cover.toFixed(2)}`);
      problems.push(...[...judgeCard(name, card), ...judgeChip(name, chip)].map((problem) => `${look} ${problem}`));
    }
    const means = [...lights.values()].map((light) => light.mean);
    console.log(`${look}: ${lights.size} fighters, mean ${Math.min(...means).toFixed(1)}-${Math.max(...means).toFixed(1)}, spread ${(Math.max(...means) / Math.min(...means)).toFixed(2)}, lit from ${Math.min(...[...lights.values()].map((light) => light.lit)).toFixed(2)}`);
    problems.push(...judge(lights).map((problem) => `${look} ${problem}`));
  }
  for (const problem of problems) console.log(`FAIL ${problem}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
