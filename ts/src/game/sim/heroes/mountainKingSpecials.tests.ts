// Mountain King's four specials through the production special, projectile,
// contact and resource path, against smashcraft:docs/design/roster.md.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "../attacks";
import { Character, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { regenerateMana } from "../mana";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { MOUNTAIN_KING_HERO } from "./mountainKingHero";

const H = HERO_REFERENCE_HEIGHT;
const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1 });
const up = controls({ specialPressed: true, specialZ: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });

function mountainKing(x: number, facing: number): Fighter {
  const f = createFighter(Character.mountainKing, x, facing);
  f.mana.points = 100;
  return f;
}

/** One match-ordered frame: motion, special starts, contacts, specials, projectiles, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(gap: number, facing = 1): { world: Roster; owner: Fighter; target: Fighter } {
  const owner = mountainKing(f32(-gap * 0.5 * facing), facing);
  const target = createFighter(Character.archer, f32(gap * 0.5 * facing), -facing);
  const world = createRoster(3, [owner, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, target };
}

/** Frames from the press (frame 1) through the frame that ends the action; the fighter acts on the next. */
function actionLength(world: Roster, owner: Fighter, press: Readonly<Controls>): number {
  frame(world, press);
  let length = 1;
  while (owner.special.action !== SpecialAction.none && length < 200) {
    frame(world);
    length++;
  }
  return length;
}

test("Mountain King's specials spend their roster costs once and end on their roster frames", () => {
  assertTrue(MOUNTAIN_KING_HERO.specials !== undefined);
  for (const [press, cost, end] of [[neutral, 8, 48], [side, 18, 46], [down, 20, 81]] as const) {
    const { world, owner } = pair(1200.0);
    assertEquals(actionLength(world, owner, press), end);
    assertEquals(owner.mana.points, 100 - cost);
  }
  const { world, owner } = pair(1200.0);
  frame(world, up);
  assertEquals(owner.special.action, SpecialAction.heroUp);
  assertEquals(owner.mana.points, 85);
});

test("Storm Bolt flies 0.12H a frame from frame 20, one at a time, and hits once for 5", () => {
  for (const facing of [1, -1]) {
    const { world, owner, target } = pair(400.0, facing);
    frame(world, neutral);
    for (let f = 2; f <= 19; f++) frame(world);
    assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
    frame(world);
    const bolt = owner.projectiles.find(p => p.life > 0 && p.kind === ProjectileKind.hero);
    assertTrue(bolt !== undefined);
    if (bolt === undefined) return;
    const start = bolt.x;
    frame(world);
    assertNear(f32((bolt.x - start) * facing), f32(H * f32(0.12)), f32(0.001));
    for (let f = 0; f < 40 && owner.special.action !== SpecialAction.none; f++) frame(world);
    const before = owner.mana.points;
    if (bolt.life > 0) {
      frame(world, neutral);
      assertEquals(owner.special.action, SpecialAction.none);
      assertEquals(owner.mana.points, before);
    }
    for (let f = 0; f < 40 && target.status.damage === 0.0; f++) frame(world);
    assertEquals(target.status.damage, 5.0);
    assertGreaterThan(target.launch.knockbackX * facing, 0.0);
    for (let f = 0; f < 40; f++) frame(world);
    assertEquals(target.status.damage, 5.0);
  }
});

test("a shielded Storm Bolt at full travel leaves the defender free before Mountain King can run in to grab", () => {
  // Its outbound flight: 45 frames from frame 20, then it turns back.
  const travel = f32(f32(H * f32(0.12)) * 44);
  const { world, owner, target } = pair(f32(travel + 32.0));
  target.shield.raised = true;
  let blockedAt = 0;
  let stun = 0;
  for (let f = 1; f <= 80 && blockedAt === 0; f++) {
    frame(world, f === 1 ? neutral : controls(), controls({ shield: true }));
    if (target.shield.stun > 0) {
      blockedAt = f;
      stun = target.shield.stun;
    }
  }
  assertGreaterThan(blockedAt, 0);
  assertEquals(target.status.damage, 0.0);
  // Mountain King acts on frame 49; from there he still has the whole gap less grab reach to run.
  const runFrames = Math.ceil(f32(f32(f32(target.motion.x - owner.motion.x) - f32(H * 0.5)) / owner.tuning.physics.runSpeed));
  assertLessThan(blockedAt + stun, 49 + runFrames);
});

const run = (world: Roster, frames: number, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()) => {
  for (let f = 0; f < frames; f++) frame(world, first, second);
};
const neutralRelease = controls({ specialPressed: true });
const guard = controls({ shield: true, shieldPressed: true, shieldTriggerActive: true });

/** A Thunder Clap pressed, then released on `release` (undefined: runs out), against a target `gap` away. */
function clap(gap: number, release: number | undefined, facing = 1, ownerFacing = facing): { world: Roster; owner: Fighter; target: Fighter } {
  const match = pair(gap, facing);
  match.owner.facing = ownerFacing;
  frame(match.world, down);
  for (let f = 2; f <= 90; f++) frame(match.world, f === release ? neutralRelease : controls());
  return match;
}

test("Thunder Clap charges: a release in f10-29 is the 9% Clap, f30-49 the 12% Thunder Clap, and running out slams on f53", () => {
  for (const facing of [1, -1]) {
    for (const behind of [false, true]) {
      const near = f32(H * f32(0.85));
      const early = clap(near, 15, behind ? -facing : facing, facing);
      assertEquals(early.target.status.damage, 9.0);
      assertGreaterThan(Math.abs(f32(early.target.motion.x - early.owner.motion.x)), near);
      assertEquals(clap(near, 35, behind ? -facing : facing, facing).target.status.damage, 12.0);
    }
  }
  const { world, owner, target } = pair(f32(H * f32(0.85)));
  frame(world, down);
  run(world, 51);
  assertEquals(target.status.damage, 0.0);
  run(world, 4);
  assertEquals(target.status.damage, 12.0);
  assertEquals(owner.mana.points, 80);
});

test("Thunder Clap's ground waves reach about 2.4H past the ring on both sides; the small Clap sends none", () => {
  for (const behind of [false, true]) {
    const far = f32(H * f32(2.6));
    assertEquals(clap(far, 35, behind ? -1 : 1).target.status.damage, 7.0);
    assertEquals(clap(far, 15, behind ? -1 : 1).target.status.damage, 0.0);
    assertEquals(clap(f32(H * f32(4.0)), 35).target.status.damage, 0.0);
  }
});

test("Thunder Clap counterplay: a jump clears ring and waves, a hit during the charge stops it, and shield drops the charge", () => {
  for (const gap of [f32(H * f32(0.6)), f32(H * f32(2.0))]) {
    const jumped = pair(gap);
    jumped.target.motion.grounded = false;
    frame(jumped.world, down);
    for (let f = 2; f <= 80; f++) {
      jumped.target.motion.z = 60.0;
      jumped.target.motion.vz = 0.0;
      frame(jumped.world, f === 35 ? neutralRelease : controls());
    }
    assertEquals(jumped.target.status.damage, 0.0);
  }
  const hit = pair(f32(H * f32(0.85)));
  frame(hit.world, down);
  run(hit.world, 19);
  hit.owner.launch.hitstun = 20;
  hit.owner.special.action = SpecialAction.none;
  run(hit.world, 60);
  assertEquals(hit.target.status.damage, 0.0);
  const held = pair(1200.0);
  frame(held.world, down);
  run(held.world, 14);
  frame(held.world, guard);
  assertEquals(held.owner.special.action, SpecialAction.none);
  run(held.world, 2, controls({ shield: true, shieldTriggerActive: true }));
  assertTrue(held.owner.shield.raised);
  assertEquals(held.owner.mana.points, 80);
});

test("Storm Bolt turns back after 45 frames and flies to Mountain King, who can throw again once it arrives", () => {
  const { world, owner } = pair(1200.0);
  frame(world, neutral);
  run(world, 19);
  const bolt = owner.projectiles.find(p => p.life > 0 && p.kind === ProjectileKind.hero);
  assertTrue(bolt !== undefined);
  if (bolt === undefined) return;
  run(world, 44);
  const farthest = bolt.x;
  assertGreaterThan(farthest, f32(owner.motion.x + f32(f32(H * f32(0.12)) * 43)));
  run(world, 2);
  assertLessThan(bolt.x, farthest);
  for (let f = 0; f < 60 && bolt.life > 0; f++) frame(world);
  assertEquals(bolt.life, 0);
  frame(world, neutral);
  assertEquals(owner.special.action, SpecialAction.heroNeutral);
});

test("Storm Bolt recall: neutral special while it flies calls it back at once, and the return hit launches toward Mountain King", () => {
  const { world, owner, target } = pair(f32(H * f32(1.2)));
  target.motion.x = f32(owner.motion.x + f32(H * f32(2.4)));
  frame(world, neutral);
  run(world, 19);
  const bolt = owner.projectiles.find(p => p.life > 0 && p.kind === ProjectileKind.hero);
  if (bolt === undefined) throw new Error("no bolt");
  // Let it pass the target's spot, standing the target clear of the outbound path.
  const keepClear = () => { target.motion.z = 300.0; target.motion.vz = 0.0; target.motion.grounded = false; };
  for (let f = 0; f < 29; f++) { keepClear(); frame(world); }
  assertGreaterThan(bolt.x, target.motion.x);
  assertEquals(owner.special.action, SpecialAction.none);
  frame(world, neutral);
  assertEquals(owner.mana.points, 92);
  target.motion.z = 0.0;
  target.motion.grounded = true;
  target.motion.vz = 0.0;
  run(world, 1);
  assertLessThan(bolt.velocityX, 0.0);
  for (let f = 0; f < 30 && target.status.damage === 0.0; f++) frame(world);
  assertEquals(target.status.damage, 5.0);
  assertLessThan(target.launch.knockbackX, 0.0);
});

test("Hammerfall: special in the leap's f16-28 plunges straight down, spikes an airborne target, launches a grounded one and lands with 24 frames of lag", () => {
  const plunge = (targetAirborne: boolean, beside: boolean) => {
    const { world, owner, target } = pair(beside ? f32(H * f32(1.5)) : 1200.0);
    frame(world, up);
    run(world, 19);
    assertEquals(owner.special.action, SpecialAction.heroUp);
    target.motion.x = beside ? f32(owner.motion.x + f32(H * f32(1.5))) : owner.motion.x;
    if (targetAirborne) {
      target.motion.grounded = false;
      target.motion.z = f32(owner.motion.z - 120.0);
    }
    frame(world, neutralRelease);
    const x = owner.motion.x;
    let landed = 0;
    let launchZ = 0.0;
    for (let f = 2; f <= 80 && landed === 0; f++) {
      if (launchZ === 0.0 && target.launch.knockbackZ !== 0.0) launchZ = target.launch.knockbackZ;
      if (targetAirborne && target.status.damage === 0.0) {
        target.motion.z = f32(owner.motion.z - 120.0) > 60.0 ? f32(owner.motion.z - 120.0) : 60.0;
        target.motion.vz = 0.0;
      }
      frame(world);
      if (owner.motion.grounded) landed = f;
    }
    assertGreaterThan(landed, 0);
    assertEquals(owner.motion.x, x);
    if (launchZ === 0.0) launchZ = target.launch.knockbackZ;
    return { owner, target, world, launchZ };
  };
  const spiked = plunge(true, false);
  assertEquals(spiked.target.status.damage, 12.0);
  assertLessThan(spiked.launchZ, 0.0);
  const grounded = plunge(false, false);
  assertEquals(grounded.target.status.damage, 10.0);
  assertGreaterThan(grounded.launchZ, 0.0);
  assertTrue(grounded.owner.landing.lag >= 23);
  assertEquals(plunge(false, true).target.status.damage, 0.0);
});

test("Storm Rush carries 1.2H, hits for 12 and its air form ends helpless", () => {
  const { world, owner, target } = pair(f32(H * f32(1.4)));
  const startX = owner.motion.x;
  frame(world, side);
  for (let f = 2; f <= 18; f++) frame(world);
  assertEquals(target.status.damage, 12.0);
  const empty = pair(1200.0);
  const from = empty.owner.motion.x;
  for (let f = 1; f <= 46; f++) frame(empty.world, f === 1 ? side : controls());
  assertGreaterThan(f32(empty.owner.motion.x - from), f32(H * f32(1.1)));
  assertLessThan(f32(empty.owner.motion.x - from), f32(H * f32(1.3)));
  assertGreaterThan(owner.motion.x, startX);
  const air = pair(1200.0);
  air.owner.motion.grounded = false;
  air.owner.motion.z = 1500.0;
  air.owner.motion.surface = undefined;
  frame(air.world, side);
  assertEquals(air.owner.special.action, SpecialAction.heroSide);
  for (let f = 2; f <= 46; f++) frame(air.world);
  assertTrue(air.owner.special.fall);
});

test("Thunder Leap peaks at about 1.8H and strikes; below 15 mana the free leap rises less, spends nothing and cannot strike", () => {
  const rise = (mana: number, target: boolean): { height: number; damage: number; owner: Fighter } => {
    const { world, owner, target: victim } = pair(target ? 40.0 : 1200.0);
    owner.mana.points = mana;
    if (target) {
      victim.motion.grounded = false;
      victim.motion.z = 70.0;
    }
    let peak = 0.0;
    for (let f = 1; f <= 40; f++) {
      if (target) {
        victim.motion.z = victim.status.damage > 0.0 ? victim.motion.z : 70.0;
        if (victim.status.damage === 0.0) victim.motion.vz = 0.0;
      }
      frame(world, f === 1 ? up : controls());
      peak = Math.max(peak, owner.motion.z);
    }
    assertEquals(owner.mana.points, mana >= 15 ? mana - 15 : mana);
    return { height: peak, damage: victim.status.damage, owner };
  };
  const full = rise(100, false);
  const free = rise(10, false);
  assertGreaterThan(full.height, f32(H * f32(1.7)));
  assertLessThan(full.height, f32(H * f32(1.85)));
  assertGreaterThan(free.height, f32(H * f32(1.2)));
  assertLessThan(free.height, f32(H * f32(1.35)));
  assertLessThan(free.height, full.height);
  assertTrue(full.owner.special.fall);
  assertTrue(free.owner.special.fall);
  assertEquals(rise(100, true).damage, 8.0);
  assertEquals(rise(10, true).damage, 0.0);
});

test("replaying Mountain King's specials from a restored snapshot reproduces every fighter field", () => {
  const { world, owner, target } = pair(200.0);
  const savedOwner = createFighter(Character.mountainKing, 0.0, 1);
  const savedTarget = createFighter(Character.archer, 0.0, 1);
  frame(world, neutral);
  frame(world);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedTarget, target, 3);
  const run = () => {
    for (let f = 0; f < 60; f++) frame(world);
    frame(world, down);
    for (let f = 0; f < 60; f++) frame(world, f === 55 ? up : controls());
  };
  run();
  const endOwner = createFighter(Character.mountainKing, 0.0, 1);
  const endTarget = createFighter(Character.archer, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endTarget, target, 3);
  assertGreaterThan(target.status.damage, 0.0);
  assertFalse(owner.mana.points === 100);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(target, savedTarget, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endTarget, target, 3, 3), undefined);
});

test("Storm Rush stops at a raised shield or a body instead of carrying through it", () => {
  for (const shielding of [true, false]) {
    const { world, owner, target } = pair(f32(H * 1.0));
    const guard = controls({ shield: shielding });
    for (let f = 1; f <= 46; f++) {
      frame(world, f === 1 ? side : controls(), guard);
      assertLessThan(owner.motion.x, target.motion.x);
    }
    assertEquals(target.status.damage, shielding ? 0.0 : 12.0);
  }
});

test("a point-blank Storm Bolt on a held shield leaves the defender free well before Mountain King acts", () => {
  const { world, target } = pair(90.0);
  const guard = controls({ shield: true });
  let blockedAt = 0;
  let stun = 0;
  for (let f = 1; f <= 48 && blockedAt === 0; f++) {
    frame(world, f === 1 ? neutral : controls(), guard);
    if (target.shield.stun > 0) {
      blockedAt = f;
      stun = target.shield.stun;
    }
  }
  assertEquals(target.status.damage, 0.0);
  assertGreaterThan(blockedAt, 0);
  // Mountain King acts on frame 49; an out-of-shield grab needs about ten frames.
  assertLessThan(blockedAt + stun + 10, 49);
});

test("Thunder Leap turns to a stick held sideways on entry, so it drifts back toward the stage", () => {
  for (const facing of [1, -1]) {
    const { world, owner } = pair(1200.0, facing);
    owner.motion.grounded = false;
    owner.motion.surface = undefined;
    owner.motion.z = 600.0;
    const startX = owner.motion.x;
    frame(world, controls({ specialPressed: true, specialZ: 1, specialX: -facing }));
    assertEquals(owner.special.action, SpecialAction.heroUp);
    assertEquals(owner.facing, -facing);
    for (let f = 2; f <= 28; f++) frame(world);
    assertGreaterThan(f32(f32(startX - owner.motion.x) * facing), f32(H * f32(0.6)));
  }
});
