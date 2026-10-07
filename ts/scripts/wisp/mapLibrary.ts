import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, join } from "node:path";

/** A version the owner plays; one-off builds add a suffix ("Smashcraft 0.0.50 test 1") and go to tests/. */
const PLAYABLE = /^Smashcraft \d+\.\d+\.\d+\.w3x$/;

/** Keep the newest version and the two before it visible; older versions go to older/, diagnostics and tests to tests/. */
export function installLatest(documents: string, map: string): void {
  const root = join(documents, "Maps/00-Smashcraft");
  const older = join(root, "older");
  const tests = join(root, "tests");
  for (const dir of [root, older, tests]) mkdirSync(dir, { recursive: true });
  const name = basename(map);
  if (!PLAYABLE.test(name)) throw new Error(`not a playable map: ${name}`);
  // A copy of this process's own, renamed in: a running game may read the old file, and two installs never share a copy.
  const staged = join(root, `${name}.${process.pid}.next`);
  copyFileSync(map, staged);
  renameSync(staged, join(root, name));
  const versions = readdirSync(root).filter((entry) => PLAYABLE.test(entry) && entry !== name);
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const entry of versions.slice(2)) {
    const target = join(older, entry);
    if (!existsSync(target)) renameSync(join(root, entry), target);
  }
  for (const entry of readdirSync(root).filter((entry) => /\b(?:diagnostic|integrity|probe|test)\b.*\.w3x$/i.test(entry))) {
    const target = join(tests, entry);
    if (!existsSync(target)) renameSync(join(root, entry), target);
  }
}

/** The newest playable version in the owner's Smashcraft maps folder, as `install` keeps it. */
export function newestPlayable(documents: string): string | undefined {
  const root = join(documents, "Maps/00-Smashcraft");
  if (!existsSync(root)) return undefined;
  return readdirSync(root).filter((entry) => PLAYABLE.test(entry)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
}
