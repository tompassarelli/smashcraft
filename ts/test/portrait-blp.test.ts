import { expect, test } from "bun:test";
import { join } from "node:path";
import { decodeBLP, getBLPImageData } from "war3-model";
import { PORTRAIT_QUALITY, encodeBlp } from "../scripts/blp";
import { readMapBaseline } from "../scripts/mapSize";
import { MAP_PORTRAITS } from "../scripts/wisp/mapInputs";

/** Built-map bytes the fighter portraits may take; #307's decision on quality versus size sets it. */
const PORTRAIT_BUDGET = 12_500_000;

test("portraits are imported as BLP and stay within their map budget in the committed size baseline [spec #307]", () => {
  const names = MAP_PORTRAITS;
  expect(names.filter((name) => !name.endsWith(".blp"))).toEqual([]);
  const baseline = readMapBaseline(join(import.meta.dir, "../map-size-baseline.tsv"));
  const rows = [...(baseline?.imports ?? new Map<string, number>())].filter(([entry]) => /Fighter(Card|Bust|Tile|Stock)/.test(entry));
  expect(rows.filter(([entry]) => !entry.endsWith(".blp"))).toEqual([]);
  expect(rows.map(([entry]) => entry).sort()).toEqual([...names].sort());
  expect(rows.reduce((sum, [, bytes]) => sum + bytes, 0)).toBeLessThanOrEqual(PORTRAIT_BUDGET);
});

test("a portrait BLP decodes in war3-model to its source within JPEG error, alpha included [reference]", () => {
  const width = 24, height = 16, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([x * 10, y * 15, 200 - x * 5, x < 6 ? 0 : 255], (y * width + x) * 4);
  }
  const blp = encodeBlp({ width, height, data, alpha: true }, PORTRAIT_QUALITY);
  const decoded = decodeBLP(blp.slice().buffer);
  expect([decoded.width, decoded.height, decoded.content, decoded.alphaBits, decoded.mipmaps.length]).toEqual([width, height, 0, 8, 1]);
  // Warcraft rejects BLP JPEG headers longer than 624 bytes.
  expect(new DataView(blp.buffer).getUint32(156, true)).toBeLessThanOrEqual(624);
  const pixels = getBLPImageData(decoded, 0).data;
  let worst = 0;
  for (let i = 0; i < data.length; i++) worst = Math.max(worst, Math.abs((pixels[i] ?? 0) - (data[i] ?? 0)));
  expect(worst).toBeLessThanOrEqual(8);
});
