import { assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { firstFighterDifference } from "./difference";
import { copyFighterState } from "./fighterState";

interface LeafPair {
  readonly path: string;
  left(): unknown;
  right(): unknown;
  setRight(value: unknown): void;
}

type Field = Record<string, unknown>;

/**
 * Every mutable leaf of two fighters of the same shape, in parallel, with
 * every pair of records that hold them. Tuning records are immutable values
 * and stay out. In Lua an absent field has no key, so only Bun visits those.
 */
function walk(left: object, right: object, path: string, leaves: LeafPair[], records: [object, object][]): void {
  records.push([left, right]);
  const child = (childPath: string, get: (side: object) => unknown, set: (side: object, value: unknown) => void) => {
    const value = get(left);
    const other = get(right);
    if (typeof value === "object" && value !== null && typeof other === "object" && other !== null) walk(value, other, childPath, leaves, records);
    else leaves.push({ path: childPath, left: () => get(left), right: () => get(right), setRight: next => set(right, next) });
  };
  if (Array.isArray(left)) {
    // A callback parameter, not a loop variable: Lua closures share one loop variable.
    const elements: unknown[] = left;
    elements.forEach((_, index) => {
      child(`${path}[${index}]`, side => (side as unknown[])[index], (side, value) => { (side as unknown[])[index] = value; });
    });
    return;
  }
  for (const key of Object.keys(left)) {
    if (path === "" && key === "tuning") continue;
    child(`${path}.${key}`, side => (side as Field)[key], (side, value) => { (side as Field)[key] = value; });
  }
}

function fighterLeaves(left: Fighter, right: Fighter): { leaves: LeafPair[]; records: [object, object][] } {
  const leaves: LeafPair[] = [];
  const records: [object, object][] = [];
  walk(left, right, "", leaves, records);
  return { leaves, records };
}

/** A value of the leaf's kind that differs from it; absent references become slot 1. */
function changed(value: unknown, seed: number): unknown {
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + seed;
  return 1;
}

test("fighter replay copies carry every mutable field into detached records", () => {
  const source = createFighter(Character.archer, -12.0, 1);
  const target = createFighter(Character.rifleman, 4.0, -1);
  const { leaves } = fighterLeaves(target, source);
  leaves.forEach((leaf, index) => leaf.setRight(changed(leaf.right(), index + 1)));
  source.tuning.physics = createFighter(Character.demonHunter, 0.0, 1).tuning.physics;
  copyFighterState(target, source, 15);
  const copied = fighterLeaves(target, source);
  for (const leaf of copied.leaves) assertEquals(leaf.left(), leaf.right(), leaf.path);
  for (const [copy, original] of copied.records) assertFalse(copy === original);
  assertTrue(target.tuning.physics === source.tuning.physics);
  assertFalse(target.tuning === source.tuning);
});

test("fighter replay copies drop references to fighters the source roster doesn't seat", () => {
  const source = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.archer, 0.0, 1);
  source.grab.owner = 1;
  source.grab.target = 2;
  source.hits.lastAttacker = 3;
  source.special.hitTargets[0] = 2;
  copyFighterState(target, source, 3);
  assertEquals(target.grab.owner, 1);
  assertEquals(target.grab.target, undefined);
  assertEquals(target.hits.lastAttacker, undefined);
  assertEquals(target.special.hitTargets[0], undefined);
});

test("every mutable fighter field participates in replay equality", () => {
  const expected = createFighter(Character.archer, 0.0, 1);
  const actual = createFighter(Character.archer, 0.0, 1);
  const { leaves } = fighterLeaves(expected, actual);
  assertEquals(firstFighterDifference(expected, actual, 15, 15), undefined);
  for (const leaf of leaves) {
    const original = leaf.right();
    leaf.setRight(changed(original, 1));
    assertEquals(firstFighterDifference(expected, actual, 15, 15) !== undefined, true, leaf.path);
    leaf.setRight(original);
  }
  assertEquals(firstFighterDifference(expected, actual, 15, 15), undefined);
});
