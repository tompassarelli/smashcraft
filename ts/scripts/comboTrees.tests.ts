import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { fighterAt } from "../src/game/sim/roster";
import { comboExtension, moveOption } from "./comboTrees";
import { Timeline } from "./interactions";

test("a read has an escaping choice, while a guaranteed extension beats every choice before it acts", () => {
  expect(comboExtension([{ trueLink: true }, { trueLink: true }])).toBe("guaranteed");
  expect(comboExtension([{ trueLink: true }, undefined])).toBe("read");
  expect(comboExtension([{ trueLink: false }, undefined])).toBe("read");
  expect(comboExtension([undefined, undefined])).toBe("miss");
});

test("free actions followed by a hit are neither a guaranteed extension nor a read without an observed escape", () => {
  expect(comboExtension([{ trueLink: true }, { trueLink: false }])).toBe("unclassified");
  expect(comboExtension([{ trueLink: false }, { trueLink: false }])).toBe("unclassified");
});

test("Illidan's combo dash script lands his authored dash attack at every report percent", () => {
  for (const percent of [0, 30, 60, 90, 120]) {
    const line = new Timeline({
      placements: [
        { character: Character.demonHunter, x: 0, facing: 1 },
        { character: Character.demonHunter, x: 40, facing: -1 },
      ],
      prepare: (_a, b) => { b.status.damage = percent; },
      policies: [() => [], () => []],
    }, 120, "first");
    line.play([[{ option: moveOption({ name: "dash attack", dash: true }, true), start: 1 }], []], 120, (_n, _a, b) => b.visuals.hit > 0, true);
    const { state } = line.capture();
    expect(fighterAt(state.world, 0).attack.style).toBe(AttackStyle.demonHunterDashAttack);
    expect(fighterAt(state.world, 1).status.damage).toBeGreaterThan(percent);
    line.release();
  }
});
