// These normal-attack contracts share authored contact windows and the same
// production movement step, including landing and defensive interruptions.
// Normal attacks and projectiles: ranges, phases, lingering aerial windows,
// landings, ground dodges and walking.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { AttackPhase, AttackStyle, Character } from "./codes";
import { attackPhase, canAttack, isIntangible } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { fighterSlug, SELECTABLE_CHARACTERS } from "./heroes/registry";
import { ordinaryHitlagFrames } from "./knockback";
import {
  attackActiveFrames,
  attackDurationFrames,
  attackLandingLag,
  attackRecoveryFrames,
  attackStartupFrames,
  isAerialAttack,
} from "./moves";
import type { Roster } from "./roster";
import { advanceFighter } from "./step";
import { advanceSolo, controls, testBeginAttacks, testWorld } from "./testWorld";

const AERIALS = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir] as const;
const LINGERING_AERIALS = [AttackStyle.neutralAir, AttackStyle.backAir] as const;

test("every fighter has a grounded close strike against an overlapping standing foe in both facings [spec #279]", () => {
  for (const character of SELECTABLE_CHARACTERS) for (const facing of [-1, 1]) {
    let connects = false;
    for (const style of [AttackStyle.jab, AttackStyle.forwardTilt, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt]) {
      const owner = createFighter(character, 0.0, facing);
      const target = createFighter(Character.rifleman, 0.0, -facing);
      owner.motion.grounded = true;
      target.motion.grounded = true;
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, style, false);
      owner.attack.frame = attackStartupFrames(style, owner.tuning.moves);
      resolveAttacks(world);
      if (target.status.damage > 0.0) connects = true;
    }
    assertEquals(connects, true, `${fighterSlug(character)}, facing ${facing}, gap 0: standing foe untouched`);
  }
});

test("angled forward tilts share the flat forward tilt's timing, damage and recovery [spec docs/design/roster.md]", () => {
  for (const style of [AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown]) {
    assertEquals(attackStartupFrames(style), attackStartupFrames(AttackStyle.forwardTilt));
    assertEquals(attackActiveFrames(style), attackActiveFrames(AttackStyle.forwardTilt));
    assertEquals(attackDurationFrames(style), attackDurationFrames(AttackStyle.forwardTilt));
    assertEquals(attackRecoveryFrames(Character.rifleman, style, true), attackRecoveryFrames(Character.rifleman, AttackStyle.forwardTilt, true));
  }
});

function prepareHitRegionAttack(world: Roster, attacker: Fighter, style: AttackStyle, frame: number): void {
  if (isAerialAttack(style)) attacker.motion.grounded = false;
  testBeginAttacks(world, style, undefined);
  assertEquals(attacker.attack.style, style);
  attacker.attack.frame = frame;
  attacker.attack.cooldown = attacker.attack.duration - frame;
}

test("aerial lingering windows match the reference frame boundaries [reference]", () => {
  for (const style of LINGERING_AERIALS) {
    const neutral = style === AttackStyle.neutralAir;
    const lastActive = neutral ? 31 : 19;
    const interruptible = neutral ? 42 : 38;
    for (let referenceFrame = 1; referenceFrame <= interruptible - 1; referenceFrame++) {
      const attacker = createFighter(Character.rifleman, 0.0, 1);
      const target = createFighter(Character.rifleman, -60.0, -1);
      const world = testWorld(attacker, target);
      prepareHitRegionAttack(world, attacker, style, referenceFrame - 1);
      resolveAttacks(world);
      const expected = referenceFrame < 4 || referenceFrame > lastActive ? 0.0 : referenceFrame < 8 ? (neutral ? 7.0 : 8.0) : 5.0;
      assertEquals(target.status.damage, expected);
    }
  }
});

test("the aerial lingering clock starts at zero and unlocks on the reference frame [reference]", () => {
  for (const style of LINGERING_AERIALS) {
    const neutral = style === AttackStyle.neutralAir;
    const duration = neutral ? 41 : 37;
    const lastActiveIndex = neutral ? 30 : 18;
    const attacker = createFighter(Character.rifleman, 0.0, 1);
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

test("an aerial's lingering transition retains its single hit through freeze and re-entry [spec docs/physics.md]", () => {
  for (const style of LINGERING_AERIALS) {
    const attacker = createFighter(Character.rifleman, 0.0, -1);
    const target = createFighter(Character.rifleman, 60.0, 1);
    const lateTarget = createFighter(Character.rifleman, 60.0, 1);
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

test("ground normals and grab can't start in the air, but the shot can [spec docs/physics.md]", () => {
  for (const style of [
    AttackStyle.jab, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.forwardSmash, AttackStyle.grab,
    AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown,
  ]) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 100.0;
    testBeginAttacks(testWorld(fighter, createFighter(Character.rifleman, 1000.0, -1)), style, undefined);
    assertEquals(fighter.attack.style, undefined);
  }
  const groundTarget = createFighter(Character.rifleman, 1000.0, -1);
  const grounded = createFighter(Character.rifleman, 0.0, 1);
  testBeginAttacks(testWorld(grounded, groundTarget), AttackStyle.neutralAir, undefined);
  assertEquals(grounded.attack.style, undefined);
  const airborne = createFighter(Character.rifleman, 0.0, 1);
  airborne.motion.grounded = false;
  airborne.motion.z = 100.0;
  testBeginAttacks(testWorld(airborne, groundTarget), AttackStyle.shot, undefined);
  assertEquals(airborne.attack.style, AttackStyle.shot);
});

function aerialAt(style: AttackStyle, facing: number, targetX: number, targetZ: number): Fighter {
  const attacker = createFighter(Character.rifleman, 0.0, facing);
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

test("aerial normals use directional shapes and launch directions [spec docs/physics.md]", () => {
  assertGreaterThan(aerialAt(AttackStyle.forwardAir, 1, 120.0, 200.0).status.damage, 0.0);
  assertEquals(aerialAt(AttackStyle.forwardAir, 1, -120.0, 200.0).status.damage, 0.0);
  assertGreaterThan(aerialAt(AttackStyle.backAir, 1, -120.0, 200.0).status.damage, 0.0);
  assertEquals(aerialAt(AttackStyle.backAir, 1, 120.0, 200.0).status.damage, 0.0);
  assertLessThan(aerialAt(AttackStyle.backAir, 1, -100.0, 200.0).launch.knockbackX, 0.0);
  assertLessThan(aerialAt(AttackStyle.downAir, 1, 0.0, 150.0).launch.knockbackZ, 0.0);
});

test("landing cancels an aerial's active window and applies move-specific lag [spec docs/physics.md]", () => {
  for (const style of AERIALS) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
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

test("a C-stick down air preserves normal aerial momentum for both fighters [spec docs/physics.md]", () => {
  for (const character of [Character.demonHunter, Character.rifleman]) {
    for (const verticalSign of [-1, 1]) {
      const fighter = createFighter(character, 0.0, 1);
      const falling = createFighter(character, 0.0, 1);
      const world = testWorld(fighter, createFighter(character === Character.rifleman ? Character.rifleman : Character.rifleman, 500.0, -1));
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

test("common ground dodge frame data applies to both characters [spec docs/gameplay-design.md]", () => {
  for (const character of [Character.demonHunter, Character.rifleman]) {
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

test("air drift changes velocity without turning the fighter [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 100.0;
  advanceSolo(fighter, 0, controls({ direction: -1 }), -240.0);
  assertEquals(fighter.facing, 1);
  assertLessThan(fighter.motion.vx, 0.0);
});

test("the walking modifier uses the character's walk speed and releases to a dash [spec docs/physics.md]", () => {
  for (const character of [Character.demonHunter, Character.rifleman]) {
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
