// The measured model table, read from its per-model shards (modelFactsTable.ts); regenerate instead of editing.
import type { ModelFacts } from "wisp/scripts/wisp/models";
import { readModelFacts } from "./modelFactsTable";

export const MODEL_FACTS: Readonly<Record<string, ModelFacts>> = readModelFacts();
