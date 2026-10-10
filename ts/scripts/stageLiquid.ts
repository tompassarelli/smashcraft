



type Liquid = "Water" | "Lava";
const LIQUID_TEXTURE_SIZE = 64;
type Rgba = readonly [red: number, green: number, blue: number, alpha: number];






const LAVA_GLOW = { color: [255, 196, 96] as const, crest: 0.8 };

const ripple = (x: number, y: number) => Math.sin((x + 5 * Math.sin(y * Math.PI / 16)) * Math.PI / 8) * 0.5 + 0.5;


export function liquidTexel(kind: Liquid, x: number, y: number): Rgba {
  const r = ripple(x, y);
  const rgb = kind === "Water" ? [90 + 45 * r, 161 + 40 * r, 172 + 42 * r] : [190 + 52 * r, 63 + 63 * r, 18 + 19 * r];
  return [Math.round(rgb[0] ?? 0), Math.round(rgb[1] ?? 0), Math.round(rgb[2] ?? 0), kind === "Water" ? 110 : 235];
}


export function lavaGlowTexel(x: number, y: number): Rgba {
  const strength = Math.min(1, Math.max(0, (ripple(x, y) - LAVA_GLOW.crest) / (1 - LAVA_GLOW.crest)));
  return [LAVA_GLOW.color[0], LAVA_GLOW.color[1], LAVA_GLOW.color[2], Math.round(255 * strength)];
}


export function liquidTga(texel: (x: number, y: number) => Rgba): Uint8Array {
  const size = LIQUID_TEXTURE_SIZE;
  const texture = new Uint8Array(18 + size * size * 4);
  texture[2] = 2; texture[12] = size; texture[14] = size; texture[16] = 32; texture[17] = 0x28;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [red, green, blue, alpha] = texel(x, y);
    texture.set([blue, green, red, alpha], 18 + (y * size + x) * 4);
  }
  return texture;
}
