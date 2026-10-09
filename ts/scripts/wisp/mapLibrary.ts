import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, join } from "node:path";
import { PLAYABLE_FILE, pruneTargets } from "./greenBuilds";


const PLAYABLE = PLAYABLE_FILE;


export function installLatest(documents: string, map: string): void {
  const root = join(documents, "Maps/00-Smashcraft");
  const older = join(root, "older");
  const tests = join(root, "tests");
  for (const dir of [root, older, tests]) mkdirSync(dir, { recursive: true });
  const name = basename(map);
  if (!PLAYABLE.test(name)) throw new Error(`not a playable map: ${name}`);

  const staged = join(root, `${name}.${process.pid}.next`);
  copyFileSync(map, staged);
  renameSync(staged, join(root, name));
  for (const entry of pruneTargets(readdirSync(root), name)) {
    const target = join(older, entry);
    if (!existsSync(target)) renameSync(join(root, entry), target);
  }
  for (const entry of readdirSync(root).filter((entry) => /\b(?:diagnostic|integrity|probe|test)\b.*\.w3x$/i.test(entry))) {
    const target = join(tests, entry);
    if (!existsSync(target)) renameSync(join(root, entry), target);
  }
}


export function newestPlayable(documents: string): string | undefined {
  const root = join(documents, "Maps/00-Smashcraft");
  if (!existsSync(root)) return undefined;
  return readdirSync(root).filter((entry) => PLAYABLE.test(entry)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
}
