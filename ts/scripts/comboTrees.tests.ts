import { expect, test } from "bun:test";
import { comboExtension } from "./comboTrees";

test("a read has an escaping choice, a guaranteed extension beats every choice before it acts, and free actions without an observed escape are neither [spec docs/design/interaction-graph.md]", () => {
  expect(comboExtension([{ trueLink: true }, { trueLink: true }])).toBe("guaranteed");
  expect(comboExtension([{ trueLink: true }, undefined])).toBe("read");
  expect(comboExtension([{ trueLink: false }, undefined])).toBe("read");
  expect(comboExtension([undefined, undefined])).toBe("miss");
  expect(comboExtension([{ trueLink: true }, { trueLink: false }])).toBe("unclassified");
  expect(comboExtension([{ trueLink: false }, { trueLink: false }])).toBe("unclassified");
});
