import { expect, test } from "bun:test";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { Effect } from "effect";
import { PREVIEW_FIGHTERS, composePreview, encodeTga, encodePreview } from "../scripts/mapPreview";
import { previewImport } from "../scripts/wisp/mapInputs";

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
