



import { readFileSync, writeFileSync } from "node:fs";
import { BALANCE_GATE, type FieldOptions, type FighterSummary, balanceVerdict, matchupReport } from "./cpuField";

const RELEASE_ROSTER_FILE = new URL("../src/game/sim/heroes/releaseRoster.ts", import.meta.url);

type Field = { readonly options: Pick<FieldOptions, "opponents" | "tiers">; readonly summaries: readonly FighterSummary[] };


function isField(value: unknown): value is Field {
  return typeof value === "object" && value !== null && "options" in value && typeof value.options === "object" && value.options !== null
    && "summaries" in value && Array.isArray(value.summaries)
    && value.summaries.every((s: unknown) => typeof s === "object" && s !== null && "fighter" in s && "winRate" in s && "played" in s && "against" in s && "decisive" in s);
}


function hiddenFighters(field: Field): readonly string[] {
  const { opponents, tiers } = field.options;
  const required = `not a gate run: needs ${BALANCE_GATE.opponent} ${BALANCE_GATE.tier} and at least ${BALANCE_GATE.perPair} matches a pair`;
  if (opponents === undefined || tiers === undefined) throw new Error(required);
  const profiles = [{ opponent: opponents[0], tier: tiers[0] }, { opponent: opponents[1], tier: tiers[1] }];
  const verdict = balanceVerdict(field.summaries, profiles, matchupReport(field.summaries).smallestPlayed);
  if (!verdict.gateRun) throw new Error(required);
  const hidden = verdict.outside.map((entry) => entry.split(" ")[0] ?? entry);
  if (hidden.length === field.summaries.length) throw new Error("every fighter fails the gate; a release needs at least one");
  return hidden;
}

function releaseRosterSource(hidden: readonly string[]): string {
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
