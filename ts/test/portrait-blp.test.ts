import { expect, test } from "bun:test";
import { decodeBLP, getBLPImageData } from "war3-model";
import { PORTRAIT_QUALITY, encodeBlp } from "../scripts/blp";

test("a portrait BLP decodes in war3-model to its source within JPEG error, alpha included [k4 reference war3-model]", () => {
  const width = 24, height = 16, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([x * 10, y * 15, 200 - x * 5, x < 6 ? 0 : 255], (y * width + x) * 4);
  }
  const blp = encodeBlp({ width, height, data, alpha: true }, PORTRAIT_QUALITY);
  const decoded = decodeBLP(blp.slice().buffer);
  expect([decoded.width, decoded.height, decoded.content, decoded.alphaBits, decoded.mipmaps.length]).toEqual([width, height, 0, 8, 1]);

  expect(new DataView(blp.buffer).getUint32(156, true)).toBeLessThanOrEqual(624);
  const pixels = getBLPImageData(decoded, 0).data;
  let worst = 0;
  for (let i = 0; i < data.length; i++) worst = Math.max(worst, Math.abs((pixels[i] ?? 0) - (data[i] ?? 0)));
  expect(worst).toBeLessThanOrEqual(8);
});
