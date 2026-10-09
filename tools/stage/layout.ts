









import { $ } from "bun";

const WIDTH = 640, HEIGHT = 360, SCENE_DE = 12, LIMIT = 5;
export const EMPTY_BACKDROP_LIMIT = 10;
const TOP = 0.08, BOTTOM = 0.76;

async function lab(path: string): Promise<Float32Array> {
  const rgb = new Uint8Array(await $`magick ${path} -alpha off -resize ${WIDTH}x${HEIGHT}! -depth 8 rgb:-`.arrayBuffer());
  if (rgb.length !== WIDTH * HEIGHT * 3) throw new Error(`${path}: malformed RGB image`);
  const out = new Float32Array(WIDTH * HEIGHT * 3);
  const linear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    const [r, g, b] = [linear(rgb[i * 3]!), linear(rgb[i * 3 + 1]!), linear(rgb[i * 3 + 2]!)];
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    out[i * 3] = 116 * y - 16; out[i * 3 + 1] = 500 * (x - y); out[i * 3 + 2] = 200 * (y - z);
  }
  return out;
}


function coverage(sky: Float32Array, image: Float32Array): number[] {
  const top = Math.floor(HEIGHT * TOP), bottom = Math.floor(HEIGHT * BOTTOM);
  const scene = new Uint8Array(WIDTH * HEIGHT);
  for (let i = top * WIDTH; i < bottom * WIDTH; i++)
    scene[i] = Math.hypot(image[i * 3]! - sky[i * 3]!, image[i * 3 + 1]! - sky[i * 3 + 1]!, image[i * 3 + 2]! - sky[i * 3 + 2]!) > SCENE_DE ? 1 : 0;
  const shares: number[] = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
    const y0 = top + Math.floor((bottom - top) * row / 3), y1 = top + Math.floor((bottom - top) * (row + 1) / 3);
    const x0 = Math.floor(WIDTH * column / 3), x1 = Math.floor(WIDTH * (column + 1) / 3);
    let on = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) on += scene[y * WIDTH + x]!;
    shares.push(100 * on / ((y1 - y0) * (x1 - x0)));
  }
  return shares;
}

export async function emptyBackdropShare(skyPath: string, imagePath: string, horizon: number): Promise<number> {
  if (!Number.isFinite(horizon) || horizon < 0 || horizon >= BOTTOM) throw new Error(`horizon row ${horizon} is outside 0 to ${BOTTOM}`);
  const sky = await lab(skyPath), image = await lab(imagePath);
  const top = Math.floor(HEIGHT * horizon), bottom = Math.floor(HEIGHT * BOTTOM);
  let empty = 0;
  for (let i = top * WIDTH; i < bottom * WIDTH; i++)
    if (Math.hypot(image[i * 3]! - sky[i * 3]!, image[i * 3 + 1]! - sky[i * 3 + 1]!, image[i * 3 + 2]! - sky[i * 3 + 2]!) <= SCENE_DE) empty++;
  return 100 * empty / ((bottom - top) * WIDTH);
}

const args = Bun.argv.slice(2);
if (import.meta.main && args[0] === "--empty") {
  const [, skyPath, imagePath, horizonText] = args;
  const horizon = Number(horizonText);
  if (skyPath === undefined || imagePath === undefined)
    throw new Error("usage: bun tools/stage/layout.ts --empty SKY.png FRAME.png HORIZON_ROW_FRACTION");
  const share = await emptyBackdropShare(skyPath, imagePath, horizon);
  console.log(`${share <= EMPTY_BACKDROP_LIMIT ? "PASS" : "FAIL"} ${imagePath}: empty backdrop ${share.toFixed(2)}% (limit ${EMPTY_BACKDROP_LIMIT}%), horizon row ${horizon.toFixed(4)}`);
  process.exit(share <= EMPTY_BACKDROP_LIMIT ? 0 : 1);
}
if (import.meta.main) {
  const [skyPath, nativePath, wispPath] = args;
  if (skyPath === undefined || nativePath === undefined || wispPath === undefined) throw new Error("usage: bun tools/stage/layout.ts SKY.png NATIVE.png WISP.png");
  const sky = await lab(skyPath);
  const native = coverage(sky, await lab(nativePath)), wisp = coverage(sky, await lab(wispPath));
  const cells = ["top-left", "top", "top-right", "left", "middle", "right", "low-left", "low", "low-right"];
  let worst = 0;
  console.log("cell\tnative\twisp\tdiff");
  cells.forEach((name, index) => {
    const difference = (wisp[index] ?? 0) - (native[index] ?? 0);
    worst = Math.max(worst, Math.abs(difference));
    console.log(`${name}\t${(native[index] ?? 0).toFixed(1)}\t${(wisp[index] ?? 0).toFixed(1)}\t${difference >= 0 ? "+" : ""}${difference.toFixed(1)}`);
  });
  console.log(`${worst <= LIMIT ? "PASS" : "FAIL"} worst cell ${worst.toFixed(1)} points (limit ${LIMIT})`);
}
