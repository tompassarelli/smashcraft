import { expect, test } from "bun:test";
import { join } from "node:path";
import { readTga } from "../scripts/blp";
import { PREVIEW_ENTRY, PREVIEW_FIGHTERS, PREVIEW_SIZE, composePreview, encodeTga } from "../scripts/mapPreview";
import { readMapBaseline } from "../scripts/mapSize";
import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";

test("the built map carries war3mapPreview.tga at its root, as measured from the last default build [spec #317]", () => {
  // map-size-baseline.tsv lists the entries of a real built map's archive (`MAP_SIZE_UPDATE=1 bun wisp map build`).
  const baseline = readMapBaseline(join(import.meta.dir, "../map-size-baseline.tsv"));
  expect(PREVIEW_ENTRY).toBe("war3mapPreview.tga");
  expect(baseline?.imports.get(PREVIEW_ENTRY) ?? 0).toBeGreaterThan(0);
});

test("the preview is a 256x256 32-bit uncompressed TGA of stock-model fighters only [spec #317]", () => {
  const card = { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4).fill(200), alpha: true };
  const tga = encodeTga(composePreview(() => card));
  expect([tga[2], tga[16], tga.length]).toEqual([2, 32, 18 + PREVIEW_SIZE * PREVIEW_SIZE * 4]);
  const decoded = readTga(tga);
  expect([decoded.width, decoded.height]).toEqual([256, 256]);
  const community = IMPORTED_MODEL_FILES.map(({ file }) => file.replace(/\d*\.mdx$/i, "").toLowerCase());
  for (const { card: file } of PREVIEW_FIGHTERS) expect(community.some((name) => file.toLowerCase().includes(name))).toBe(false);
});
