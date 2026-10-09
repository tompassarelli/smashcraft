import { mutableProjectile } from "../fighterProjectiles";



import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, HeroStatusKind, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { maskHeroStatusControls } from "../heroStatus";
import { attackStartupFrames, grabContactFrame } from "../moves";
import { heroProjectileRadius, updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { attackBuffer } from "../../input/attackBuffer";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { LICH_KING_MOVES } from "./lichKingMoves";

const H = HERO_REFERENCE_HEIGHT;
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });
const buffers = [attackBuffer(0), attackBuffer(0)];

function lichKing(x: number, facing: number): Fighter {
  const f = createFighter(Character.lichKing, x, facing);
  f.mana.points = 100;
  return f;
}


function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [{ ...first }, { ...second }];
  for (let slot = 0; slot < 2; slot++) maskHeroStatusControls(world.fighters[slot]!, inputs[slot]!, buffers[slot]!);
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot]!, slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot]!);
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, facing = 1, opponent: Character = Character.rifleman): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = lichKing(f32(-gap * 0.5 * facing), facing);
  const target = createFighter(opponent, f32(gap * 0.5 * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

function actionLength(world: Roster, owner: Fighter, press: Readonly<Controls>): number {
  frame(world, press);
  let length = 1;
  while (owner.special.action !== SpecialAction.none && length < 200) {
    frame(world);
    length++;
  }
  return length;
}

const liveHero = (f: Readonly<Fighter>) => f.projectiles.find(p => p.life > 0 && p.kind === ProjectileKind.hero);

test("the Lich King's specials preserve their super meter and end on their authored frames [spec #335]", () => {
  for (const [press, end] of [[neutral, 44], [side, 40], [down, 50]] as const) {
    const { world, owner } = pair(1000.0);
    const length = actionLength(world, owner, press);
    if (press === down) assertEquals(length, end);
    assertEquals(owner.mana.points, 100);
  }
  const { world, owner } = pair(1000.0);
  frame(world, up);
  assertEquals(owner.special.action, SpecialAction.heroUp);
  assertEquals(owner.mana.points, 100);
});

test("Val'kyr Shadowguard carries its catch toward the edge it flew at for 80 frames, rising, with no control [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = pair(f32(H * f32(1.2)), facing);
    frame(world, controls({ specialPressed: true, specialX: facing }));
    for (let f = 0; f < 60 && target.status.condition !== HeroStatusKind.carried; f++) frame(world);
    assertEquals(target.status.condition, HeroStatusKind.carried);
    const startX = target.motion.x;
    const startZ = target.motion.z;

    for (let f = 0; f < 40; f++) frame(world, controls(), controls({ jumpPressed: f === 5 }));

    assertNear(f32(f32(target.motion.x - startX) * facing), 112.0, 9.0);
    assertGreaterThan(target.motion.z, startZ);
    let carried = 40;
    while (target.status.condition === HeroStatusKind.carried && carried < 200) {
      frame(world);
      carried++;
    }
    assertNear(carried, 80, 3);
  }
});

test("a carried fighter mashes free, never before frame 20, and any hit drops the carry [spec #335]", () => {
  const mashLength = (mash: boolean): number => {
    const { world, target } = pair(f32(H * f32(1.2)));
    frame(world, side);
    for (let f = 0; f < 60 && target.status.condition !== HeroStatusKind.carried; f++) frame(world);
    let length = 0;
    while (target.status.condition === HeroStatusKind.carried && length < 200) {
      frame(world, controls(), controls({ grabMashPressed: mash && floorMod(length, 2) === 0, direction: mash ? (floorMod(length, 4) < 2 ? 1 : -1) : 0 }));
      length++;
    }
    return length;
  };
  const free = mashLength(true);
  assertLessThan(free, mashLength(false) - 30);
  assertGreaterThan(free, 18);

  const { world, owner, target } = pair(f32(H * f32(1.2)));
  frame(world, side);
  for (let f = 0; f < 60 && target.status.condition !== HeroStatusKind.carried; f++) frame(world);
  while (owner.special.action !== SpecialAction.none) frame(world);
  owner.motion.x = f32(target.motion.x - 40.0);
  owner.facing = 1;
  frame(world);
  beginFighterAttack(world, 0, AttackStyle.forwardTilt, false);
  for (let f = 0; f < 30 && target.status.condition === HeroStatusKind.carried; f++) frame(world);
  assertTrue(target.status.condition !== HeroStatusKind.carried);
});

test("a shielded Val'kyr catches nothing [spec docs/design/roster.md]", () => {
  const { world, target } = pair(f32(H * f32(1.2)));
  frame(world, side, controls({ shield: true }));
  for (let f = 0; f < 50; f++) frame(world, controls(), controls({ shield: true }));
  assertTrue(target.status.condition !== HeroStatusKind.carried);
  assertEquals(target.status.damage, 0.0);
});

test("Defile offers a jump escape and at least 120 empty frames before another pool; refused casts spend nothing [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = pair(f32(H * f32(0.6)), facing);
    frame(world, down);
    for (let f = 2; f <= 25; f++) frame(world);
    frame(world, controls(), controls({ jumpPressed: true, jumpHeld: true, direction: facing }));
    for (let f = 27; f <= 60; f++) frame(world, controls(), controls({ jumpHeld: true, direction: facing }));
    assertEquals(target.status.damage, 0.0);
    assertTrue(!target.motion.grounded);
    for (let f = 61; f <= 200; f++) frame(world);
    assertEquals(liveHero(owner), undefined);
    const mana = owner.mana.points;
    frame(world, down);
    assertEquals(owner.special.action, SpecialAction.none);
    assertEquals(owner.mana.points, mana);
    for (let f = 202; f <= 320; f++) frame(world);
    frame(world, down);
    assertEquals(owner.special.action, SpecialAction.heroDown);
  }
});

test("Defile stays through five 2-damage pulses spaced 36 frames; body hits grow the pool but shields do not [spec docs/design/roster.md] [invariant]", () => {
  const { world, owner, target } = pair(f32(H * f32(0.6)));
  frame(world, down);
  for (let f = 2; f <= 30 && liveHero(owner) === undefined; f++) frame(world);
  const pool = liveHero(owner);
  assertTrue(pool !== undefined);
  if (pool === undefined || pool.spec === undefined) return;
  const strikes: number[] = [];
  let last = 0.0;
  let widest = heroProjectileRadius(pool, pool.spec);
  for (let f = 0; f < 300 && pool.life > 0; f++) {

    target.motion.x = pool.x;
    target.motion.vx = 0.0;
    target.motion.z = 0.0;
    target.motion.grounded = true;
    target.launch.hitlag = 0;
    target.launch.hitstun = 0;
    beginDamageContacts();
    updateProjectiles(world);
    finishDamageContacts(world);
    if (target.status.damage !== last) {
      strikes.push(f);
      last = target.status.damage;
      widest = Math.max(widest, heroProjectileRadius(pool, pool.spec));
    }
  }
  assertEquals(strikes.length, 5);
  assertEquals(target.status.damage, 10.0);
  for (let i = 1; i < strikes.length; i++) assertEquals(strikes[i]! - strikes[i - 1]!, 36);
  assertNear(widest, f32(f32(H * f32(0.3)) + 30.0), f32(0.01));
  const writablePool = mutableProjectile(owner, owner.projectiles.indexOf(pool));
  writablePool.life = 10;
  writablePool.poolHits = 100;
  assertNear(heroProjectileRadius(pool, pool.spec), f32(H * f32(0.6)), f32(0.01));

  const copy = lichKing(0.0, 1);
  copyFighterState(copy, owner, 3);
  assertEquals(firstFighterDifference(owner, copy, 3, 3), undefined);
  const shielded = pair(f32(H * f32(0.6)));
  frame(shielded.world, down, controls({ shield: true }));
  for (let f = 2; f <= 150; f++) frame(shielded.world, controls(), controls({ shield: true }));
  assertEquals(shielded.target.status.damage, 0.0);
  assertEquals(liveHero(shielded.owner)?.poolHits, 0);

  const air = pair(1000.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 200.0;
  frame(air.world, down);
  assertTrue(air.owner.special.action !== SpecialAction.heroDown);
});
