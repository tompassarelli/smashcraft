// Measured model facts, one file per model under model-facts/ so two lanes that
// measure different models never edit the same file (#401). Written by `bun wisp
// view models`, tools/animations/white-flash-models.ts, timeline-models.ts and
// tools/stage/package.ts through writeModelFacts; regenerate instead of editing.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelFacts } from "wisp/scripts/wisp/models";

export const MODEL_FACTS_DIRECTORY = join(import.meta.dir, "model-facts");

/** Facts with every number rounded to 3 decimals, as the measuring writers store them. */
export function roundedFacts(facts: ModelFacts): ModelFacts {
  const rounded: ModelFacts = JSON.parse(JSON.stringify(facts, (_key, value: unknown) => typeof value === "number" ? Math.round(value * 1000) / 1000 : value));
  return rounded;
}

/** The shard holding one model: its path made file-safe, plus a hash of the exact path so names differing only by case stay apart. */
export const modelFactsFile = (model: string) =>
  `${model.replace(/[^A-Za-z0-9._-]+/g, "_")}.${new Bun.CryptoHasher("sha256").update(model).digest("hex").slice(0, 8)}.json`;

export function readModelFacts(directory = MODEL_FACTS_DIRECTORY): Record<string, ModelFacts> {
  const facts: Record<string, ModelFacts> = {};
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".json")).sort()) {
    const shard: { readonly model: string; readonly facts: ModelFacts } = JSON.parse(readFileSync(join(directory, file), "utf8"));
    facts[shard.model] = shard.facts;
  }
  return facts;
}

/** Makes the shards exactly `facts`: writes each changed model's file and removes the files of models no longer listed. */
export function writeModelFacts(facts: Readonly<Record<string, ModelFacts>>, directory = MODEL_FACTS_DIRECTORY): void {
  mkdirSync(directory, { recursive: true });
  const wanted = new Map(Object.entries(facts).map(([model, entry]) => [modelFactsFile(model), `${JSON.stringify({ model, facts: entry })}\n`]));
  for (const file of readdirSync(directory)) if (file.endsWith(".json") && !wanted.has(file)) rmSync(join(directory, file));
  for (const [file, text] of wanted) {
    const path = join(directory, file);
    let current: string | undefined;
    try { current = readFileSync(path, "utf8"); } catch { current = undefined; }
    if (current !== text) writeFileSync(path, text);
  }
}
