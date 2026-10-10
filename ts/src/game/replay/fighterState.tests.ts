import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { firstFighterDifference, sameReplayState } from "./difference";
import { copyFighterState, sameFighterState } from "./fighterState";
import { createRoster } from "../sim/roster";
import { type FighterTuning } from "../sim/tuning";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { type ReplayState, createReplaySnapshot } from "./snapshot";

interface LeafPair {
  readonly path: string;
  left(): unknown;
  right(): unknown;
  setLeft(value: unknown): void;
  setRight(value: unknown): void;
}

type Field = Record<string, unknown>;






function walk(left: object, right: object, path: string, leaves: LeafPair[], records: [object, object][]): void {
  if (!path.startsWith(".projectiles[")) records.push([left, right]);
  const child = (childPath: string, get: (side: object) => unknown, set: (side: object, value: unknown) => void) => {
    const value = get(left);
    const other = get(right);
    if (typeof value === "object" && value !== null && typeof other === "object" && other !== null) walk(value, other, childPath, leaves, records);
    else leaves.push({ path: childPath, left: () => get(left), right: () => get(right), setLeft: next => set(left, next), setRight: next => set(right, next) });
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

// Every reference a fighter's tuning holds.
const TUNING_FIELDS = ["physics", "surface", "ground", "dashGrab", "shield", "tech", "shieldBreak", "moves", "specials", "ultimate"] as const satisfies readonly (keyof FighterTuning)[];

// Integer codes, counts and frames: Lua integers have no -0, so their comparisons skip the signed-zero test.
const INTEGER_FIELDS = [
  ".character", ".launch.hitlagFrames", ".launch.hitlagEndAge", ".water.hydraStrikeFrame", ".platform.landedFrames", ".status.conditionImmunity[]",
  ".projectiles[].life", ".projectiles[].direction", ".projectiles[].kind", ".projectiles[].visualFamily", ".projectiles[].serial", ".projectiles[].poolHits", ".projectiles[].poolWait",
];
// Dense number lists, read as `?? 0`, which never hold undefined.
const DENSE_FIELDS = [".special.cooldowns[]", ".status.conditionImmunity[]"];
// A path with its indices dropped: `.pack[1].x` is `.pack[].x`.
function field(path: string): string {
  let kind = "";
  let index = false;
  for (let at = 0; at < path.length; at++) {
    const character = path.charAt(at);
    if (character === "]") index = false;
    if (!index) kind += character;
    if (character === "[") index = true;
  }
  return kind;
}

/** A state holding `fighter` in slot 0, as repair compares it. */
function holding(fighter: Fighter): ReplayState {
  const others = [createFighter(Character.rifleman, 0.0, -1), createFighter(Character.rifleman, 0.0, 1), createFighter(Character.rifleman, 0.0, -1)];
  return { ...createReplaySnapshot(), world: createRoster(1, [fighter, ...others]) };
}

test("the comparators repair trusts tell apart every changed fighter field, and a copy satisfies them [invariant]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const key of Object.keys(createFighter(character, 0.0, 1).tuning)) assertTrue((TUNING_FIELDS as readonly string[]).includes(key));
  }
  // A Beastmaster holds a pack, specials and an ultimate.
  const expected = createFighter(Character.beastmaster, 0.0, 1);
  const actual = createFighter(Character.beastmaster, 0.0, 1);
  const copy = createFighter(Character.rifleman, 7.0, -1);
  const expectedState = holding(expected);
  const actualState = holding(actual);
  const { leaves } = fighterLeaves(expected, actual);
  const misses: string[] = [];
  const same = (): boolean => {
    const fighters = sameFighterState(expected, actual);
    if (fighters !== sameReplayState(expectedState, actualState)) misses.push("sameReplayState disagrees with sameFighterState");
    return fighters;
  };
  // `actual` changed: the comparators tell it apart, and a copy of it, over whatever the target held, satisfies them.
  const differs = (path: string) => {
    if (same()) misses.push(path);
    copyFighterState(copy, expected, 1);
    copyFighterState(copy, actual, 1);
    if (!sameFighterState(copy, actual)) misses.push(`${path}: copy`);
  };
  assertTrue(same());
  const tuning = (fighter: Fighter) => fighter.tuning as unknown as Record<string, unknown>;
  for (const field of TUNING_FIELDS) {
    const original = actual.tuning[field];
    tuning(actual)[field] = {};
    differs(`tuning.${field} replaced`);
    tuning(actual)[field] = undefined;
    differs(`tuning.${field} -> undefined`);
    tuning(expected)[field] = undefined;
    if (!same()) misses.push(`tuning.${field} both undefined`);
    tuning(actual)[field] = {};
    differs(`tuning.${field} undefined -> value`);
    tuning(expected)[field] = original;
    tuning(actual)[field] = original;
  }
  for (const leaf of leaves) {
    const original = leaf.right();
    if (typeof original !== "boolean" && typeof original !== "number") continue;
    const kind = field(leaf.path);
    leaf.setRight(typeof original === "boolean" ? !original : original + 1);
    differs(`${leaf.path} changed`);
    if (typeof original === "number") {
      leaf.setRight(original + 0.5);
      differs(`${leaf.path} + 0.5`);
    }
    if (!DENSE_FIELDS.includes(kind)) {
      leaf.setRight(undefined);
      differs(`${leaf.path} -> undefined`);
      leaf.setLeft(undefined);
      if (!same()) misses.push(`${leaf.path} both undefined`);
      leaf.setRight(original);
      differs(`${leaf.path} undefined -> value`);
      leaf.setLeft(original);
    }
    if (typeof original === "number") {
      // A Lua integer and the equal float are one value; signed zeros are two.
      leaf.setRight(original + 0.5 - 0.5);
      if (!same()) misses.push(`${leaf.path} as float`);
      if (!INTEGER_FIELDS.includes(kind)) {
        leaf.setLeft(0.0);
        leaf.setRight(-0.0);
        differs(`${leaf.path} -0`);
        leaf.setLeft(original);
      }
    }
    leaf.setRight(original);
  }
  assertTrue(same());
  assertEquals(misses.join("; "), "");
});
