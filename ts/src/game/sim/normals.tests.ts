// These normal-attack contracts share authored contact windows and the same
// production movement step, including landing and defensive interruptions.
// Normal attacks and projectiles: ranges, phases, lingering aerial windows,
// landings, ground dodges and walking.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackPhase, AttackStyle, Character } from "./codes";
import { attackPhase, canAttack, isIntangible } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { ordinaryHitlagFrames } from "./knockback";
import {
  attackActiveFrames,
  attackDurationFrames,
  attackLandingLag,
  attackRecoveryFrames,
  attackStartupFrames,
  isAerialAttack,
} from "./moves";
import { projectileCount, updateProjectiles } from "./projectiles";
import type { Roster } from "./roster";
import { advanceFighter } from "./step";
import { advanceSolo, controls, resolveStartedAttack, testBeginAttacks, testWorld } from "./testWorld";

const AERIALS = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir] as const;
const LINGERING_AERIALS = [AttackStyle.neutralAir, AttackStyle.backAir] as const;

function spawnTestProjectile(world: Roster, owner: Fighter): void {
  testBeginAttacks(world, AttackStyle.shot, undefined);
  owner.attack.frame = attackStartupFrames(AttackStyle.shot);
  resolveAttacks(world);
}

test("the projectile pool expires misses at their range", () => {
  const owner = createFighter(Character.archer, 0.0, 1);
  const world = testWorld(owner, createFighter(Character.rifleman, 5000.0, -1));
  spawnTestProjectile(world, owner);
  assertEquals(projectileCount(owner), 1);
  assertEquals(owner.projectiles[0]!.x, 35.0);
  assertEquals(owner.projectiles[0]!.direction, 1);
  for (let frame = 1; frame <= 59; frame++) updateProjectiles(world);
  assertEquals(projectileCount(owner), 1);
  updateProjectiles(world);
  assertEquals(projectileCount(owner), 0);
});

test("projectiles cross the arena and disappear on contact", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [1, -1]) {
      const owner = createFighter(character, f32(-800.0 * direction), direction);
      const target = createFighter(character === Character.archer ? Character.rifleman : Character.archer, f32(800.0 * direction), -direction);
      const world = testWorld(owner, target);
      spawnTestProjectile(world, owner);
      for (let frame = 1; frame <= 42; frame++) updateProjectiles(world);
      assertEquals(projectileCount(owner), 1);
      assertEquals(target.status.damage, 0.0);
      for (let frame = 43; frame <= 45; frame++) updateProjectiles(world);
      assertEquals(projectileCount(owner), 0);
      assertEquals(target.status.damage, 3.0);
      for (let frame = 1; frame <= 20; frame++) updateProjectiles(world);
      assertEquals(target.status.damage, 3.0);
    }
  }
});

test("both fighters' basic projectiles cause hitstun", () => {
  for (const [shooter, targetCharacter] of [[Character.archer, Character.rifleman], [Character.rifleman, Character.archer]] as const) {
    const owner = createFighter(shooter, 0.0, 1);
    const target = createFighter(targetCharacter, 100.0, -1);
    const world = testWorld(owner, target);
    spawnTestProjectile(world, owner);
    updateProjectiles(world);
    updateProjectiles(world);
    assertEquals(target.status.damage, 3.0);
    assertEquals(target.launch.hitstun, 9);
  }
});

test("a projectile passes through an intangible target without being consumed", () => {
  const owner = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 400.0, -1);
  const world = testWorld(owner, target);
  target.status.invincible = 100;
  spawnTestProjectile(world, owner);
  for (let frame = 1; frame <= 11; frame++) updateProjectiles(world);
  assertEquals(projectileCount(owner), 1);
  target.status.invincible = 0;
  for (let frame = 1; frame <= 5; frame++) updateProjectiles(world);
  assertEquals(target.status.damage, 0.0);
  assertEquals(projectileCount(owner), 1);
});

function damageFromOneAttack(style: AttackStyle): number {
  const target = createFighter(Character.rifleman, 100.0, -1);
  resolveStartedAttack(testWorld(createFighter(Character.archer, 0.0, 1), target), style);
  return target.status.damage;
}

function tiltDamageAt(style: AttackStyle, facing: number, targetX: number, targetZ: number): number {
  const target = createFighter(Character.rifleman, targetX, -facing);
  target.motion.z = targetZ;
  resolveStartedAttack(testWorld(createFighter(Character.archer, 0.0, facing), target), style);
  return target.status.damage;
}

test("tilts are lighter and recover sooner than smashes", () => {
  for (const style of [AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt]) {
    assertLessThan(damageFromOneAttack(style), damageFromOneAttack(AttackStyle.forwardSmash));
    for (const smash of [AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.forwardSmash]) {
      assertLessThan(attackRecoveryFrames(Character.archer, style, true), attackRecoveryFrames(Character.archer, smash, true));
    }
  }
});

test("angled forward tilts share the flat forward tilt's timing, damage and recovery", () => {
  for (const style of [AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown]) {
    assertEquals(attackStartupFrames(style), attackStartupFrames(AttackStyle.forwardTilt));
    assertEquals(attackActiveFrames(style), attackActiveFrames(AttackStyle.forwardTilt));
    assertEquals(attackDurationFrames(style), attackDurationFrames(AttackStyle.forwardTilt));
    assertEquals(attackRecoveryFrames(Character.archer, style, true), attackRecoveryFrames(Character.archer, AttackStyle.forwardTilt, true));
  }
});

test("aerial normals have distinct phases and landing lag", () => {
  for (const style of AERIALS) {
    assertTrue(isAerialAttack(style));
    assertGreaterThan(attackStartupFrames(style), 0);
    assertGreaterThan(attackActiveFrames(style), 0);
    assertGreaterThan(attackLandingLag(style), 0);
    assertTrue(attackDurationFrames(style) > attackStartupFrames(style) + attackActiveFrames(style));
  }
  assertEquals(attackLandingLag(AttackStyle.jab), 0);
  assertFalse(isAerialAttack(AttackStyle.getupAttack));
  assertFalse(isAerialAttack(AttackStyle.ledgeAttack));
});

function prepareHitRegionAttack(world: Roster, attacker: Fighter, style: AttackStyle, frame: number): void {
  if (isAerialAttack(style)) attacker.motion.grounded = false;
  testBeginAttacks(world, style, undefined);
  assertEquals(attacker.attack.style, style);
  attacker.attack.frame = frame;
  attacker.attack.cooldown = attacker.attack.duration - frame;
}

test("aerial lingering windows match the reference frame boundaries", () => {
  for (const style of LINGERING_AERIALS) {
    const neutral = style === AttackStyle.neutralAir;
    const lastActive = neutral ? 31 : 19;
    const interruptible = neutral ? 42 : 38;
    for (let referenceFrame = 1; referenceFrame <= interruptible - 1; referenceFrame++) {
      const attacker = createFighter(Character.archer, 0.0, 1);
      const target = createFighter(Character.rifleman, -60.0, -1);
      const world = testWorld(attacker, target);
      prepareHitRegionAttack(world, attacker, style, referenceFrame - 1);
      resolveAttacks(world);
      const expected = referenceFrame < 4 || referenceFrame > lastActive ? 0.0 : referenceFrame < 8 ? (neutral ? 7.0 : 8.0) : 5.0;
      assertEquals(target.status.damage, expected);
      if (expected > 0) assertEquals(target.launch.hitlag, ordinaryHitlagFrames(expected));
    }
  }
});

test("the aerial lingering clock starts at zero and unlocks on the reference frame", () => {
  for (const style of LINGERING_AERIALS) {
    const neutral = style === AttackStyle.neutralAir;
    const duration = neutral ? 41 : 37;
    const lastActiveIndex = neutral ? 30 : 18;
    const attacker = createFighter(Character.archer, 0.0, 1);
    const world = testWorld(attacker, createFighter(Character.rifleman, 1000.0, -1));
    const input = controls();
    attacker.motion.z = 740.0;
    attacker.motion.grounded = false;
    testBeginAttacks(world, style, undefined);
    assertEquals(attacker.attack.frame, 0);
    for (let frame = 0; frame <= duration - 1; frame++) {
      assertEquals(attacker.attack.frame, frame);
      assertEquals(attackPhase(attacker), frame < 3 ? AttackPhase.startup : frame <= lastActiveIndex ? AttackPhase.active : AttackPhase.recovery);
      assertFalse(canAttack(attacker));
      advanceFighter(world, 0, 0, input, -240.0);
    }
    assertEquals(attackPhase(attacker), AttackPhase.none);
    assertTrue(canAttack(attacker));
  }
});

test("an aerial's lingering transition retains its single hit through freeze and re-entry", () => {
  for (const style of LINGERING_AERIALS) {
    const attacker = createFighter(Character.rifleman, 0.0, -1);
    const target = createFighter(Character.archer, 60.0, 1);
    const lateTarget = createFighter(Character.archer, 60.0, 1);
    const world = testWorld(attacker, target);
    const input = controls();
    attacker.motion.z = 500.0;
    target.motion.z = 500.0;
    lateTarget.motion.z = 500.0;
    prepareHitRegionAttack(world, attacker, style, 6);
    resolveAttacks(world);
    const strongDamage = style === AttackStyle.neutralAir ? 7.0 : 8.0;
    assertEquals(target.status.damage, strongDamage);
    for (let tick = 1; tick <= ordinaryHitlagFrames(strongDamage) - 1; tick++) {
      advanceFighter(world, 0, 0, input, -240.0);
      assertEquals(attacker.attack.frame, 6);
    }
    advanceFighter(world, 0, 0, input, -240.0);
    assertEquals(attacker.attack.frame, 7);
    target.motion.x = 1000.0;
    resolveAttacks(world);
    target.motion.x = 60.0;
    resolveAttacks(world);
    assertEquals(target.status.damage, strongDamage);
    resolveAttacks(testWorld(attacker, lateTarget));
    assertEquals(lateTarget.status.damage, 5.0);
    if (style === AttackStyle.backAir) assertGreaterThan(lateTarget.launch.knockbackX, 0.0);
  }
});

test("ground normals and grab can't start in the air, but the shot can", () => {
  for (const style of [
    AttackStyle.jab, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.forwardSmash, AttackStyle.grab,
    AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown,
  ]) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 100.0;
    testBeginAttacks(testWorld(fighter, createFighter(Character.rifleman, 1000.0, -1)), style, undefined);
    assertEquals(fighter.attack.style, undefined);
  }
  const groundTarget = createFighter(Character.rifleman, 1000.0, -1);
  const grounded = createFighter(Character.archer, 0.0, 1);
  testBeginAttacks(testWorld(grounded, groundTarget), AttackStyle.neutralAir, undefined);
  assertEquals(grounded.attack.style, undefined);
  const airborne = createFighter(Character.archer, 0.0, 1);
  airborne.motion.grounded = false;
  airborne.motion.z = 100.0;
  testBeginAttacks(testWorld(airborne, groundTarget), AttackStyle.shot, undefined);
  assertEquals(airborne.attack.style, AttackStyle.shot);
});

function aerialAt(style: AttackStyle, facing: number, targetX: number, targetZ: number): Fighter {
  const attacker = createFighter(Character.archer, 0.0, facing);
  const target = createFighter(Character.rifleman, targetX, -facing);
  const world = testWorld(attacker, target);
  attacker.motion.grounded = false;
  attacker.motion.z = 200.0;
  target.motion.grounded = false;
  target.motion.z = targetZ;
  testBeginAttacks(world, style, undefined);
  for (let frame = 1; frame <= attackStartupFrames(style); frame++) {
    attacker.attack.frame = attackStartupFrames(style);
    resolveAttacks(world);
  }
  return target;
}

test("aerial normals use directional shapes and launch directions", () => {
  assertGreaterThan(aerialAt(AttackStyle.forwardAir, 1, 120.0, 200.0).status.damage, 0.0);
  assertEquals(aerialAt(AttackStyle.forwardAir, 1, -120.0, 200.0).status.damage, 0.0);
  assertGreaterThan(aerialAt(AttackStyle.backAir, 1, -120.0, 200.0).status.damage, 0.0);
  assertEquals(aerialAt(AttackStyle.backAir, 1, 120.0, 200.0).status.damage, 0.0);
  assertGreaterThan(aerialAt(AttackStyle.upAir, 1, 0.0, 340.0).status.damage, 0.0);
  assertEquals(aerialAt(AttackStyle.upAir, 1, 0.0, 10.0).status.damage, 0.0);
  assertGreaterThan(aerialAt(AttackStyle.downAir, 1, 0.0, 50.0).status.damage, 0.0);
  assertEquals(aerialAt(AttackStyle.downAir, 1, 0.0, 191.0).status.damage, 0.0);
  assertLessThan(aerialAt(AttackStyle.backAir, 1, -100.0, 200.0).launch.knockbackX, 0.0);
  assertLessThan(aerialAt(AttackStyle.downAir, 1, 0.0, 150.0).launch.knockbackZ, 0.0);
});

test("landing cancels an aerial's active window and applies move-specific lag", () => {
  for (const style of AERIALS) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    const target = createFighter(Character.rifleman, 50.0, -1);
    const world = testWorld(fighter, target);
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    fighter.motion.vz = -2.0;
    testBeginAttacks(world, style, undefined);
    fighter.attack.frame = attackStartupFrames(style);
    advanceFighter(world, 0, 0, controls(), -240.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.attack.style, undefined);
    assertFalse(fighter.attack.hit);
    assertEquals(fighter.landing.lag, attackLandingLag(style));
    resolveAttacks(world);
    assertEquals(target.status.damage, 0.0);
  }
});

test("a C-stick down air preserves normal aerial momentum for both fighters", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const verticalSign of [-1, 1]) {
      const fighter = createFighter(character, 0.0, 1);
      const falling = createFighter(character, 0.0, 1);
      const world = testWorld(fighter, createFighter(character === Character.archer ? Character.rifleman : Character.archer, 500.0, -1));
      const input = controls({ cStickZ: -1 });
      const neutralInput = controls();
      for (const f of [fighter, falling]) {
        f.motion.grounded = false;
        f.motion.z = 500.0;
        f.motion.vz = f32(verticalSign * 8.0);
        f.launch.knockbackZ = 2.0;
      }
      testBeginAttacks(world, AttackStyle.downAir, undefined);
      assertEquals(fighter.motion.vz, falling.motion.vz);
      assertEquals(fighter.launch.knockbackZ, falling.launch.knockbackZ);
      for (let frame = 1; frame <= 26; frame++) {
        advanceFighter(world, 0, 0, input, 0.0);
        advanceSolo(falling, 0, neutralInput, 0.0);
        assertNear(fighter.motion.vz, falling.motion.vz, 0.00009999999747378752);
        assertNear(fighter.motion.z, falling.motion.z, 0.00009999999747378752);
      }
    }
  }
});

test("the archer's down air has one strong-to-weak window, and the rifleman's is unchanged", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  fighter.motion.grounded = false;
  fighter.motion.z = 300.0;
  target.motion.z = 240.0;
  testBeginAttacks(testWorld(fighter, target), AttackStyle.downAir, undefined);
  fighter.attack.frame = 7;
  resolveAttacks(testWorld(fighter, target));
  assertEquals(target.status.damage, 9.0);
  fighter.launch.hitlag = 0;
  fighter.attack.frame = 26;
  resolveAttacks(testWorld(fighter, target));
  assertEquals(target.status.damage, 9.0);
  const lateTarget = createFighter(Character.rifleman, 0.0, -1);
  lateTarget.motion.z = 240.0;
  resolveAttacks(testWorld(fighter, lateTarget));
  assertEquals(lateTarget.status.damage, 6.0);
  fighter.launch.hitlag = 0;
  fighter.attack.frame = 27;
  assertEquals(attackPhase(fighter), AttackPhase.recovery);
  const rifleman = createFighter(Character.rifleman, 0.0, 1);
  rifleman.motion.grounded = false;
  rifleman.motion.z = 300.0;
  rifleman.motion.vz = 10.0;
  testBeginAttacks(testWorld(rifleman, target), AttackStyle.downAir, undefined);
  assertEquals(rifleman.motion.vz, 10.0);
  rifleman.attack.frame = 9;
  assertEquals(attackPhase(rifleman), AttackPhase.active);
  rifleman.attack.frame = 10;
  assertEquals(attackPhase(rifleman), AttackPhase.recovery);
});

test("the rifleman's down tilt hits harder than the archer's on the same frames", () => {
  const damageBy = (character: Character): number => {
    const target = createFighter(Character.archer, 100.0, -1);
    resolveStartedAttack(testWorld(createFighter(character, 0.0, 1), target), AttackStyle.downTilt);
    return target.status.damage;
  };
  assertEquals(damageBy(Character.archer), 8.0);
  assertEquals(damageBy(Character.rifleman), 10.0);
  assertEquals(attackRecoveryFrames(Character.rifleman, AttackStyle.downTilt, true), attackRecoveryFrames(Character.archer, AttackStyle.downTilt, true));
});

test("common ground dodge frame data applies to both characters", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [-1, 0, 1]) {
      const fighter = createFighter(character, 0.0, 1);
      const input = controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: direction });
      const duration = direction === 0 ? 22 : 31;
      for (let frame = 1; frame <= duration; frame++) {
        advanceSolo(fighter, 0, input, 0.0);
        input.groundDodgePressed = false;
        assertEquals(fighter.dodge.groundFrame, frame);
        const expectedIntangible = direction === 0 ? frame >= 2 && frame <= 15 : frame >= 4 && frame <= 19;
        assertEquals(isIntangible(fighter), expectedIntangible);
        assertFalse(canAttack(fighter));
      }
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.dodge.groundFrame, 0);
    }
  }
});

test("air drift changes velocity without turning the fighter", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 100.0;
  advanceSolo(fighter, 0, controls({ direction: -1 }), -240.0);
  assertEquals(fighter.facing, 1);
  assertLessThan(fighter.motion.vx, 0.0);
});

test("angled forward tilts cover their vertical offset and preserve the facing range", () => {
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltUp, 1, 100.0, 150.0), 10.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltUp, 1, 100.0, -150.0), 0.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltDown, 1, 100.0, -150.0), 10.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltDown, 1, 100.0, 150.0), 0.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTilt, 1, 100.0, 150.0), 0.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTilt, 1, 100.0, -150.0), 0.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltUp, 1, 135.0, 65.0), 10.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltDown, 1, 135.0, -65.0), 10.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltUp, 1, 146.0, 65.0), 0.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTiltDown, -1, 100.0, -65.0), 0.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTilt, 1, 147.0, 0.0), 10.0);
  assertEquals(tiltDamageAt(AttackStyle.forwardTilt, 1, 148.0, 0.0), 0.0);
});

test("the walking modifier uses the character's walk speed and releases to a dash", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const fighter = createFighter(character, 0.0, direction);
      const input = controls({ direction, walking: true });
      for (let tick = 1; tick <= 10; tick++) {
        advanceSolo(fighter, 0, input, 0.0);
        assertGreaterThan(fighter.motion.vx * direction, 0.0);
        assertLessThan(fighter.motion.vx * direction, fighter.tuning.physics.walkSpeed);
      }
      input.walking = false;
      advanceSolo(fighter, 0, input, 0.0);
      assertNear(fighter.motion.vx, 11.399999618530273 * direction, 0.0010000000474974513);
      assertEquals(fighter.ground.dashFrame, 1);
      input.walking = true;
      advanceSolo(fighter, 0, input, 0.0);
      assertGreaterThan(fighter.motion.vx * direction, 0.0);
      assertEquals(fighter.ground.dashFrame, 0);
    }
  }
});
