import type { ModelFacts } from "wisp/scripts/wisp/models";
import { roundedFacts } from "./modelFactsTable";

/** The model table with the white fighter bodies replaced by `white`, for writeModelFacts. */
export function whiteModelFactsTable(
  existing: Readonly<Record<string, ModelFacts>>,
  paths: readonly string[],
  white: Readonly<Record<string, ModelFacts>>,
): Record<string, ModelFacts> {
  const rows = Object.entries(existing).filter(([path]) => !/^war3mapImported\\[A-Za-z]+White-[a-f0-9]{64}\.mdx$/.test(path));
  for (const path of paths) {
    const facts = white[path.replaceAll("\\", "/").toLowerCase()];
    if (facts === undefined) throw new Error(`Missing white model facts: ${path}`);
    rows.push([path, roundedFacts(facts)]);
  }
  return Object.fromEntries(rows);
}
