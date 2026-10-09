import { expect, test } from "bun:test";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { Effect } from "effect";
import { readTga } from "../scripts/blp";
import { PREVIEW_ENTRY, PREVIEW_FIGHTERS, PREVIEW_SIZE, composePreview, encodeTga, encodePreview } from "../scripts/mapPreview";
import { previewImport } from "../scripts/wisp/mapInputs";
import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";

test("the build packages the lineup at the minimap entry shown by Classic and Definitive lobbies [native]", async () => {

  const assets = mkdtempSync(join(tmpdir(), "smashcraft-preview-test-"));
  try {
    mkdirSync(join(assets, "fighter-renders"));
    const card = { width: 8, height: 8, data: new Uint8Array(256).fill(200), alpha: true };
    for (const { card: file } of PREVIEW_FIGHTERS) await Bun.write(join(assets, "fighter-renders", file), encodeTga(card));
    const packaged = await Effect.runPromise(previewImport(assets));
    expect(packaged.entry).toBe("war3mapMap.blp");
    expect(Array.from(await Bun.file(packaged.source).bytes())).toEqual(Array.from(encodePreview(composePreview(() => card))));
  } finally {
    rmSync(assets, { recursive: true });
  }
});

test("the lobby preview uses the captured opaque RGB palette quantization [native]", () => {
  const image = { width: 1, height: 1, data: Uint8Array.from([200, 100, 50, 255]), alpha: false };
  const encoded = encodePreview(image);
  expect(encoded[1180]).toBe(204);
  expect(Array.from(encoded.slice(156 + 204 * 4, 160 + 204 * 4))).toEqual([0, 109, 219, 0]);
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
