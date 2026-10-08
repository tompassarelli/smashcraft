// #141: every map build stamps its source version over the placeholder in
// src/game/shell/sourceVersion.ts, so replays from development maps name a
// real version too; unstamped code says "development".
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import plugin from "../plugins/source-version";
import { SOURCE_STAMP_TEXT, sourceVersion } from "../scripts/sourceVersion";
import { DEVELOPMENT_SOURCE, sourceVersion as runtimeVersion } from "../src/game/shell/sourceVersion";

const ts = join(import.meta.dir, "..");

test("the build replaces the placeholder with the source version, which unstamped code reads as development [spec #141]", () => {
  expect(readFileSync(join(ts, "src/game/shell/sourceVersion.ts"), "utf8")).toContain(`const SOURCE_STAMP = ${SOURCE_STAMP_TEXT};`);
  expect(runtimeVersion()).toBe(DEVELOPMENT_SOURCE);
  const version = sourceVersion(ts);
  expect(version).toMatch(/^[0-9a-f]{12}$/);
  const files = [{ code: `local SOURCE_STAMP = ${SOURCE_STAMP_TEXT}\n` }];
  plugin().beforeEmit?.(undefined as never, undefined as never, undefined as never, files as never);
  expect(files[0]?.code).toBe(`local SOURCE_STAMP = "${version}"\n`);
  for (const config of ["tsconfig.map.json", "tsconfig.stack-trace.json"]) {
    expect(readFileSync(join(ts, config), "utf8"), config).toContain("./plugins/source-version.ts");
  }
});
