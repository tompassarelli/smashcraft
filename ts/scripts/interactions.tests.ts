import { expect, test } from "bun:test";
import { aerialOnShield, moveProfile, rowChanges } from "./interactions";
import { interactionTimingProblem } from "./interactionTiming";

test("authored reaction options allow the adopted budget after their first visible cue", () => {
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 21, choices: 1 })).toBeDefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 22, choices: 1 })).toBeUndefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 31, choices: 4 })).toBeDefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 32, choices: 4 })).toBeUndefined();
});

test("required links and unaided precision inputs reject one- and two-frame windows", () => {
  for (const kind of ["required-link", "required-precision"] as const) {
    for (const acceptedFrames of [1, 2]) expect(interactionTimingProblem({ kind, acceptedFrames })).toBeDefined();
    expect(interactionTimingProblem({ kind, acceptedFrames: 3 })).toBeUndefined();
    expect(interactionTimingProblem({ kind, acceptedFrames: 12 })).toBeUndefined();
  }
});

// The rows the graph holds for these spacings (tools/move-data/interactions/*.md).
test("Archer's unspaced down air on shield is punishable out of shield", () => {
  const row = aerialOnShield("Archer", "down air", "advancing", 48, "unspaced");
  expect(row).toMatchObject({ press: 10, attackFrame: 7, shieldstun: 7, attackerActs: 20, defenderActs: 13, advantage: -7 });
  expect(row?.punishes).toEqual([{ punisher: "jump neutral air", starts: [13] }, { punisher: "jump back air", starts: [13] }]);
  expect(moveProfile(row === undefined ? [] : [row], "down air"))
    .toEqual(["on shield, unspaced advancing from 48: advantage -7, punished by jump neutral air 13; jump back air 13"]);
});

// One safe and one punishable aerial on shield per fighter (#106): a late, spaced or
// cross-up landing is safe; an early, high hit landing in front is punished out of shield.
test("Archer's spaced fade-back forward air on shield is safe", () => {
  const row = aerialOnShield("Archer", "forward air", "fade-back", 264, "spaced");
  expect(row).toMatchObject({ press: 16, attackFrame: 6, shieldstun: 6, attackerActs: 12, defenderActs: 11, advantage: -1 });
  expect(row?.punishes).toEqual([]);
  // 264 is the farthest swept start that reaches the shield, which makes it the spaced row.
  expect(aerialOnShield("Archer", "forward air", "fade-back", 270, "spaced")).toBeUndefined();
});

test("Archer's early neutral air landing in front of a shield is shield-grabbed", () => {
  const row = aerialOnShield("Archer", "neutral air", "early advancing", 48, "unspaced");
  expect(row).toMatchObject({ attackFrame: 3, shieldstun: 6, attackerActs: 24, defenderActs: 11, advantage: -13 });
  expect(row?.punishes[0]).toEqual({ punisher: "shield grab", starts: [11, 12, 13, 14, 15, 16, 17, 18] });
});

test("Rifleman's late neutral air on shield is safe", () => {
  const row = aerialOnShield("Rifleman", "neutral air", "advancing", 48, "unspaced");
  expect(row).toMatchObject({ attackFrame: 3, shieldstun: 6, attackerActs: 10, defenderActs: 11, advantage: 1 });
  expect(row?.punishes).toEqual([]);
});

test("Rifleman's early neutral air landing in front of a shield is shield-grabbed", () => {
  const row = aerialOnShield("Rifleman", "neutral air", "early advancing", 48, "unspaced");
  expect(row).toMatchObject({ attackFrame: 3, shieldstun: 6, attackerActs: 28, defenderActs: 11, advantage: -17 });
  expect(row?.punishes[0]?.punisher).toBe("shield grab");
  expect(row?.punishes[0]?.starts[0]).toBe(11);
});

test("Illidan's back air crossing up a shield is safe", () => {
  const row = aerialOnShield("Illidan", "back air", "advancing", 48, "unspaced");
  // The attacker meets the shield from behind it: the defender's x is less than its own.
  expect(row?.separation).toBeLessThan(0);
  expect(row).toMatchObject({ attackFrame: 3, shieldstun: 5, attackerActs: 13, defenderActs: 10, advantage: -3 });
  expect(row?.punishes).toEqual([]);
});

test("Illidan's early back air landing in front of a shield is shield-grabbed", () => {
  const row = aerialOnShield("Illidan", "back air", "early advancing", 48, "unspaced");
  expect(row?.separation).toBeGreaterThan(0);
  expect(row).toMatchObject({ attackFrame: 3, shieldstun: 5, attackerActs: 30, defenderActs: 10, advantage: -20 });
  expect(row?.punishes[0]?.punisher).toBe("shield grab");
  expect(row?.punishes[0]?.starts[0]).toBe(10);
});

test("a changed number shows as a changed row against the written graph", () => {
  const row = aerialOnShield("Archer", "up air", "advancing", 48, "unspaced");
  if (row === undefined) throw new Error("Archer's up air no longer meets the shield from 48");
  const written: Record<string, unknown>[] = [{ ...row }];
  expect(rowChanges(written, [row])).toEqual([]);
  expect(rowChanges(written, [{ ...row, advantage: -5 }])).toEqual(["changed aerial-on-shield | Archer | up air | unspaced | advancing: advantage -3 -> -5"]);
});
