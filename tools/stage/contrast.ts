// Fighter-vs-background contrast of native captures (smashcraft:docs/design/visual-quality.md,
// "How the numbers are taken"). The mask is a capture after `-dev backdrop off`.
// usage: bun tools/stage/contrast.ts MASK.png FRAME.png...
import { $ } from "bun";
import { decodePpm, type Frame } from "../../ts/node_modules/wisp/scripts/wisp/frameProbe";

async function load(path: string): Promise<Frame> {
  const native = decodePpm(await Bun.file(path).bytes());
  const frame = native ?? decodePpm(new Uint8Array(await $`magick ${path} -alpha off -depth 8 ppm:-`.arrayBuffer()));
  if (frame === undefined || frame.width <= 0 || frame.height <= 0 || frame.rgb.length !== frame.width * frame.height * 3) throw new Error(`${path}: malformed RGB image`);
  return frame;
}

const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
type Lab = [number, number, number];
function lab(r: number, g: number, b: number): Lab {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function de2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const d = Math.PI / 180;
  const hue = (a: number, b: number) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) / d; return h < 0 ? h + 360 : h; };
  const cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)));
  const [p1, p2] = [(1 + g) * a1, (1 + g) * a2];
  const [c1, c2] = [Math.hypot(p1, b1), Math.hypot(p2, b2)];
  const [h1, h2] = [hue(p1, b1), hue(p2, b2)];
  let dh = c1 * c2 === 0 ? 0 : h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(c1 * c2) * Math.sin(dh * d / 2);
  const lM = (l1 + l2) / 2, cM = (c1 + c2) / 2;
  const hM = c1 * c2 === 0 ? h1 + h2 : Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const t = 1 - 0.17 * Math.cos((hM - 30) * d) + 0.24 * Math.cos(2 * hM * d) + 0.32 * Math.cos((3 * hM + 6) * d) - 0.2 * Math.cos((4 * hM - 63) * d);
  const sl = 1 + 0.015 * (lM - 50) ** 2 / Math.sqrt(20 + (lM - 50) ** 2), sc = 1 + 0.045 * cM, sh = 1 + 0.015 * cM * t;
  const rt = -2 * Math.sqrt(cM ** 7 / (cM ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hM - 275) / 25) ** 2)) * d);
  const [dl, dc, dhs] = [(l2 - l1) / sl, (c2 - c1) / sc, dH / sh];
  return Math.sqrt(dl * dl + dc * dc + dhs * dhs + rt * dc * dhs);
}

const [maskPath, ...frames] = Bun.argv.slice(2);
if (maskPath === undefined || frames.length === 0) throw new Error("usage: bun tools/stage/contrast.ts MASK.png FRAME.png...");
const mask = await load(maskPath);
const { width, height } = mask;
// The mask frame's commonest colour is its empty background.
const counts = new Map<number, number>();
for (let i = 0; i < width * height; i++) { const k = (mask.rgb[i * 3]! >> 3 << 10) | (mask.rgb[i * 3 + 1]! >> 3 << 5) | (mask.rgb[i * 3 + 2]! >> 3); counts.set(k, (counts.get(k) ?? 0) + 1); }
const empty = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
const er = (empty >> 10) * 8 + 4, eg = ((empty >> 5) & 31) * 8 + 4, eb = (empty & 31) * 8 + 4;
// Fighter pixels: far from the empty colour, between 8% and 76% of the height (above the HUD).
const on = new Uint8Array(width * height);
for (let y = Math.floor(height * 0.08); y < Math.floor(height * 0.76); y++) for (let x = 0; x < width; x++) {
  const i = y * width + x; const [r, g, b] = [mask.rgb[i * 3]!, mask.rgb[i * 3 + 1]!, mask.rgb[i * 3 + 2]!];
  if (Math.abs(r - er) + Math.abs(g - eg) + Math.abs(b - eb) > 40) on[i] = 1;
}
// Keep the largest connected blobs (the fighters); text and specks drop out.
const label = new Int32Array(width * height).fill(-1); const sizes: number[] = [];
for (let i = 0; i < on.length; i++) {
  if (!on[i] || label[i] !== -1) continue;
  const id = sizes.length; let size = 0; const stack = [i]; label[i] = id;
  while (stack.length) { const p = stack.pop()!; size++; const px = p % width, py = (p - px) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue; const n = ny * width + nx; if (on[n] && label[n] === -1) { label[n] = id; stack.push(n); } } }
  sizes.push(size);
}
if (sizes.length === 0) throw new Error(`${maskPath}: no fighter silhouette found`);
const minimum = Math.max(...sizes) * 0.25;
const fighter = new Uint8Array(width * height);
for (let i = 0; i < on.length; i++) if (label[i]! >= 0 && sizes[label[i]!]! >= minimum) fighter[i] = 1;
const dilate = (src: Uint8Array, r: number) => { const out = new Uint8Array(src.length); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { if (!src[y * width + x]) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < width && ny < height) out[ny * width + nx] = 1; } } return out; };
const inner = dilate(fighter, 4), outer = dilate(fighter, 18);
let fighterCount = 0; for (const v of fighter) fighterCount += v;
console.log(`mask ${maskPath}: empty rgb(${er},${eg},${eb}), fighters ${fighterCount} px in ${sizes.filter(s => s >= minimum).length} blobs`);
console.log("frame\tfighterL\tringL\tabsDL\tdE00\tframeL\tlocalDL");
for (const path of frames) {
  const image = await load(path);
  if (image.width !== width || image.height !== height) throw new Error(`${path}: mask and frame dimensions differ`);
  const sum = (sel: (i: number) => boolean) => { let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < width * height; i++) if (sel(i)) { r += image.rgb[i * 3]!; g += image.rgb[i * 3 + 1]!; b += image.rgb[i * 3 + 2]!; n++; } return lab(r / n, g / n, b / n); };
  const f = sum(i => fighter[i] === 1), ring = sum(i => outer[i] === 1 && inner[i] === 0), all = sum(() => true);
  // Mean absolute lightness step between each fighter pixel and the ring mean.
  let local = 0; for (let i = 0; i < width * height; i++) if (fighter[i]) local += Math.abs(lab(image.rgb[i * 3]!, image.rgb[i * 3 + 1]!, image.rgb[i * 3 + 2]!)[0] - ring[0]);
  const name = path.split("/").pop();
  console.log(`${name}\t${f[0].toFixed(1)}\t${ring[0].toFixed(1)}\t${Math.abs(f[0] - ring[0]).toFixed(1)}\t${de2000(f, ring).toFixed(1)}\t${all[0].toFixed(1)}\t${(local / fighterCount).toFixed(1)}`);
}
