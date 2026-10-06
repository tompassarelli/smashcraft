import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installLatest } from "../scripts/wisp/mapLibrary";

test("latest installation keeps two previous versions and puts diagnostics in tests", () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-map-library-"));
  try {
    const maps = join(root, "Maps/00-Smashcraft");
    mkdirSync(maps, { recursive: true });
    for (const version of [47, 48, 49]) {
      const path = join(maps, `Smashcraft 0.0.${version}.w3x`);
      writeFileSync(path, `version ${version}`);
      utimesSync(path, version, version);
    }
    writeFileSync(join(maps, "Smashcraft diagnostic.w3x"), "test");
    const latest = join(root, "Smashcraft latest abc12345.w3x");
    writeFileSync(latest, "current");
    installLatest(root, latest);
    expect(readdirSync(maps).sort()).toEqual(["Smashcraft 0.0.48.w3x", "Smashcraft 0.0.49.w3x", "Smashcraft latest abc12345.w3x", "older", "tests"]);
    expect(readFileSync(join(maps, "older/Smashcraft 0.0.47.w3x"), "utf8")).toBe("version 47");
    expect(readFileSync(join(maps, "tests/Smashcraft diagnostic.w3x"), "utf8")).toBe("test");
    installLatest(root, latest);
    expect(readFileSync(join(maps, "Smashcraft latest abc12345.w3x"), "utf8")).toBe("current");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
