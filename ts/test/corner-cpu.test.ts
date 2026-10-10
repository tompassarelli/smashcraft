// Computer corner play (#386, box 3), measured over 200 seeded corner
// situations each (smashcraft:ts/src/game/match/cornerScenarios.ts): one Wren
// computer starts cornered 40 units inside a lip, the other 300 units inside,
// both at the same tier, for 240 frames. Bun-only: the measurements are too
// heavy for the Lua32 instruction ceiling. SWEEP_SEED_OFFSET shifts the seeds.
import { expect } from "bun:test";
import { tallyCorners } from "../src/game/match/cornerScenarios";
import { sweep } from "./sweep";

const FIRST = 1 + Number(process.env.SWEEP_SEED_OFFSET ?? 0);
const SITUATIONS = 200;

// Offsets 0, 1000, 3000, 5000, 7000, 9000, 11000: median 45-50 frames in the band;
// origin/main before #386 measures 84-102 on the same seeds. Edge cancels of
// near-ledge landings: 0-4 per 200 situations (9 of 150 pooled, 6%), below the
// box's 10% goal because a carry is taken only against a shield (#56).
sweep("a cornered Expert computer leaves the corner band within 70 frames at the median [k3 measure #386]", () => {
  const expert = tallyCorners(FIRST, SITUATIONS, "wren", "expert");
  expect(expert.medianCornered).toBeLessThan(70);
});

// Rookie plays the corner as before #386, seed for seed: 0 of 21 near-ledge
// landings cancelled at offset 0, 0-2 accidental slides per 200 on the other
// offsets (the counts origin/main measures), corner median 94-100 frames.
sweep("a Rookie computer keeps its corner play: rare accidental edge cancels and a long corner stay [k3 measure #386]", () => {
  const rookie = tallyCorners(FIRST, SITUATIONS, "wren", "rookie");
  expect(rookie.cancelled * 10).toBeLessThan(rookie.eligible);
  expect(rookie.medianCornered).toBeGreaterThan(80);
});
