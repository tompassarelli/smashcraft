import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE_GATE, SPECIAL_MOVE, balanceVerdict, fighterMoveUsage, keyMovesAmongMostUsed, matchupReport } from "./cpuField";

test("a fighter's computer move usage is counted, ranked and repeatable [invariant]", () => {
  const options = { fighters: [Character.demonHunter, Character.rifleman], stages: ["sky-deck"], stocks: 1, minutes: 1 } as const;
  const usage = fighterMoveUsage(Character.rifleman, options);
  expect(usage.length).toBeGreaterThan(3);
  for (let index = 1; index < usage.length; index++) expect(usage[index - 1]?.count ?? 0).toBeGreaterThanOrEqual(usage[index]?.count ?? 0);
  expect(usage.reduce((sum, use) => sum + use.share, 0)).toBeCloseTo(1, 6);
  expect(fighterMoveUsage(Character.rifleman, options)).toEqual(usage);
  const leading = usage[0]?.move ?? -1;
  expect(keyMovesAmongMostUsed(usage, [leading], 1)).toEqual({ ok: true, missing: [] });
  const unused = [AttackStyle.jab, AttackStyle.ledgeAttack, SPECIAL_MOVE.up].find((move) => !usage.some((use) => use.move === move));
  if (unused !== undefined) expect(keyMovesAmongMostUsed(usage, [leading, unused], usage.length).missing).toEqual([unused]);
});

test("the matchup report counts 95% intervals overlapping 45-55% and the median distance from even [spec #105]", () => {
  const row = (fighter: string, against: Record<string, number>, n: number) => ({
    fighter, against, played: Object.fromEntries(Object.keys(against).map((k) => [k, n])), decisive: Object.fromEntries(Object.keys(against).map((k) => [k, n])),
  });
  // At 400 decisive matches the interval is about +-4.9 points at 50%: 41% overlaps 45%, 39% doesn't.
  const report = matchupReport([row("a", { b: 0.5, c: 0.41 }, 400), row("b", { a: 0.5, c: 0.61 }, 400), row("c", { a: 0.59, b: 0.39 }, 400)]);
  expect(report).toMatchObject({ matchups: 3, inside: 1, overlapping: 2, missing: ["b-c 61%"] });
  expect(report.medianDeviation).toBeCloseTo(0.09, 6);
});

test("the balance gate is 40-60% against the field with Wren Expert and 400 a pair, and roster.md's Balance gate states the same numbers [spec #105]", () => {
  // Changing the gate changes this test, the constant and the doc together (Tom, 7 Oct).
  expect(BALANCE_GATE).toEqual({ fieldLow: 0.4, fieldHigh: 0.6, opponent: "wren", tier: "expert", perPair: 400 });
  const doc = readFileSync(join(import.meta.dir, "../../docs/design/roster.md"), "utf8");
  const start = doc.indexOf("## Balance gate\n");
  expect(start).toBeGreaterThanOrEqual(0);
  const section = doc.slice(start, doc.indexOf("\n## ", start + 1));
  for (const text of ["BALANCE_GATE", "40%", "60%", "Wren Expert", "400 matches a pair"]) expect(section).toContain(text);
});

test("the balance verdict passes a gate run with every fighter inside 40-60%, and only a gate run [spec #105]", () => {
  const field = [{ fighter: "a", winRate: 0.4 }, { fighter: "b", winRate: 0.6 }];
  expect(balanceVerdict(field, [{ opponent: "wren", tier: "expert" }], 400)).toEqual({ outside: [], gateRun: true, passes: true });
  expect(balanceVerdict([...field, { fighter: "c", winRate: 0.61 }], [{ opponent: "wren", tier: "expert" }], 400)).toEqual({ outside: ["c 61%"], gateRun: true, passes: false });
  expect(balanceVerdict(field, [{ opponent: "wren", tier: "expert" }], 100).passes).toBe(false);
  expect(balanceVerdict(field, [{ opponent: "wren", tier: "advanced" }], 400).gateRun).toBe(false);
});
