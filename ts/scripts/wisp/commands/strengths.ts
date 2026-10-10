import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../../src/game/sim/heroes/registry";
import { currentKit } from "../../balanceKit";
import { currentFeel } from "../../balanceFeel";
import { type Direction, type Intent, type ProfileMatch, contradictions, profiles } from "../../strengthProfile";

const STRENGTHS_FILE = join(import.meta.dir, "../../../../tools/move-data/fighter-strengths.json");

class StrengthsFailure extends Schema.TaggedError<StrengthsFailure>()("StrengthsFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const SPECIAL_SLOTS: Readonly<Record<number, string>> = { 30: "neutral", 31: "side", 32: "up", 33: "down" };
const THROWS = [3, 4, 5, 6] as const;

const directionOf = (x: number, z: number): Direction => z < -0.3 ? "bottom" : Math.atan2(z, Math.abs(x)) > (55 * Math.PI) / 180 ? "top" : "side";

function moveDirections(): (fighter: string, move: number) => Direction | undefined {
  const table = new Map<string, Direction>();
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = fighterSlug(character);
    const values = currentKit(character).values;
    const feel = currentFeel(character);
    const launch = (prefix: string): Direction | undefined => {
      const xKey = Object.keys(values).find((key) => key.startsWith(prefix) && key.endsWith(".launchX"));
      if (xKey === undefined) return undefined;
      const x = values[xKey], z = values[`${xKey.slice(0, -"launchX".length)}launchZ`];
      return x === undefined || z === undefined ? undefined : directionOf(x, z);
    };
    for (let style = 0; style < 30; style++) {
      const direction = launch(`normal.${style}.hit.`);
      if (direction !== undefined) table.set(`${fighter}|${style}`, direction);
    }
    const killThrow = THROWS.map((action) => ({ action, kill: feel[`throw.${action}`]?.killPercent ?? Number.POSITIVE_INFINITY })).sort((a, b) => a.kill - b.kill)[0];
    const throwDirection = killThrow === undefined ? undefined : launch(`throw.${killThrow.action}.effect.`);
    if (throwDirection !== undefined) table.set(`${fighter}|5`, throwDirection);
    for (const [move, slot] of Object.entries(SPECIAL_SLOTS)) {
      const direction = launch(`authored.specials.${slot}.`);
      if (direction !== undefined) table.set(`${fighter}|${move}`, direction);
    }
  }
  return (fighter, move) => table.get(`${fighter}|${move}`);
}

const pct = (value: number) => `${Math.round(100 * value)}%`;

export const strengths: Command = (args) => Effect.gen(function*() {
  const [fieldFile, ...rest] = args;
  if (fieldFile === undefined || rest.length > 0) return yield* new UsageFailure({ problem: "strengths needs one FIELD.json" });
  const { field, intents } = yield* Effect.try({
    try: () => ({
      field: JSON.parse(readFileSync(fieldFile, "utf8")) as { readonly records: readonly ProfileMatch[] },
      intents: (JSON.parse(readFileSync(STRENGTHS_FILE, "utf8")) as { readonly fighters: readonly (Intent & { readonly drafted: boolean })[] }).fighters,
    }),
    catch: (cause) => new StrengthsFailure({ problem: describeCause(cause) }),
  });
  const measured = profiles(field.records, moveDirections());
  const measuredDirections = measured.some((profile) => profile.koShareMeasured);
  yield* Console.log(`Fighter strength profiles over ${field.records.length} matches. KO direction ${measuredDirections ? "recorded at the blast zone" : "estimated from each killing move's launch angle (this field predates recorded blast sides)"}; off stage = stocks lost to an edge-guard kill or a self-destruct.`);
  yield* Console.log("| Fighter | Intent (kill/edge-guard/recovery/range) | KOs top/side/bottom | Avg KO % | Off-stage deaths a stock | Edge-guard kills a match (conversion) | Spacing |");
  yield* Console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const profile of measured) {
    const intent = intents.find((candidate) => candidate.fighter === profile.fighter);
    const spacing = profile.medianHitDistance === undefined ? `${pct(profile.rangedShare)} ranged` : `median ${profile.medianHitDistance.toFixed(0)} Mu, ${pct(profile.rangedShare)} ranged`;
    yield* Console.log(`| ${profile.fighter} | ${intent === undefined ? "none" : `${intent.kill}/${intent.edgeGuard}/${intent.recovery}/${intent.range}${intent.drafted ? " (drafted)" : ""}`} | ${pct(profile.koShare.top)}/${pct(profile.koShare.side)}/${pct(profile.koShare.bottom)} | ${profile.averageKoPercent === undefined ? "not recorded" : profile.averageKoPercent.toFixed(0)} | ${pct(profile.offstageDeathsPerStock)} | ${profile.edgeGuardKillsPerMatch.toFixed(2)} (${pct(profile.edgeGuardConversion)}) | ${spacing} |`);
  }
  const found = contradictions(measured, intents);
  yield* Console.log("", `Identity contradictions (intent's expected roster third missed by a full third): ${found.length}`);
  for (const item of found) yield* Console.log(`- ${item.fighter}: ${item.trait} intended ${item.intent}, measured ${item.measured}`);
});
