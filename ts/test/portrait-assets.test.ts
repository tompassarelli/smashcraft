import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readTga } from "../scripts/blp";
import { INPUTS_STORE, MANIFEST } from "../scripts/wisp/buildInputs";
import { MAP_PORTRAITS } from "../scripts/wisp/mapInputs";

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const family = join(INPUTS_STORE, "fighter-renders", manifest["fighter-renders"]);

test.skipIf(!existsSync(family))("every imported HUD and selection portrait has the shared render size and cut-out or round stock alpha [spec #323]", () => {
  for (const entry of MAP_PORTRAITS) {
    const file = join(family, entry.replace("war3mapImported\\", "").replace(/\.blp$/, ".tga"));
    const image = readTga(readFileSync(file));
    const kind = /Fighter(Card|Bust|Tile|Stock)/.exec(entry)?.[1];
    const size = kind === "Card" ? 384 : kind === "Stock" ? 64 : 256;
    expect([image.width, image.height], entry).toEqual([size, size]);
    if (kind === "Tile") continue;
    expect(image.alpha, entry).toBe(true);
    let opaque = 0, outsideCircle = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const alpha = image.data[(y * size + x) * 4 + 3] ?? 0;
      if (alpha > 0) opaque++;
      if (kind === "Stock" && Math.hypot(x / size - 0.5, y / size - 0.5) >= 0.5 && alpha > 0) outsideCircle++;
    }
    expect(opaque, entry).toBeGreaterThan(0);
    expect(opaque, entry).toBeLessThan(size * size);
    expect(outsideCircle, entry).toBe(0);
  }
});
