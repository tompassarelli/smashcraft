// The generated menu files match their definitions (scripts/wisp/uiFrames.ts).
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateFrames } from "wisp/scripts/wisp/frames";
import { UI_FRAMES, UI_FRAMES_IMPORTS } from "../scripts/wisp/uiFrames";

const ts = join(import.meta.dir, "..");

test("every generated FDF, TOC and bindings file is current; regenerate with `bun scripts/wisp/uiFrames.ts`", () => {
  for (const { definition, bindings } of UI_FRAMES) {
    const generated = generateFrames(definition);
    expect(readFileSync(join(ts, UI_FRAMES_IMPORTS, `${definition.name}.fdf`), "utf8")).toBe(generated.fdf);
    expect(readFileSync(join(ts, UI_FRAMES_IMPORTS, `${definition.name}.toc`), "utf8")).toBe(generated.toc);
    expect(readFileSync(join(ts, bindings), "utf8")).toBe(generated.bindings);
  }
});
