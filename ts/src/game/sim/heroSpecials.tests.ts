import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { Character, SpecialAction } from "./codes";
import { beginDamageContacts, finishDamageContacts } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import { heroRegion } from "./heroMoves";
import { advanceHeroStatus } from "./heroSpecialRules";
import { ROSTER_MANA } from "./mana";
import { type AuthoredSpecial, type FighterSpecials, frames } from "./heroSpecials";
import { updateProjectiles } from "./projectiles";
import { type Controls, type Roster, createRoster } from "./roster";
import { advanceSpecials, startFighterSpecial } from "./specials";
import { advanceFighter } from "./step";
import { controls } from "./testWorld";
import { copyFighterState } from "../replay/fighterState";
import { firstFighterDifference } from "../replay/difference";

const hit = (damage: number) => ({ damage, growth: 80.0, base: 20.0, launchX: f32(0.8), launchZ: f32(0.6), electric: false });

const NEUTRAL: AuthoredSpecial = {
  endFrame: 20,
  projectiles: [{ spawnFrame: 5, offsetX: 40.0, offsetZ: 60.0, velocityX: 12.0, velocityZ: 0.0, life: 40, radius: 15.0, effect: hit(6.0), reflectable: true, limit: 1 }],
};
const SIDE: AuthoredSpecial = {
  endFrame: 30,
  regions: [heroRegion(10, 12, { x1: 10.0, z1: 50.0, x2: 90.0, z2: 50.0, radius: 12.0 }, hit(10.0))],
};
const UP: AuthoredSpecial = { endFrame: 25, helpless: true, oncePerAirtime: true, motion: [{ ...frames(5, 20), velocityX: 0.0, velocityZ: 12.0 }] };
const DOWN: AuthoredSpecial = { endFrame: 30, groundOnly: true, intangible: frames(5, 8), armor: { ...frames(10, 20), maxDamage: 6.0 } };

const KIT: FighterSpecials = {
  neutral: { name: "Test Bolt", description: "", ground: NEUTRAL },
  side: { name: "Test Dash", description: "", ground: SIDE },
  up: { name: "Test Rise", description: "", ground: UP },
  down: { name: "Test Guard", description: "", ground: DOWN },
};

function hero(x: number, facing: number): Fighter {
  const f = createFighter(Character.blademaster, x, facing);
  f.tuning = { ...f.tuning, specials: KIT };
  f.mana.points = ROSTER_MANA.max;
  return f;
}

function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world, 0, 0);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap = 300.0): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = hero(-gap * 0.5, 1);
  const target = createFighter(Character.rifleman, gap * 0.5, -1);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const neutral = controls({ specialPressed: true });

test("a regular hero special spends no meter and the fighter acts again the frame after its end [spec #335]", () => {
  const { world, owner } = pair(600.0);
  frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, 100);
  for (let f = 2; f <= 29; f++) frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, 100);
  frame(world);
  assertEquals(owner.special.action, SpecialAction.none);
  frame(world, neutral);
  assertEquals(owner.special.action, SpecialAction.heroNeutral);
});

test("replaying a hero special from a restored snapshot reproduces every fighter field [invariant]", () => {
  const { world, owner, target } = pair(200.0);
  const savedOwner = createFighter(Character.blademaster, 0.0, 1);
  const savedTarget = createFighter(Character.rifleman, 0.0, 1);
  frame(world, neutral);
  frame(world);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    frame(world, side);
    for (let f = 0; f < 50; f++) frame(world, f === 30 ? up : controls());
  };
  run();
  const endOwner = createFighter(Character.blademaster, 0.0, 1);
  const endTarget = createFighter(Character.rifleman, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

