import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
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






function walk(left: object, right: object, path: string, leaves: LeafPair[], records: [object, object][]): void {
  if (!path.startsWith(".projectiles[")) records.push([left, right]);
  const child = (childPath: string, get: (side: object) => unknown, set: (side: object, value: unknown) => void) => {
    const value = get(left);
    const other = get(right);
    if (typeof value === "object" && value !== null && typeof other === "object" && other !== null) walk(value, other, childPath, leaves, records);
    else leaves.push({ path: childPath, left: () => get(left), right: () => get(right), setRight: next => set(right, next) });
  };
  if (Array.isArray(left)) {
    // Lua closures share a loop variable; capture through a callback parameter.
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


function changed(value: unknown, seed: number): unknown {
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + seed;
  return 1;
}

test("fighter replay copies preserve every field, absent hit targets included, and detach mutable records [invariant]", () => {
  const source = createFighter(Character.rifleman, -12.0, 1);
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
  // Absent special hit targets: the walk sees them only in Bun, since in Lua a table of nils has no keys (#59).
  const hitting = createFighter(Character.rifleman, 0.0, 1);
  const fresh = createFighter(Character.rifleman, 0.0, 1);
  hitting.special.hitTargets[0] = 2;
  hitting.special.hitTargets[2] = 3;
  copyFighterState(fresh, hitting, 15);
  assertEquals([0, 1, 2, 3].map(i => fresh.special.hitTargets[i] ?? -1).join(","), "2,-1,3,-1");
  hitting.special.hitTargets[0] = undefined;
  hitting.special.hitTargets[2] = undefined;
  copyFighterState(fresh, hitting, 15);
  assertEquals([0, 1, 2, 3].map(i => fresh.special.hitTargets[i] ?? -1).join(","), "-1,-1,-1,-1");
});

test("every mutable fighter field participates in replay equality [invariant]", () => {
  const expected = createFighter(Character.rifleman, 0.0, 1);
  const actual = createFighter(Character.rifleman, 0.0, 1);
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
