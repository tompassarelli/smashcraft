// Writes the release roster (src/game/sim/heroes/releaseRoster.ts) from a balance
// gate run: every fighter outside the gate's field band is hidden from selection.
// Usage (from ts/): bun scripts/releaseRoster.ts FIELD.json
// FIELD.json is a `cpuField --json` file (a gate run: level 9, at least 400 a pair).
import { readFileSync, writeFileSync } from "node:fs";
import { BALANCE_GATE, type FieldOptions, type FighterSummary, balanceVerdict, matchupReport } from "./cpuField";

export const RELEASE_ROSTER_FILE = new URL("../src/game/sim/heroes/releaseRoster.ts", import.meta.url);

type Field = { readonly options: Pick<FieldOptions, "levels">; readonly summaries: readonly FighterSummary[] };

/** Whether a parsed file looks like a `cpuField --json` field: options and fighter summaries. */
function isField(value: unknown): value is Field {
  return typeof value === "object" && value !== null && "options" in value && typeof value.options === "object" && value.options !== null
    && "summaries" in value && Array.isArray(value.summaries)
    && value.summaries.every((s: unknown) => typeof s === "object" && s !== null && "fighter" in s && "winRate" in s && "played" in s && "against" in s && "decisive" in s);
}

/** The fighters a gate run hides: those outside the field band. Refuses a run that isn't a gate run. */
export function hiddenFighters(field: Field): readonly string[] {
  const levels = field.options.levels ?? [BALANCE_GATE.level, BALANCE_GATE.level];
  const verdict = balanceVerdict(field.summaries, levels, matchupReport(field.summaries).smallestPlayed);
  if (!verdict.gateRun) throw new Error(`not a gate run: needs level ${BALANCE_GATE.level} and at least ${BALANCE_GATE.perPair} matches a pair`);
  const hidden = verdict.outside.map((entry) => entry.split(" ")[0] ?? entry);
  if (hidden.length === field.summaries.length) throw new Error("every fighter fails the gate; a release needs at least one");
  return hidden;
}

export function releaseRosterSource(hidden: readonly string[]): string {
  const old = readFileSync(RELEASE_ROSTER_FILE, "utf8");
  const list = hidden.length === 0 ? "[]" : `[${hidden.map((slug) => JSON.stringify(slug)).join(", ")}]`;
  return old.replace(/export const HIDDEN_FIGHTERS: readonly string\[\] = \[[^\]]*\];/, `export const HIDDEN_FIGHTERS: readonly string[] = ${list};`);
}

if (import.meta.main) {
  const file = process.argv[2];
  if (file === undefined || process.argv.length > 3) throw new Error("usage: bun scripts/releaseRoster.ts FIELD.json");
  const field: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isField(field)) throw new Error(`${file} holds no cpuField --json field`);
  const hidden = hiddenFighters(field);
  writeFileSync(RELEASE_ROSTER_FILE, releaseRosterSource(hidden));
  console.log(hidden.length === 0 ? "Release roster: every fighter passes; none hidden." : `Release roster: hidden ${hidden.join(", ")}.`);
}
