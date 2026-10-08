import { expect, test } from "bun:test";
import { comboExtension } from "./comboTrees";

test("a read has an escaping choice, while a guaranteed extension beats every choice before it acts [spec docs/design/interaction-graph.md]", () => {
  expect(comboExtension([{ trueLink: true }, { trueLink: true }])).toBe("guaranteed");
  expect(comboExtension([{ trueLink: true }, undefined])).toBe("read");
  expect(comboExtension([{ trueLink: false }, undefined])).toBe("read");
  expect(comboExtension([undefined, undefined])).toBe("miss");
});

test("free actions followed by a hit are neither a guaranteed extension nor a read without an observed escape [spec docs/design/interaction-graph.md]", () => {
  expect(comboExtension([{ trueLink: true }, { trueLink: false }])).toBe("unclassified");
  expect(comboExtension([{ trueLink: false }, { trueLink: false }])).toBe("unclassified");
});
