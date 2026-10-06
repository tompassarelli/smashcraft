import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { SPECIAL_MOVE, fighterMoveUsage, keyMovesAmongMostUsed } from "./cpuField";

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
