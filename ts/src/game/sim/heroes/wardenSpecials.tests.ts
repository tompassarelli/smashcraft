// Warden's four specials through the production special, contact, projectile
// and motion functions (smashcraft:docs/design/roster.md, Warden B specials).
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, ProjectileKind, SpecialAction } from "../codes";
import { isIntangible } from "../conditions";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus, regenerateMana } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { setWorldMotionValue } from "../motion";
import { mainDeckRight } from "../stage";
import { squareRoot } from "../warcraftMath";

const H = HERO_REFERENCE_HEIGHT;

/** One match-ordered frame: motion, special starts, contacts (`atContacts` observes them), specials, projectiles, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls(), atContacts?: () => void): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  atContacts?.();
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  finishDamageContacts(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
}

function pair(ownerX: number, targetX: number, facing = 1): { world: Roster; warden: Fighter; target: Fighter } {
  const warden = createFighter(Character.warden, ownerX, facing);
  const target = createFighter(Character.archer, targetX, -facing);
  const world = createRoster(3, [warden, target]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, warden, target };
}

function place(f: Fighter, x: number, z: number): void {
  f.motion.x = x;
  f.motion.z = z;
  setWorldMotionValue(f.motion.meleeX, x);
  setWorldMotionValue(f.motion.meleeZ, z);
  f.motion.grounded = z === 0.0;
  if (z !== 0.0) f.motion.surface = undefined;
}

const neutralB = controls({ specialPressed: true });
const sideB = (x: number) => controls({ specialPressed: true, specialX: x });
const upB = controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 });
const downB = controls({ specialPressed: true, specialZ: -1 });
const hold = (direction: number, verticalDirection: number) => controls({ direction, verticalDirection });

test("Warden's specials cost 5, 15, 20 and 18 mana once on entry", () => {
  for (const [input, cost] of [[neutralB, 5], [sideB(1), 15], [upB, 20], [downB, 18]] as const) {
    const { world, warden } = pair(0.0, 500.0);
    frame(world, input);
    assertTrue(warden.special.action !== SpecialAction.none);
    assertEquals(warden.mana.points, 100 - cost);
    for (let f = 2; f <= 20; f++) frame(world);
    assertEquals(warden.mana.points, 100 - cost);
  }
});

test("Shadow Strike throws one slow reflectable blade on f16 and refuses a second while it flies", () => {
  const { world, warden } = pair(0.0, 1200.0);
  frame(world, neutralB);
  const live = () => warden.projectiles.filter(p => p.life > 0 && p.kind === ProjectileKind.hero).length;
  for (let f = 2; f <= 15; f++) frame(world);
  assertEquals(live(), 0);
  frame(world);
  assertEquals(live(), 1);
  const blade = warden.projectiles.find(p => p.life > 0)!;
  assertNear(blade.velocityX, f32(H * f32(0.11)), f32(0.001));
  assertTrue(blade.spec?.reflectable === true);
  for (let f = 17; f <= 37; f++) frame(world);
  assertEquals(warden.special.action, SpecialAction.none);
  frame(world, neutralB);
  assertEquals(warden.special.action, SpecialAction.none);
  assertEquals(warden.mana.points, 95);
});

test("Pursuit Lunge travels 1.0H, slashes once for 10 at f11-14 and stops dead, in both facings", () => {
  for (const facing of [-1, 1]) {
    const travel = pair(0.0, f32(1500.0 * facing), facing);
    frame(travel.world, sideB(facing));
    for (let f = 2; f <= 5; f++) frame(travel.world);
    const startX = travel.warden.motion.x;
    for (let f = 6; f <= 15; f++) frame(travel.world);
    assertNear(f32((travel.warden.motion.x - startX) * facing), H, f32(0.01));
    const stopX = travel.warden.motion.x;
    for (let f = 16; f <= 40; f++) frame(travel.world);
    assertEquals(travel.warden.motion.x, stopX);
    assertEquals(travel.warden.special.action, SpecialAction.none);
    const { world, warden, target } = pair(0.0, f32(220.0 * facing), facing);
    frame(world, sideB(facing));
    for (let f = 2; f <= 10; f++) frame(world);
    assertEquals(target.status.damage, 0.0);
    for (let f = 11; f <= 60; f++) frame(world);
    assertEquals(target.status.damage, 10.0);
    assertEquals(warden.special.action, SpecialAction.none);
  }
});

test("Pursuit Lunge in the air tilts 20 degrees only for a direction held through entry, then falls helpless", () => {
  const rise = (vertical: number, late: number) => {
    const { world, warden } = pair(0.0, 1500.0);
    place(warden, 0.0, 700.0);
    frame(world, controls({ specialPressed: true, specialX: 1, verticalDirection: vertical }));
    for (let f = 2; f <= 4; f++) frame(world, hold(0, vertical));
    for (let f = 5; f <= 6; f++) frame(world, hold(0, late));
    const vz = warden.motion.vz;
    for (let f = 7; f <= 40; f++) frame(world);
    assertTrue(warden.special.fall);
    frame(world, sideB(1));
    assertEquals(warden.special.action, SpecialAction.none);
    return vz;
  };
  const tilt = f32(f32(H / 10.0) * f32(0.342020143));
  assertNear(rise(1, 0), tilt, f32(0.01));
  assertNear(rise(-1, 0), -tilt, f32(0.01));
  assertNear(rise(0, 1), 0.0, f32(0.01));
});

test("Blink moves 1.7H in the held direction on f9, intangible only f8-10, then helpless", () => {
  for (const [x, z] of [[1, 1], [-1, 0], [0, 1], [1, -1], [0, 0]] as const) {
    const { world, warden, target } = pair(0.0, 1500.0);
    place(warden, 0.0, 600.0);
    const intangible: number[] = [];
    const observe = () => { if (isIntangible(warden)) intangible.push(warden.special.frame + 1); };
    frame(world, upB, controls(), observe);
    for (let f = 2; f <= 9; f++) frame(world, hold(x, z), controls(), observe);
    const beforeX = warden.motion.x;
    const beforeZ = warden.motion.z;
    // The stick on the displacement frame changes nothing.
    frame(world, hold(-x, -z), controls(), observe);
    const movedX = f32(warden.motion.x - beforeX);
    const movedZ = f32(warden.motion.z - beforeZ);
    assertNear(squareRoot(f32(f32(movedX * movedX) + f32(movedZ * movedZ))), f32(H * f32(1.7)), 0.5);
    const aimZ = x === 0 && z === 0 ? 1 : z;
    assertTrue(movedX * x >= 0.0 && Math.abs(movedX) > 100.0 === (x !== 0));
    assertTrue(Math.abs(movedZ) > 100.0 === (aimZ !== 0) && movedZ * aimZ >= 0.0);
    for (let f = 11; f <= 30; f++) frame(world, controls(), controls(), observe);
    assertEquals(intangible.join(","), "8,9,10");
    assertTrue(warden.special.fall);
    assertFalse(target.status.damage > 0.0);
  }
});

test("Blink's mana-free form rises 1.1H straight up without intangibility", () => {
  const { world, warden } = pair(0.0, 1500.0);
  place(warden, 0.0, 600.0);
  warden.mana.points = 19;
  frame(world, upB);
  assertEquals(warden.mana.points, 19);
  for (let f = 2; f <= 9; f++) {
    frame(world, hold(1, 0));
    assertFalse(isIntangible(warden));
  }
  const beforeX = warden.motion.x;
  const beforeZ = warden.motion.z;
  frame(world);
  assertEquals(warden.motion.x, beforeX);
  assertNear(f32(warden.motion.z - beforeZ), f32(H * f32(1.1)), f32(0.01));
});

test("Blink stops at the stage instead of crossing it, and a grounded endpoint stays punishable", () => {
  // Beside the main deck's body, aimed into it: the wall stops the displacement.
  const { world, warden } = pair(0.0, 1500.0, -1);
  place(warden, 700.0, 30.0);
  frame(world, upB);
  for (let f = 2; f <= 9; f++) frame(world, hold(-1, 0));
  frame(world);
  assertGreaterThan(warden.motion.x, mainDeckRight(0));
  // Above the deck, aimed down: it lands on the deck and keeps its endpoint recovery.
  const down = pair(0.0, 1500.0);
  place(down.warden, 0.0, 120.0);
  frame(down.world, upB);
  for (let f = 2; f <= 9; f++) frame(down.world, hold(0, -1));
  frame(down.world);
  assertEquals(down.warden.motion.z, 0.0);
  assertTrue(down.warden.motion.grounded);
  assertEquals(down.warden.special.action, SpecialAction.heroUp);
  for (let f = 11; f <= 29; f++) {
    frame(down.world, controls({ attackPressed: true }));
    assertEquals(down.warden.special.action, SpecialAction.heroUp);
  }
  frame(down.world);
  assertEquals(down.warden.special.action, SpecialAction.none);
  assertFalse(down.warden.special.fall);
});

test("Fan of Knives strikes front and back once each for 7 at 45 degrees outward", () => {
  for (const facing of [-1, 1]) {
    for (const side of [-1, 1]) {
      const { world, warden, target } = pair(0.0, f32(90.0 * facing * side), facing);
      frame(world, downB);
      for (let f = 2; f <= 8; f++) frame(world);
      assertEquals(target.status.damage, 0.0);
      for (let f = 9; f <= 12; f++) frame(world);
      assertEquals(target.status.damage, 7.0);
      assertTrue(f32(target.launch.knockbackX * facing * side) > 0.0);
      for (let f = 13; f <= 38; f++) frame(world);
      assertEquals(target.status.damage, 7.0);
      assertLessThan(Math.abs(target.motion.x), 2000.0);
    }
  }
});

test("Shadow Strike is reflected by a powershield back at Warden, owned by the reflector", () => {
  const { world, warden, target } = pair(0.0, 300.0);
  frame(world, neutralB);
  let reflected = false;
  for (let f = 2; f <= 60 && !reflected; f++) {
    target.shield.raised = true;
    target.shield.reflectFrames = 2;
    frame(world);
    reflected = target.projectiles.some(p => p.life > 0 && p.kind === ProjectileKind.hero && p.velocityX < 0.0);
  }
  assertTrue(reflected);
  assertEquals(target.status.damage, 0.0);
  assertFalse(warden.projectiles.some(p => p.life > 0));
});

test("a point-blank Shadow Strike on a held shield leaves the defender free well before Warden acts", () => {
  const { world, target } = pair(0.0, 90.0);
  const guard = controls({ shield: true });
  let blockedAt = 0;
  let stun = 0;
  for (let f = 1; f <= 37 && blockedAt === 0; f++) {
    frame(world, f === 1 ? neutralB : controls(), guard);
    if (target.shield.stun > 0) {
      blockedAt = f;
      stun = target.shield.stun;
    }
  }
  assertEquals(target.status.damage, 0.0);
  assertGreaterThan(blockedAt, 0);
  // Warden acts on frame 38; an out-of-shield grab needs about ten frames.
  assertLessThan(blockedAt + stun + 10, 38);
});

test("Fan of Knives on a held shield leaves the defender a punish before Warden acts", () => {
  for (const side of [-1, 1]) {
    const { world, target } = pair(0.0, f32(70.0 * side));
    const guard = controls({ shield: true });
    let blockedAt = 0;
    let stun = 0;
    for (let f = 1; f <= 38 && blockedAt === 0; f++) {
      frame(world, f === 1 ? downB : controls(), guard);
      if (target.shield.stun > 0) {
        blockedAt = f;
        stun = target.shield.stun;
      }
    }
    assertEquals(target.status.damage, 0.0);
    assertGreaterThan(blockedAt, 0);
    // Warden acts on frame 39; an out-of-shield grab needs about ten frames.
    assertLessThan(blockedAt + stun + 10, 39);
  }
});

test("Blink cannot start from an attack's recovery", () => {
  const { world, warden } = pair(0.0, 1500.0);
  beginFighterAttack(world, 0, AttackStyle.forwardTilt, false);
  for (let f = 1; f < warden.attack.duration; f++) {
    frame(world, upB);
    assertEquals(warden.special.action, SpecialAction.none);
    assertEquals(warden.mana.points, 100);
  }
});
