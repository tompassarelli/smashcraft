import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { basename, join } from "node:path";

/** Keep the owner's playable builds visible; diagnostics belong in tests/. */
export function installLatest(documents: string, map: string): void {
  const root = join(documents, "Maps/00-Smashcraft");
  const older = join(root, "older");
  const tests = join(root, "tests");
  for (const dir of [root, older, tests]) mkdirSync(dir, { recursive: true });
  const name = basename(map);
  if (!/^Smashcraft latest [a-f0-9]+\.w3x$/.test(name)) throw new Error(`not a latest playable map: ${name}`);
  copyFileSync(map, join(root, `${name}.next`));
  renameSync(join(root, `${name}.next`), join(root, name));
  const versions = readdirSync(root).filter((entry) => /^Smashcraft (?:latest [a-f0-9]+|\d+\.\d+\.\d+)\.w3x$/.test(entry) && entry !== name);
  versions.sort((a, b) => statSync(join(root, b)).mtimeMs - statSync(join(root, a)).mtimeMs || b.localeCompare(a, undefined, { numeric: true }));
  for (const entry of versions.slice(2)) {
    const target = join(older, entry);
    if (!existsSync(target)) renameSync(join(root, entry), target);
  }
  for (const entry of readdirSync(root).filter((entry) => /\b(?:diagnostic|integrity|probe|test)\b.*\.w3x$/i.test(entry))) {
    const target = join(tests, entry);
    if (!existsSync(target)) renameSync(join(root, entry), target);
  }
}
