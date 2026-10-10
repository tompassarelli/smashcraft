import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE_GATE, balanceVerdict, playCpuMatch } from "./cpuField";
import { Character } from "../src/game/sim/codes";

const G = BALANCE_GATE;
const pct = (n: number) => `${Math.round(100 * n)}%`;
const title = (word: string) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`;
const gateProfile = [{ opponent: G.opponent, tier: G.tier }] as const;

test("roster.md's Balance gate states BALANCE_GATE's band, opponent and matches a pair [spec #105]", () => {
  const doc = readFileSync(join(import.meta.dir, "../../docs/design/roster.md"), "utf8");
  const start = doc.indexOf("## Balance gate\n");
  expect(start).toBeGreaterThanOrEqual(0);
  const section = doc.slice(start, doc.indexOf("\n## ", start + 1));
  for (const text of ["BALANCE_GATE", pct(G.fieldLow), pct(G.fieldHigh), `${title(G.opponent)} ${title(G.tier)}`, `${G.perPair} matches a pair`]) expect(section).toContain(text);
});

test("the balance verdict passes a gate run with every fighter inside the field band, and only a gate run [spec #105]", () => {
  const field = [{ fighter: "a", winRate: G.fieldLow }, { fighter: "b", winRate: G.fieldHigh }];
  expect(balanceVerdict(field, gateProfile, G.perPair)).toEqual({ outside: [], gateRun: true, passes: true });
  const above = balanceVerdict([...field, { fighter: "c", winRate: G.fieldHigh + 0.01 }], gateProfile, G.perPair);
  expect([above.outside.length, above.gateRun, above.passes]).toEqual([1, true, false]);
  expect(balanceVerdict(field, gateProfile, G.perPair - 1).passes).toBe(false);
  expect(balanceVerdict(field, [{ opponent: G.opponent, tier: "rookie" }], G.perPair).gateRun).toBe(false);
});

test("a camping match plays the same twice from its seed and the fighter ahead on stocks camps [invariant]", () => {
  const options = { camp: true, drops: true, minutes: 4 } as const;
  const first = playCpuMatch(Character.rifleman, Character.blademaster, "wind", 0, options, 3);
  const second = playCpuMatch(Character.rifleman, Character.blademaster, "wind", 0, options, 3);
  expect(first).toBeDefined();
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect((first?.campFrames[0] ?? 0) + (first?.campFrames[1] ?? 0)).toBeGreaterThan(0);
});
