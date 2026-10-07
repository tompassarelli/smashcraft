// Checks a portrait render shows no player's colour where the model shows its
// team colour. The team-colour mask comes from the same fighter rendered with
// team colour 0 (red) and otherwise identically: a pixel that reads as Red there
// and has at least twice the red is one the team-colour layer draws most of.
// Where the model's own texture draws most of a pixel (Pit Lord's flames), its
// colour is the fighter's, whatever the team colour.
import { PLAYER_COLORS } from '../../ts/src/game/ui/slotColors';

/** RGBA bytes, row by row: what `magick IMAGE -depth 8 RGBA:-` prints. */
export type Rgba = Uint8Array;

export function readRgba(path: string): Rgba {
  const result = Bun.spawnSync(['magick', path, '-depth', '8', 'RGBA:-'], { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(`magick could not read ${path}: ${result.stderr.toString()}`);
  return new Uint8Array(result.stdout);
}

const hsv = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  const hue = chroma === 0 ? 0 : max === r ? (((g - b) / chroma) % 6 + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return { hue: hue * 60, saturation: max === 0 ? 0 : chroma / max, value: max / 255 };
};

/** Gray is the one player colour without a hue; every other is told apart by hue. */
const HUED = PLAYER_COLORS.map((color) => ({ name: color.name, ...hsv((color.rgb >> 16) & 255, (color.rgb >> 8) & 255, color.rgb & 255) })).filter((color) => color.saturation > 0.2);
/**
 * A lit, coloured pixel; a darker or greyer one shows no player's hue. The
 * renderer's lights keep a team-colour pixel at least this saturated: 99% of the
 * Archer's red team pixels are above 0.71.
 */
const MIN_SATURATION = 0.6;
const MIN_VALUE = 0.15;
const HUE_TOLERANCE = 20;

/** The player colour whose hue a pixel shows, if any. */
export function playerHue(r: number, g: number, b: number): string | undefined {
  const pixel = hsv(r, g, b);
  if (pixel.saturation < MIN_SATURATION || pixel.value < MIN_VALUE) return undefined;
  let best: string | undefined;
  let distance = HUE_TOLERANCE;
  for (const color of HUED) {
    const apart = Math.min(Math.abs(pixel.hue - color.hue), 360 - Math.abs(pixel.hue - color.hue));
    if (apart <= distance) {
      distance = apart;
      best = color.name;
    }
  }
  return best;
}

/** Coal's source texture RGB; the isolated pass is unlit, with zero exposure. */
const COAL = [79, 79, 85] as const;
const teamPalette = [...PLAYER_COLORS.map((color) => ({ name: color.name, rgb: [(color.rgb >> 16) & 255, (color.rgb >> 8) & 255, color.rgb & 255] })), { name: 'Coal', rgb: COAL }];

/**
 * Checks the renderer's isolated team layer, including partial contributions
 * beneath painted skin. Match RGB proportions so alpha blends to black keep
 * their source colour; Gray remains distinct from Coal's blue-grey proportions.
 */
export function teamLayerPixels(layer: Rgba): Pick<TeamColourResult, 'masked' | 'found'> {
  let masked = 0;
  const found: { [name: string]: number } = {};
  for (let index = 0; index < layer.length; index += 4) {
    const rgb = [layer[index]!, layer[index + 1]!, layer[index + 2]!];
    const max = Math.max(...rgb);
    // Below 16, byte quantization cannot distinguish Coal from Gray reliably.
    if (max < 16 || layer[index + 3]! === 0) continue;
    masked++;
    let best = 'unknown';
    let distance = Infinity;
    for (const color of teamPalette) {
      const top = Math.max(...color.rgb);
      const apart = rgb.reduce((sum, value, channel) => sum + (value / max - color.rgb[channel]! / top) ** 2, 0);
      if (apart < distance) { best = color.name; distance = apart; }
    }
    if (best !== 'Coal') found[best] = (found[best] ?? 0) + 1;
  }
  return { masked, found };
}

/** How much redder the red render must be for a pixel to count as team colour (0-255). */
const MASK_MARGIN = 48;
/** The red render's red over the render's, past which the team-colour layer draws most of the pixel. */
const MASK_RATIO = 2;

export interface TeamColourResult {
  /** Pixels the team-colour layer draws. */
  readonly masked: number;
  /** Those pixels that show a player colour's hue in `render`, by colour. */
  readonly found: { readonly [name: string]: number };
  /** Pixels covered in one render and not the other: the two must show the same pose. */
  readonly silhouetteMismatch: number;
  readonly silhouette: number;
}

/** Compares `render` with `red`, the same fighter rendered in team colour 0. */
export function teamColourPixels(render: Rgba, red: Rgba): TeamColourResult {
  if (render.length !== red.length) throw new Error('renders differ in size');
  let masked = 0;
  let silhouetteMismatch = 0;
  let silhouette = 0;
  const found: { [name: string]: number } = {};
  for (let index = 0; index < render.length; index += 4) {
    const [r, g, b, a] = [render[index]!, render[index + 1]!, render[index + 2]!, render[index + 3]!];
    const [rr, rg, rb, ra] = [red[index]!, red[index + 1]!, red[index + 2]!, red[index + 3]!];
    if (a > 127) silhouette++;
    if ((a > 127) !== (ra > 127)) silhouetteMismatch++;
    if (a < 230 || ra < 230 || rr - r < MASK_MARGIN || rr < r * MASK_RATIO || playerHue(rr, rg, rb) !== 'Red') continue;
    masked++;
    const name = playerHue(r, g, b);
    if (name !== undefined) found[name] = (found[name] ?? 0) + 1;
  }
  return { masked, found, silhouetteMismatch, silhouette };
}
