import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { playVersion } from "../scripts/wisp/currentPlaytest";

test("a new build of main takes the next version after every one built or in the library; a built one keeps its number [spec docs/play.md]", () => {
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

    writeFileSync(join(builds, "b.version"), "0.0.51\n");
    expect(playVersion(builds, library, "b")).toBe("0.0.51");
    expect(playVersion(builds, library, "c")).toBe("0.0.52");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
