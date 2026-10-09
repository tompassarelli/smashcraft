




import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";


export const SOURCE_STAMP_TEXT = '"%%SOURCE%%%%"';

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
