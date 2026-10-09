
// MIT-licensed erickfm/melee-ranked-replays dataset on Hugging Face.

import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DATASET = "https://huggingface.co/datasets/erickfm/melee-ranked-replays/resolve/main";
export const ROOT = process.env.SLIPPI_DATA ?? join(process.env.HOME!, ".local/share/smashcraft-slippi");
export const CHARS = ["FOX", "FALCO", "MARTH", "SHEIK", "JIGGLYPUFF", "CPTFALCON", "PEACH"];
export const RANKS = ["master-master", "diamond-diamond", "platinum-platinum"];
const PER_CHAR: Record<string, number> = {
  "master-master": Number(process.env.N_MASTER ?? 220),
  "diamond-diamond": Number(process.env.N_LOW ?? 70),
  "platinum-platinum": Number(process.env.N_LOW ?? 70),
};
const ARCHIVE = process.env.ARCHIVE ?? "a1";

if (import.meta.main) {
  for (const rank of RANKS) {
    const n = PER_CHAR[rank]!;
    for (const ch of CHARS) {
      const dir = join(ROOT, rank, ch);
      mkdirSync(dir, { recursive: true });
      const have = readdirSync(dir).filter((f) => f.endsWith(".slp")).length;
      if (have >= n) continue;
      const url = `${DATASET}/${ch}/${ch}_${rank}_${ARCHIVE}.tar.gz`;

      const cmd = `curl -sL --fail '${url}' | tar -xzv -C '${dir}' 2>/dev/null | head -n ${n} > /dev/null`;
      const p = Bun.spawnSync(["sh", "-c", cmd]);
      const got = readdirSync(dir).filter((f) => f.endsWith(".slp")).length;
      console.log(`${rank} ${ch}: ${got} replays (exit ${p.exitCode})`);
    }
  }
}
