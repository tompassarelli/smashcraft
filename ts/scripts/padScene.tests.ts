import { expect, test } from "bun:test";
import { Action } from "../src/game/input/actions";
import { canonicalState } from "../src/game/replay/canonical";
import { Character } from "../src/game/sim/codes";
import { Timeline, type Situation } from "./interactions";

test("a contact continuation preserves replay state and controller edges [invariant]", () => {
  const policies: Situation["policies"] = [
    (n) => n <= 2 ? [Action.jump] : [Action.moveRight],
    () => [],
  ];
  const situation: Situation = {
    placements: [
      { character: Character.rifleman, x: 0, facing: 1 },
      { character: Character.rifleman, x: 400, facing: -1 },
    ],
    policies,
  };
  const uninterrupted = new Timeline(situation, 20);
  uninterrupted.play([[], []], 20, undefined, true);
  const expected = uninterrupted.capture();
  uninterrupted.play([[], []], 10, undefined, true);
  const checkpoint = uninterrupted.capture();
  const continuation = new Timeline({
    ...situation, initial: checkpoint.state, previous: checkpoint.previous,
    policies: [(n, self, other) => policies[0](n + 10, self, other), policies[1]],
  }, 10);
  continuation.play([[], []], 10, undefined, true);
  const actual = continuation.capture();
  expect(canonicalState(actual.state)).toBe(canonicalState(expected.state));
  expect(actual.previous).toEqual(expected.previous);
  uninterrupted.release();
  continuation.release();
});

test("retaining only frame 1 plays the same full state as retaining every baseline frame [invariant]", () => {
  const situation: Situation = {
    placements: [
      { character: Character.rifleman, x: 0, facing: 1 },
      { character: Character.rifleman, x: 40, facing: -1 },
    ],
    policies: [() => [], () => []],
    amend: (_n, self, _other, row, side) => {
      if (side === 1 && self.launch.hitlag > 0) { row.sdi = true; row.sdiX = 0; row.sdiZ = 1; }
    },
  };
  const all = new Timeline(situation, 100);
  const first = new Timeline(situation, 100, "first");
  for (const buttons of [[Action.attack], [Action.grab], [Action.jump, Action.smashUp]]) {
    const plans = [[{ option: { name: "choice", kind: "none" as const, input: (n: number) => n === 0 ? buttons : n === 15 ? [Action.moveUp] : [] }, start: 1 }], []] as const;
    all.play(plans, 100, undefined, true);
    first.play(plans, 100, undefined, true);
    expect(canonicalState(first.capture().state)).toBe(canonicalState(all.capture().state));
  }
  all.release();
  first.release();
});
