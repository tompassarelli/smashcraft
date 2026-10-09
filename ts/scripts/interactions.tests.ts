import { expect, test } from "bun:test";
import { aerialOnShield } from "./interactions";
import { interactionTimingProblem } from "./interactionTiming";

test("authored reaction options allow the adopted budget after their first visible cue [spec docs/design/execution-windows.md]", () => {
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 21, choices: 1 })).toBeDefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 22, choices: 1 })).toBeUndefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 31, choices: 4 })).toBeDefined();
  expect(interactionTimingProblem({ kind: "reaction", cueFrame: 7, lastResponseFrame: 32, choices: 4 })).toBeUndefined();
});

test("required links and unaided precision inputs reject one- and two-frame windows [spec docs/design/execution-windows.md]", () => {
  for (const kind of ["required-link", "required-precision"] as const) {
    for (const acceptedFrames of [1, 2]) expect(interactionTimingProblem({ kind, acceptedFrames })).toBeDefined();
    expect(interactionTimingProblem({ kind, acceptedFrames: 3 })).toBeUndefined();
    expect(interactionTimingProblem({ kind, acceptedFrames: 12 })).toBeUndefined();
  }
});

// One safe and one punishable aerial on shield per fighter (#106): a late, spaced or
// cross-up landing is safe; an early, high hit landing in front is punished out of shield.
test("Rifleman's early aerials landing in front of a shield are punished, and his late or spaced fade-back ones are safe [spec #106]", () => {
  expect(aerialOnShield("Rifleman", "down air", "early advancing", 48, "unspaced")?.punishes.length).toBeGreaterThan(0);
  expect(aerialOnShield("Rifleman", "neutral air", "early advancing", 48, "unspaced")?.punishes[0]?.punisher).toBe("shield grab");
  expect(aerialOnShield("Rifleman", "forward air", "fade-back", 264, "spaced")?.punishes).toEqual([]);
  expect(aerialOnShield("Rifleman", "neutral air", "advancing", 48, "unspaced")?.punishes).toEqual([]);
});

test("Illidan's back air crossing up a shield is safe, and landing early in front of it is shield-grabbed [spec #106]", () => {
  const cross = aerialOnShield("Illidan", "back air", "advancing", 48, "unspaced");
  // The attacker meets the shield from behind it: the defender's x is less than its own.
  expect(cross?.separation).toBeLessThan(0);
  expect(cross?.punishes).toEqual([]);
  const early = aerialOnShield("Illidan", "back air", "early advancing", 48, "unspaced");
  expect(early?.separation).toBeGreaterThan(0);
  expect(early?.punishes[0]?.punisher).toBe("shield grab");
});
