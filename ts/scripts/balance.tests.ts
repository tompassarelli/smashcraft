
import { expect, test } from "bun:test";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { BALANCE_SPEC } from "./balance";

import recordedBaseline from "./balanceBaseline.json";
import { currentRosterKits } from "./balanceKit";
import { kitFailures, type Baseline } from "./balanceOptimizer";

const S = BALANCE_SPEC;

test("[spec #355] all 26 recorded kits stay inside fixed bounds and out-of-bound values fail", () => {
  const fixed: Baseline = recordedBaseline;
  const current = currentRosterKits();
  expect(Object.keys(fixed).sort()).toEqual(SELECTABLE_CHARACTERS.map(fighterSlug).sort());
  for (const [name, kit] of Object.entries(current)) {
    const before = fixed[name]!.values;
    expect(kitFailures(kit.values, before)).toEqual([]);
    const damage = Object.keys(before).find(path => path.endsWith(".damage") && before[path]! > 0)!;
    const frames = Object.keys(before).find(path => path.endsWith(".startupFrames"))!;
    expect(kitFailures({ ...kit.values, [damage]: before[damage]! * (1 + S.kitFraction + 0.01), [frames]: before[frames]! + S.kitFrames + 1 }, before)).toHaveLength(2);

  }
});
