// The source version a map and a replay viewer are stamped with
// (smashcraft:ts/src/game/shell/sourceVersion.ts): the first 12 hex digits of
// a SHA-256 over every source file under src/ but tests (path and text, line
// endings as LF) and the pinned Wisp revision. Same source, same version, on
// every platform; a replay plays on the version that recorded it.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const isSource = (path: string) => path.endsWith(".ts") && !/\.(tests|soak|test)\.ts$/.test(path);

export function sourceVersion(tsDirectory: string): string {
  const hash = createHash("sha256");
  const files = readdirSync(join(tsDirectory, "src"), { recursive: true, encoding: "utf8" })
    .map((path) => path.replaceAll("\\", "/"))
    .filter(isSource)
    .sort();
  for (const path of files) {
    hash.update(`${path}\n`);
    hash.update(readFileSync(join(tsDirectory, "src", path), "utf8").replaceAll("\r\n", "\n"));
  }
  hash.update(readFileSync(join(tsDirectory, "wisp.lock"), "utf8").replaceAll("\r\n", "\n"));
  return hash.digest("hex").slice(0, 12);
}
