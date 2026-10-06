import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installLatest } from "../scripts/wisp/mapLibrary";
import { playVersion } from "../scripts/wisp/currentPlaytest";

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
    writeFileSync(join(maps, "Smashcraft 0.0.49 test 1.w3x"), "one-off");
    const latest = join(root, "Smashcraft 0.0.50.w3x");
    writeFileSync(latest, "current");
    installLatest(root, latest);
    expect(readdirSync(maps).sort()).toEqual(["Smashcraft 0.0.48.w3x", "Smashcraft 0.0.49.w3x", "Smashcraft 0.0.50.w3x", "older", "tests"]);
    expect(readFileSync(join(maps, "older/Smashcraft 0.0.47.w3x"), "utf8")).toBe("version 47");
    expect(readFileSync(join(maps, "tests/Smashcraft diagnostic.w3x"), "utf8")).toBe("test");
    expect(readFileSync(join(maps, "tests/Smashcraft 0.0.49 test 1.w3x"), "utf8")).toBe("one-off");
    installLatest(root, latest);
    expect(readFileSync(join(maps, "Smashcraft 0.0.50.w3x"), "utf8")).toBe("current");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a new build of main takes the next version after every one built or in the library; a built one keeps its number", () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-play-version-"));
  try {
    const library = join(root, "Maps/00-Smashcraft");
    const builds = join(root, "builds");
    mkdirSync(join(library, "older"), { recursive: true });
    writeFileSync(join(library, "Smashcraft 0.0.49.w3x"), "");
    writeFileSync(join(library, "older/Smashcraft 0.0.9.w3x"), "");
    expect(playVersion(builds, library, "a")).toBe("0.0.50");
    mkdirSync(join(builds, "a"), { recursive: true });
    writeFileSync(join(builds, "a/Smashcraft 0.0.50.w3x"), "");
    expect(playVersion(builds, library, "a")).toBe("0.0.50");
    expect(playVersion(builds, library, "b")).toBe("0.0.51");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
