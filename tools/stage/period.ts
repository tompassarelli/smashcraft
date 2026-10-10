import { decodePpm, type Frame } from "../../ts/node_modules/wisp/scripts/wisp/frameProbe";

type Box = readonly [x0: number, y0: number, x1: number, y1: number];
type Columns = readonly [x0: number, x1: number];

export function horizontalPeriod(frame: Frame, box: Box, excluded: readonly Columns[] = [], projectedPeriod?: number) {
  const [x0, y0, x1, y1] = box;
  const width = x1 - x0, height = y1 - y0;
  if (box.some(n => !Number.isInteger(n)) || x0 < 0 || y0 < 0 || x1 > frame.width || y1 > frame.height || width < 128 || height < 1) throw Error("invalid deck box");
  if (excluded.some(([a, b]) => !Number.isInteger(a) || !Number.isInteger(b) || a < x0 || b > x1 || a >= b)) throw Error("invalid excluded columns");
  const luma = new Float64Array(width * height), horizontal = new Float64Array(luma.length), hp = new Float64Array(luma.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = ((y + y0) * frame.width + x + x0) * 3;
    luma[y * width + x] = 0.299 * (frame.rgb[pixel] ?? 0) + 0.587 * (frame.rgb[pixel + 1] ?? 0) + 0.114 * (frame.rgb[pixel + 2] ?? 0);
  }
  const radius = 32, diameter = 65;
  const clamp = (n: number, limit: number) => Math.min(limit - 1, Math.max(0, n));
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += luma[y * width + clamp(x, width)] ?? 0;
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / diameter;
      sum += (luma[y * width + clamp(x + radius + 1, width)] ?? 0) - (luma[y * width + clamp(x - radius, width)] ?? 0);
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += horizontal[clamp(y, height) * width + x] ?? 0;
    for (let y = 0; y < height; y++) {
      hp[y * width + x] = (luma[y * width + x] ?? 0) - sum / diameter;
      sum += (horizontal[clamp(y + radius + 1, height) * width + x] ?? 0) - (horizontal[clamp(y - radius, height) * width + x] ?? 0);
    }
  }
  const mean = hp.reduce((sum, v) => sum + v, 0) / hp.length;
  for (let i = 0; i < hp.length; i++) hp[i] = (hp[i] ?? 0) - mean;
  const visible = (x: number) => !excluded.some(([a, b]) => x + x0 >= a && x + x0 < b);
  const correlation = (lag: number) => {
    let n = 0, a = 0, b = 0, aa = 0, bb = 0, ab = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width - lag; x++) {
      if (!visible(x) || !visible(x + lag)) continue;
      const left = hp[y * width + x] ?? 0, right = hp[y * width + x + lag] ?? 0;
      n++; a += left; b += right; aa += left * left; bb += right * right; ab += left * right;
    }
    const norm = Math.sqrt((aa - a * a / n) * (bb - b * b / n));
    return { lag, r: norm > 0 ? (ab - a * b / n) / norm : null, pixels: n };
  };
  const maxLag = Math.min(700, Math.floor(width / 2));
  let peak = correlation(64);
  for (let lag = 65; lag <= maxLag; lag++) {
    const row = correlation(lag);
    if (row.r !== null && (peak.r === null || row.r > peak.r)) peak = row;
  }
  if (peak.r === null) throw Error("deck box has no measurable variation");
  if (projectedPeriod !== undefined && (!Number.isInteger(projectedPeriod) || projectedPeriod < 1 || projectedPeriod >= width)) throw Error("invalid projected period");
  return { box, excludedColumns: excluded, blurRadius: radius, lagRange: [64, maxLag], normalization: "Pearson over overlap; each side independently centered; both columns must be unmasked", peak, projected: projectedPeriod === undefined ? null : correlation(projectedPeriod), pass: peak.r < 0.3 };
}

if (import.meta.main) {
  const [path, boxText, excludedText, projectedText] = Bun.argv.slice(2);
  if (path === undefined || boxText === undefined) throw Error("usage: bun tools/stage/period.ts IMAGE.ppm X0,Y0,X1,Y1 [EXCLUDED_X0:X1,...|-] [PROJECTED_PERIOD_PX]");
  const numbers = boxText.split(",").map(Number);
  if (numbers.length !== 4) throw Error("box needs four coordinates");
  const box: Box = [numbers[0] ?? NaN, numbers[1] ?? NaN, numbers[2] ?? NaN, numbers[3] ?? NaN];
  const excluded = excludedText === undefined || excludedText === "-" ? [] : excludedText.split(",").map(text => {
    const values = text.split(":").map(Number);
    if (values.length !== 2) throw Error("excluded range needs two columns");
    return [values[0] ?? NaN, values[1] ?? NaN] as const;
  });
  const frame = decodePpm(await Bun.file(path).bytes());
  if (frame === undefined) throw Error("input must be an RGB PPM image");
  console.log(JSON.stringify(horizontalPeriod(frame, box, excluded, projectedText === undefined ? undefined : Number(projectedText))));
}
