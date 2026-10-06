import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { SPECIAL_MOVE, fighterMoveUsage, keyMovesAmongMostUsed, matchupGate } from "./cpuField";

test("a fighter's computer move usage is counted, ranked and repeatable", () => {
  const options = { fighters: [Character.archer, Character.rifleman], stages: ["sky-deck"], stocks: 1, minutes: 1 } as const;
  const usage = fighterMoveUsage(Character.archer, options);
  expect(usage.length).toBeGreaterThan(3);
  for (let index = 1; index < usage.length; index++) expect(usage[index - 1]?.count ?? 0).toBeGreaterThanOrEqual(usage[index]?.count ?? 0);
  expect(usage.reduce((sum, use) => sum + use.share, 0)).toBeCloseTo(1, 6);
  expect(fighterMoveUsage(Character.archer, options)).toEqual(usage);
  const leading = usage[0]?.move ?? -1;
  expect(keyMovesAmongMostUsed(usage, [leading], 1)).toEqual({ ok: true, missing: [] });
  const unused = [AttackStyle.jab, AttackStyle.ledgeAttack, SPECIAL_MOVE.up].find((move) => !usage.some((use) => use.move === move));
  if (unused !== undefined) expect(keyMovesAmongMostUsed(usage, [leading, unused], usage.length).missing).toEqual([unused]);
});

test("the matchup gate counts 95% intervals overlapping 45-55% and the median distance from even", () => {
  const row = (fighter: string, against: Record<string, number>, n: number) => ({
    fighter, against, played: Object.fromEntries(Object.keys(against).map((k) => [k, n])), decisive: Object.fromEntries(Object.keys(against).map((k) => [k, n])),
  });
  // At 400 decisive matches the interval is about +-4.9 points at 50%: 41% overlaps 45%, 39% doesn't.
  const gate = matchupGate([row("a", { b: 0.5, c: 0.41 }, 400), row("b", { a: 0.5, c: 0.61 }, 400), row("c", { a: 0.59, b: 0.39 }, 400)]);
  expect(gate).toMatchObject({ matchups: 3, inside: 1, overlapping: 2, missing: ["b-c 61%"], passes: false });
  expect(gate.medianDeviation).toBeCloseTo(0.09, 6);
  expect(matchupGate([row("a", { b: 0.52 }, 400), row("b", { a: 0.48 }, 400)]).passes).toBe(true);
});
