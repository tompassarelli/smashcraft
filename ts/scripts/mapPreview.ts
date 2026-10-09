





import type { Rgba } from "./blp";

export const PREVIEW_ENTRY = "war3mapMap.blp";
export const PREVIEW_SIZE = 256;


export function encodePreview(image: Rgba): Uint8Array {
  const pixels = image.width * image.height;
  const out = new Uint8Array(156 + 1024 + pixels), view = new DataView(out.buffer);
  out.set([66, 76, 80, 49]);
  view.setUint32(4, 1, true);
  view.setUint32(12, image.width, true);
  view.setUint32(16, image.height, true);
  view.setUint32(20, 5, true);
  view.setUint32(28, 1180, true);
  view.setUint32(92, pixels, true);
  for (let i = 0; i < 256; i++) {
    out[156 + i * 4] = (i & 3) * 85;
    out[157 + i * 4] = Math.round(((i >> 2) & 7) * 255 / 7);
    out[158 + i * 4] = Math.round((i >> 5) * 255 / 7);
  }
  for (let i = 0; i < pixels; i++) out[1180 + i] = ((image.data[i * 4] ?? 0) >> 5) << 5
    | ((image.data[i * 4 + 1] ?? 0) >> 5) << 2 | ((image.data[i * 4 + 2] ?? 0) >> 6);
  return out;
}





export const PREVIEW_FIGHTERS = [
  { card: "FighterCardWarden.tga", x: 30, height: 116, flip: false, shade: 0.72 },
  { card: "FighterCardDreadlord.tga", x: 222, height: 120, flip: true, shade: 0.72 },
  { card: "FighterCardBlademaster.tga", x: 70, height: 126, flip: false, shade: 0.9 },
  { card: "FighterCardIllidan.tga", x: 176, height: 130, flip: true, shade: 0.9 },
  { card: "FighterCardMountainKing.tga", x: 128, height: 112, flip: false, shade: 1 },
] as const;

const DECK_TOP = 214;

type Canvas = Float32Array;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function blend(canvas: Canvas, x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || y < 0 || x >= PREVIEW_SIZE || y >= PREVIEW_SIZE || a <= 0) return;
  const i = (y * PREVIEW_SIZE + x) * 4;
  canvas[i] = r * a + (canvas[i] ?? 0) * (1 - a);
  canvas[i + 1] = g * a + (canvas[i + 1] ?? 0) * (1 - a);
  canvas[i + 2] = b * a + (canvas[i + 2] ?? 0) * (1 - a);
  canvas[i + 3] = 1;
}


function drawSky(canvas: Canvas) {
  const top = [0.06, 0.05, 0.16], horizon = [0.78, 0.3, 0.12];
  for (let y = 0; y < PREVIEW_SIZE; y++) {
    const t = clamp01(y / DECK_TOP) ** 1.6;
    for (let x = 0; x < PREVIEW_SIZE; x++) {
      const dx = x - 128, dy = y - 150, d = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const ray = (Math.cos(angle * 14) > 0.55 ? 0.12 : 0) * clamp01(1 - d / 190);
      const glow = clamp01(1 - d / 120) ** 2 * 0.85 + ray;
      const i = (y * PREVIEW_SIZE + x) * 4;
      canvas[i] = clamp01(mix((top[0] ?? 0), (horizon[0] ?? 0), t) + glow * 1.0);
      canvas[i + 1] = clamp01(mix((top[1] ?? 0), (horizon[1] ?? 0), t) + glow * 0.78);
      canvas[i + 2] = clamp01(mix((top[2] ?? 0), (horizon[2] ?? 0), t) + glow * 0.35);
      canvas[i + 3] = 1;
    }
  }
  let seed = 317;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 0; n < 70; n++) {
    const x = Math.floor(random() * PREVIEW_SIZE), y = Math.floor(60 + random() * 150), bright = 0.4 + random() * 0.6;
    blend(canvas, x, y, 1, 0.8, 0.4, bright);
    if (bright > 0.8) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) blend(canvas, x + ox, y + oy, 1, 0.6, 0.25, bright * 0.4);
  }
}


function drawDeck(canvas: Canvas) {
  const left = 10, right = 246, thick = 12;
  for (let y = DECK_TOP; y < PREVIEW_SIZE; y++) {
    const depth = y - DECK_TOP;
    const inset = depth < thick ? 0 : (depth - thick) * 2.6;
    for (let x = Math.ceil(left + inset); x <= right - inset; x++) {
      if (depth < 3) blend(canvas, x, y, 0.85, 0.78, 0.62, 1);
      else if (depth < thick) {
        const brick = (y - DECK_TOP - 3) % 5 === 4 || (x + (Math.floor((depth - 3) / 5) % 2) * 9) % 18 === 0;
        const v = brick ? 0.22 : 0.48 - depth * 0.012;
        blend(canvas, x, y, v * 1.05, v * 0.95, v * 0.85, 1);
      } else {
        const v = 0.3 - (depth - thick) * 0.008 + ((x * 7 + y * 13) % 11) * 0.006;
        blend(canvas, x, y, v * 0.9, v * 0.7, v * 0.6, 1);
      }
    }
  }
}


function opaqueBounds(card: Rgba) {
  let x0 = card.width, y0 = card.height, x1 = -1, y1 = -1;
  for (let y = 0; y < card.height; y++) {
    for (let x = 0; x < card.width; x++) {
      if ((card.data[(y * card.width + x) * 4 + 3] ?? 0) > 24) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) throw new Error("fighter card is fully transparent");
  return { x0, y0, x1, y1 };
}


function drawFighter(canvas: Canvas, card: Rgba, x: number, height: number, flip: boolean, shade: number) {
  const bounds = opaqueBounds(card);
  const scale = (bounds.y1 - bounds.y0 + 1) / height;
  const width = Math.ceil((bounds.x1 - bounds.x0 + 1) / scale);
  const left = Math.round(x - width / 2), top = DECK_TOP + 2 - height;
  for (let sy = -3; sy <= 3; sy++) {
    for (let sx = -width / 2; sx <= width / 2; sx++) {
      const e = (sx / (width / 2)) ** 2 + (sy / 3) ** 2;
      if (e <= 1) blend(canvas, Math.round(x + sx), DECK_TOP + 1 + sy, 0.05, 0.03, 0.02, 0.45 * (1 - e));
    }
  }
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {

      const u = flip ? width - 1 - px : px;
      const sx0 = bounds.x0 + u * scale, sy0 = bounds.y0 + py * scale;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy0 + scale); y++) {
        for (let xx = Math.floor(sx0); xx < Math.ceil(sx0 + scale); xx++) {
          if (xx < 0 || y < 0 || xx >= card.width || y >= card.height) continue;
          const i = (y * card.width + xx) * 4, alpha = (card.data[i + 3] ?? 0) / 255;
          r += (card.data[i] ?? 0) / 255 * alpha; g += (card.data[i + 1] ?? 0) / 255 * alpha; b += (card.data[i + 2] ?? 0) / 255 * alpha; a += alpha; n++;
        }
      }
      if (n === 0 || a === 0) continue;
      blend(canvas, left + px, top + py, r / a * shade, g / a * shade, b / a * shade * 0.97, a / n);
    }
  }
}


const GLYPHS: Record<string, readonly string[]> = {
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
};


function drawTitle(canvas: Canvas, text = "SMASHCRAFT") {
  const cell = 4, gap = 4, letter = 5 * cell, top = 14;
  const total = text.length * letter + (text.length - 1) * gap;
  const left = Math.floor((PREVIEW_SIZE - total) / 2);
  const ink = new Uint8Array(PREVIEW_SIZE * PREVIEW_SIZE);
  [...text].forEach((char, index) => {
    const glyph = GLYPHS[char];
    if (glyph === undefined) throw new Error(`no glyph for ${char}`);
    glyph.forEach((row, gy) => [...row].forEach((bit, gx) => {
      if (bit !== "1") return;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) ink[(top + gy * cell + y) * PREVIEW_SIZE + left + index * (letter + gap) + gx * cell + x] = 1;
    }));
  });
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < PREVIEW_SIZE && y < PREVIEW_SIZE && ink[y * PREVIEW_SIZE + x] === 1;
  const near = (x: number, y: number, radius: number) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (at(x + dx, y + dy)) return true;
    return false;
  };
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < PREVIEW_SIZE; x++) {
      if (near(x - 3, y - 3, 2)) blend(canvas, x, y, 0, 0, 0, 0.55);
      if (near(x, y, 2) && !at(x, y)) blend(canvas, x, y, 0.16, 0.06, 0.02, 1);
    }
  }
  const height = 7 * cell;
  for (let y = top; y < top + height; y++) {
    const t = (y - top) / (height - 1);
    for (let x = 0; x < PREVIEW_SIZE; x++) {
      if (!at(x, y)) continue;
      const edge = !at(x, y - 1) || !at(x - 1, y) ? 0.25 : !at(x, y + 1) || !at(x + 1, y) ? -0.2 : 0;
      const band = t < 0.45 ? mix(1, 0.98, t / 0.45) : mix(0.86, 0.62, (t - 0.45) / 0.55);
      blend(canvas, x, y, clamp01(band + edge), clamp01(band * (t < 0.45 ? 0.92 : 0.66) + edge), clamp01(band * (t < 0.45 ? 0.55 : 0.18) + edge * 0.6), 1);
    }
  }
}


export function composePreview(cards: (file: string) => Rgba): Rgba {
  const canvas: Canvas = new Float32Array(PREVIEW_SIZE * PREVIEW_SIZE * 4);
  drawSky(canvas);
  drawDeck(canvas);
  for (const { card, x, height, flip, shade } of PREVIEW_FIGHTERS) drawFighter(canvas, cards(card), x, height, flip, shade);
  drawTitle(canvas);
  const data = new Uint8Array(canvas.length);
  for (let i = 0; i < canvas.length; i++) data[i] = Math.round(clamp01((canvas[i] ?? 0)) * 255);
  return { width: PREVIEW_SIZE, height: PREVIEW_SIZE, data, alpha: true };
}


export function encodeTga(image: Rgba): Uint8Array {
  const out = new Uint8Array(18 + image.width * image.height * 4);
  const view = new DataView(out.buffer);
  out[2] = 2;
  view.setUint16(12, image.width, true);
  view.setUint16(14, image.height, true);
  out[16] = 32;
  out[17] = 8;
  for (let y = 0; y < image.height; y++) {
    const row = 18 + (image.height - 1 - y) * image.width * 4;
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4, to = row + x * 4;
      out[to] = (image.data[from + 2] ?? 0);
      out[to + 1] = (image.data[from + 1] ?? 0);
      out[to + 2] = (image.data[from] ?? 0);
      out[to + 3] = (image.data[from + 3] ?? 0);
    }
  }
  return out;
}
