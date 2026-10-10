import { expect, test } from "bun:test";
import { playCpuMatch } from "./cpuField";
import { Character } from "../src/game/sim/codes";

test("a camping match plays the same twice from its seed and the fighter ahead on stocks camps [k1 scenario]", () => {
  const options = { camp: true, drops: true, minutes: 4 } as const;
  const first = playCpuMatch(Character.rifleman, Character.blademaster, "wind", 0, options, 3);
  const second = playCpuMatch(Character.rifleman, Character.blademaster, "wind", 0, options, 3);
  expect(first).toBeDefined();
  expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  expect((first?.campFrames[0] ?? 0) + (first?.campFrames[1] ?? 0)).toBeGreaterThan(0);
});
