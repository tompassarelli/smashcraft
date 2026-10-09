





import { PLAYER_COLORS } from '../../ts/src/game/ui/slotColors';


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


const HUED = PLAYER_COLORS.map((color) => ({ name: color.name, ...hsv((color.rgb >> 16) & 255, (color.rgb >> 8) & 255, color.rgb & 255) })).filter((color) => color.saturation > 0.2);





const MIN_SATURATION = 0.6;
const MIN_VALUE = 0.15;
const HUE_TOLERANCE = 20;


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


const COAL = [79, 79, 85] as const;

const linear = (byte: number): number => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const teamPalette = [...PLAYER_COLORS.map((color) => ({ name: color.name, rgb: [(color.rgb >> 16) & 255, (color.rgb >> 8) & 255, color.rgb & 255] })), { name: 'Coal', rgb: COAL }]
  .map((color) => ({ name: color.name, rgb: color.rgb.map(linear) }));


function quantizedContribution(encoded: readonly number[], source: readonly number[]): boolean {
  let low = 0;
  let high = Infinity;
  for (let channel = 0; channel < 3; channel++) {
    const value = encoded[channel]!;
    const color = source[channel]!;
    if (color === 0) { if (value > 0) return false; continue; }
    low = Math.max(low, linear(Math.max(0, value - 0.5)) / color);
    high = Math.min(high, linear(Math.min(255, value + 0.5)) / color);
  }
  return low <= high;
}






export function teamLayerPixels(layer: Rgba, expected = 'Coal'): Pick<TeamColourResult, 'masked' | 'found'> {
  const expectedColor = teamPalette.find((color) => color.name === expected);
  let masked = 0;
  const found: { [name: string]: number } = {};
  for (let index = 0; index < layer.length; index += 4) {
    const encoded = [layer[index]!, layer[index + 1]!, layer[index + 2]!];

    if (Math.max(...encoded) < 16 || layer[index + 3]! === 0) continue;
    const rgb = encoded.map(linear);
    const max = Math.max(...rgb);
    masked++;
    let best = 'unknown';
    let distance = Infinity;
    for (const color of teamPalette) {
      const top = Math.max(...color.rgb);
      const apart = rgb.reduce((sum, value, channel) => sum + (value / max - color.rgb[channel]! / top) ** 2, 0);
      if (apart < distance) { best = color.name; distance = apart; }
    }

    if (best !== expected && !(expectedColor !== undefined && quantizedContribution(encoded, expectedColor.rgb))) found[best] = (found[best] ?? 0) + 1;
  }
  return { masked, found };
}


const MASK_MARGIN = 48;

const MASK_RATIO = 2;

export interface TeamColourResult {

  readonly masked: number;

  readonly found: { readonly [name: string]: number };

  readonly silhouetteMismatch: number;
  readonly silhouette: number;
}


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
