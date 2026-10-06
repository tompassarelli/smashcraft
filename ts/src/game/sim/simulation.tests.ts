import { stageBounds } from "./stageBounds";
// Keep these action transitions together: buffered inputs, contact windows
// and landing can resolve on the same production frame.
// Fighter rules: jumps, landings, smash charge, hit regions and
// attack phases.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackPhase, AttackStyle, Character } from "./codes";
import { attackPhase, canAttack } from "./conditions";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { squareRoot } from "./warcraftMath";
import { type Fighter, createFighter } from "./fighter";
import { beginJump } from "./jumpsAndDodges";
import { SMASH_MAX_CHARGE_FRAMES, SMASH_MAX_DAMAGE_MULTIPLIER, attackActiveFrames, attackStartupFrames, isAerialAttack, smashDamageMultiplier } from "./moves";
import type { Controls, Roster } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { advanceFighter } from "./step";
import { respawnFighter } from "./stocks";
import { advanceSolo, controls, soloWorld, testBeginAttacks, testWorld } from "./testWorld";
import { authoredPhysics } from "./tuning";

const jumpSquatFrames = (character: Character) => authoredPhysics(character).jumpSquatFrames;

test("shielding during jump squat uses the later direction for a first-frame wavedash", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const fighter = createFighter(character, 0.0, 1);
      const input = controls({ jumpPressed: true, jumpHeld: true });
      fighter.motion.surface = 0;
      advanceSolo(fighter, 0, input, 0.0);
      input.jumpPressed = false;
      input.airDodgePressed = true;
      advanceSolo(fighter, 0, input, 0.0);
      assertTrue(fighter.jump.dodgeQueued);
      input.airDodgePressed = false;
      input.direction = direction;
      for (let frame = 3; frame <= jumpSquatFrames(character) + 1; frame++) {
        advanceSolo(fighter, 0, input, 0.0);
        input.direction = 0;
      }
      assertEquals(fighter.jump.serial, 1);
      assertFalse(fighter.jump.dodgeQueued);
      assertTrue(fighter.motion.grounded);
      assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
      assertNear(fighter.motion.vx, direction * 15.920684814453125, 0.0010000000474974513);
    }
  }
});

test("hitting a jump squat cancels its buffered air dodge", () => {
  const attacker = createFighter(Character.rifleman, 0.0, 1);
  const fighter = createFighter(Character.archer, 70.0, -1);
  const world = testWorld(attacker, fighter);
  advanceFighter(world, 1, 0, controls({ jumpPressed: true, airDodgePressed: true }), 0.0);
  assertTrue(fighter.jump.dodgeQueued);
  testBeginAttacks(world, AttackStyle.jab, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  assertGreaterThan(fighter.launch.hitstun, 0);
  assertEquals(fighter.jump.squat, 0);
  assertFalse(fighter.jump.dodgeQueued);
});

test("leaving the floor without jumping leaves exactly one air jump", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const side of [-1, 1]) {
      const edge = side < 0 ? surfaceLeft(0, 0, 0) : surfaceRight(0, 0, 0);
      const fighter = createFighter(character, f32(edge - side), side);
      const input = controls({ direction: side });
      fighter.motion.surface = 0;
      advanceSolo(fighter, 0, input, 0.0);
      assertTrue(fighter.motion.grounded);
      assertEquals(fighter.jump.remaining, 2);
      advanceSolo(fighter, 0, input, 0.0);
      assertFalse(fighter.motion.grounded);
      assertEquals(fighter.jump.remaining, 1);
      beginJump(fighter, 0);
      assertEquals(fighter.jump.remaining, 0);
      const jumpSerial = fighter.jump.serial;
      const speed = fighter.motion.vz;
      beginJump(fighter, 0);
      assertEquals(fighter.jump.serial, jumpSerial);
      assertEquals(fighter.motion.vz, speed);
    }
  }
});

test("dropping through a platform leaves exactly one air jump", () => {
  const fighter = createFighter(Character.archer, f32(f32(surfaceLeft(1, 1, 0) + surfaceRight(1, 1, 0)) / 2), 1);
  fighter.motion.surface = 1;
  fighter.motion.z = surfaceZ(1, 1, 0);
  advanceSolo(fighter, 1, controls({ down: true }), 0.0);
  assertFalse(fighter.motion.grounded);
  assertEquals(fighter.jump.remaining, 1);
});

function prepareHitRegionAttack(world: Roster, attacker: Fighter, style: AttackStyle, frame: number): void {
  if (isAerialAttack(style)) attacker.motion.grounded = false;
  testBeginAttacks(world, style, undefined);
  assertEquals(attacker.attack.style, style);
  attacker.attack.frame = frame;
  attacker.attack.cooldown = attacker.attack.duration - frame;
}

test("hit regions prioritize the tip and mirror its full hit effect", () => {
  for (const direction of [-1, 1]) {
    const attacker = createFighter(Character.archer, 0.0, direction);
    const target = createFighter(Character.rifleman, f32(direction * 100.0), -direction);
    const world = testWorld(attacker, target);
    prepareHitRegionAttack(world, attacker, AttackStyle.forwardTilt, 5);
    resolveAttacks(world);
    // x=100 overlaps both regions; only the higher-priority tip applies.
    assertEquals(target.status.damage, 10.0);
    assertNear(target.launch.knockbackX, direction * 7.785600185394287, 0.00009999999747378752);
    assertNear(target.launch.knockbackZ, 5.839200019836426, 0.00009999999747378752);
    assertEquals(target.launch.hitstun, 21);
    assertEquals(target.launch.hitlag, 6);
    assertEquals(attacker.launch.hitlag, 6);
  }
});

test("hit regions distinguish inner and outer, early and late parameters", () => {
  for (const frame of [5, 6]) {
    for (const inner of [false, true]) {
      const attacker = createFighter(Character.archer, 0.0, 1);
      const target = createFighter(Character.rifleman, inner ? 50.0 : 120.0, -1);
      const world = testWorld(attacker, target);
      prepareHitRegionAttack(world, attacker, AttackStyle.forwardTilt, frame);
      resolveAttacks(world);
      const { knockbackX, knockbackZ } = target.launch;
      if (inner) {
        assertEquals(target.status.damage, frame === 5 ? 7.0 : 5.0);
        const speed = frame === 5 ? 6.177599906921387 : 4.770999908447266;
        assertNear(squareRoot(f32(f32(knockbackX * knockbackX) + f32(knockbackZ * knockbackZ))), speed, 0.00009999999747378752);
        assertNear(knockbackX, knockbackZ, 0.00009999999747378752);
        assertEquals(target.launch.hitlag, frame === 5 ? 5 : 4);
      } else {
        assertEquals(target.status.damage, frame === 5 ? 10.0 : 8.0);
        assertNear(knockbackX, frame === 5 ? 7.785600185394287 : 5.731200218200684, 0.00009999999747378752);
        assertNear(knockbackZ, frame === 5 ? 5.839200019836426 : 4.298399925231934, 0.00009999999747378752);
        assertEquals(target.launch.hitlag, frame === 5 ? 6 : 5);
      }
    }
  }
});

test("hit regions respect the active clock and inclusive geometry boundaries", () => {
  for (let frame = 4; frame <= 7; frame++) {
    const attacker = createFighter(Character.archer, 0.0, 1);
    // Tip centerline ends at 111; attack/body radii add 10 + 26.
    const target = createFighter(Character.rifleman, 147.0, -1);
    const world = testWorld(attacker, target);
    prepareHitRegionAttack(world, attacker, AttackStyle.forwardTilt, frame);
    resolveAttacks(world);
    assertEquals(target.status.damage, frame === 5 ? 10.0 : frame === 6 ? 8.0 : 0.0);
  }
  for (let outside = 0; outside <= 3; outside++) {
    const attacker = createFighter(Character.archer, 0.0, -1);
    const target = createFighter(Character.rifleman, outside === 0 ? -148.0 : outside === 1 ? 50.0 : -100.0, 1);
    const world = testWorld(attacker, target);
    target.motion.z = outside === 2 ? -131.0 : outside === 3 ? 131.0 : 0.0;
    prepareHitRegionAttack(world, attacker, AttackStyle.forwardTilt, 5);
    resolveAttacks(world);
    assertEquals(target.status.damage, 0.0);
  }
});

test("an ordinary hit-region window survives freezes, region changes and re-entry", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(attacker, target);
  const input = controls();
  prepareHitRegionAttack(world, attacker, AttackStyle.forwardTilt, 5);
  resolveAttacks(world);
  for (let tick = 1; tick <= 5; tick++) {
    advanceFighter(world, 0, 0, input, -240.0);
    resolveAttacks(world);
    assertEquals(attacker.attack.frame, 5);
    assertEquals(target.status.damage, 10.0);
  }
  target.motion.x = 500.0;
  resolveAttacks(world);
  target.motion.x = 50.0;
  advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(attacker.attack.frame, 6);
  resolveAttacks(world);
  assertEquals(target.status.damage, 10.0);
  while (attacker.attack.style !== undefined) advanceFighter(world, 0, 0, input, -240.0);
  prepareHitRegionAttack(world, attacker, AttackStyle.forwardTilt, 5);
  resolveAttacks(world);
  assertEquals(target.status.damage, 17.0);
});

test("hit regions record ordinary contacts per target", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const firstTarget = createFighter(Character.rifleman, 100.0, -1);
  const secondTarget = createFighter(Character.rifleman, 50.0, -1);
  prepareHitRegionAttack(testWorld(attacker, firstTarget), attacker, AttackStyle.forwardTilt, 5);
  resolveAttacks(testWorld(attacker, firstTarget));
  attacker.launch.hitlag = 0;
  resolveAttacks(testWorld(attacker, secondTarget));
  assertEquals(firstTarget.status.damage, 10.0);
  assertEquals(secondTarget.status.damage, 7.0);
  attacker.launch.hitlag = 0;
  resolveAttacks(testWorld(attacker, firstTarget));
  assertEquals(firstTarget.status.damage, 10.0);
});

test("the up aerial explicitly rehits only on its finishing window", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(attacker, target);
  const input = controls();
  attacker.motion.z = 300.0;
  target.motion.z = 400.0;
  prepareHitRegionAttack(world, attacker, AttackStyle.upAir, 5);
  resolveAttacks(world);
  assertEquals(target.status.damage, 4.0);
  assertEquals(target.launch.hitlag, 4);
  for (let tick = 1; tick <= 3; tick++) {
    advanceFighter(world, 0, 0, input, -240.0);
    resolveAttacks(world);
    assertEquals(attacker.attack.frame, 5);
    assertEquals(target.status.damage, 4.0);
  }
  advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(attacker.attack.frame, 6);
  resolveAttacks(world);
  assertEquals(target.status.damage, 4.0);
  advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(attacker.attack.frame, 7);
  resolveAttacks(world);
  assertEquals(target.status.damage, 12.0);
  assertEquals(target.launch.hitlag, 5);
  // Finisher: 12 post-hit percent, 8 damage, 110 growth and 24 base.
  assertNear(target.launch.knockbackX, 2.433000087738037, 0.00009999999747378752);
  assertNear(target.launch.knockbackZ, 9.422967910766602, 0.00009999999747378752);
  attacker.launch.hitlag = 0;
  resolveAttacks(world);
  assertEquals(target.status.damage, 12.0);
  advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(attacker.attack.frame, 8);
  resolveAttacks(world);
  assertEquals(target.status.damage, 12.0);
});

test("a finisher can connect when the opening window misses", () => {
  const attacker = createFighter(Character.archer, 0.0, -1);
  const target = createFighter(Character.rifleman, 500.0, 1);
  const world = testWorld(attacker, target);
  attacker.motion.z = 300.0;
  target.motion.z = 400.0;
  prepareHitRegionAttack(world, attacker, AttackStyle.upAir, 5);
  resolveAttacks(world);
  assertEquals(target.status.damage, 0.0);
  target.motion.x = 0.0;
  attacker.attack.frame = 7;
  resolveAttacks(world);
  assertEquals(target.status.damage, 8.0);
  assertLessThan(target.launch.knockbackX, 0.0);
  assertGreaterThan(target.launch.knockbackZ, 0.0);
});

test("hit regions snapshot different effects before either trade cancels its attack", () => {
  for (const reverse of [false, true]) {
    const first = createFighter(Character.archer, 0.0, 1);
    const second = createFighter(Character.rifleman, 100.0, -1);
    testBeginAttacks(testWorld(first, second), AttackStyle.forwardTilt, AttackStyle.forwardTilt);
    first.attack.frame = 5;
    second.attack.frame = 6;
    resolveAttacks(reverse ? testWorld(second, first) : testWorld(first, second));
    assertEquals(first.status.damage, 8.0);
    assertEquals(second.status.damage, 10.0);
    assertEquals(first.launch.hitlag, 6);
    assertEquals(second.launch.hitlag, 6);
    assertLessThan(first.launch.knockbackX, 0.0);
    assertGreaterThan(second.launch.knockbackX, 0.0);
    assertEquals(first.attack.style, undefined);
    assertEquals(second.attack.style, undefined);
  }
});

test("a shield consumes the selected hit-region window and hitlag", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(attacker, target);
  target.shield.raised = true;
  prepareHitRegionAttack(world, attacker, AttackStyle.forwardTilt, 5);
  resolveAttacks(world);
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.shield.energy, 53.0);
  assertEquals(attacker.launch.hitlag, 6);
  attacker.launch.hitlag = 0;
  target.shield.raised = false;
  attacker.attack.frame = 6;
  resolveAttacks(world);
  assertEquals(target.status.damage, 0.0);
});

test("an empty landing recovers once, after four ticks", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    const input = controls();
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    fighter.motion.vz = -2.0;
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.landing.lag, 4);
    assertFalse(canAttack(fighter));
    for (let tick = 1; tick <= 3; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertEquals(fighter.landing.lag, 4 - tick);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(canAttack(fighter));
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.landing.lag, 0);
  }
});

test("a jump accepts the same landing recovery boundary as attacks", () => {
  for (let recovery = 4; recovery <= 18; recovery++) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    const input = controls();
    fighter.landing.lag = recovery;
    for (let tick = 1; tick <= recovery - 1; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      assertFalse(canAttack(fighter));
    }
    input.jumpPressed = true;
    input.jumpHeld = true;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.landing.lag, 0);
    assertEquals(fighter.jump.squat, jumpSquatFrames(Character.archer));
  }
});

test("a short hop rises less than a full hop, and each jump starts once", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    let fullHopRise = 0.0;
    for (let jumpKind = 0; jumpKind <= 2; jumpKind++) {
      const fighter = createFighter(character, 0.0, 1);
      if (jumpKind === 2) {
        fighter.motion.grounded = false;
        fighter.motion.z = 100.0;
        fighter.jump.remaining = 1;
      }
      const initialZ = fighter.motion.z;
      const input = controls({ jumpPressed: true, jumpHeld: jumpKind !== 1 });
      let apex = initialZ;
      for (let tick = 1; tick <= 80; tick++) {
        advanceSolo(fighter, 0, input, 0.0);
        input.jumpPressed = false;
        apex = max(apex, fighter.motion.z);
      }
      const rise = apex - initialZ;
      assertGreaterThan(rise, 0.0);
      if (jumpKind === 0) fullHopRise = rise;
      else if (jumpKind === 1) assertLessThan(rise, fullHopRise);
      assertEquals(fighter.jump.serial, 1);
    }
  }
});

function aerialLandingFighter(character: Character, style: AttackStyle): Fighter {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 300.0;
  testBeginAttacks(testWorld(fighter, createFighter(Character.rifleman, 500.0, -1)), style, undefined);
  return fighter;
}

function land(fighter: Fighter, input: Readonly<Controls>): void {
  fighter.motion.z = 1.0;
  fighter.motion.vz = -2.0;
  advanceSolo(fighter, 0, input, 0.0);
}

// Smashcraft omits L-cancelling (smashcraft:docs/gameplay-design.md): every
// aerial lands with the lag Melee's L-cancel gives, half its authored landing
// lag (PlCo +0x0E8 = 2), and no button changes it.
const SHORT_AERIAL_LANDING_LAG = [
  [AttackStyle.neutralAir, 5], [AttackStyle.forwardAir, 7], [AttackStyle.backAir, 8], [AttackStyle.upAir, 7], [AttackStyle.downAir, 9],
] as const;

test("every fighter's aerials land with the short lag, pressed shield or not", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    for (const [style, lag] of SHORT_AERIAL_LANDING_LAG) {
      for (const pressed of [false, true]) {
        const fighter = aerialLandingFighter(character, style);
        fighter.attack.frame = attackStartupFrames(style);
        land(fighter, controls(pressed ? { shieldPressed: true, airDodgePressed: true, techPressed: true } : {}));
        assertEquals(fighter.landing.lag, lag);
        assertEquals(fighter.attack.style, undefined);
        assertFalse(fighter.dodge.airDodging);
        const idle = controls();
        for (let tick = 1; tick <= lag - 1; tick++) {
          advanceSolo(fighter, 0, idle, 0.0);
          assertFalse(canAttack(fighter));
        }
        advanceSolo(fighter, 0, idle, 0.0);
        assertTrue(canAttack(fighter));
      }
    }
  }
});

test("air dodge and empty landings keep their own landing lag", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.dodge.airDodging = true;
  land(fighter, controls());
  assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
  respawnFighter(soloWorld(fighter), 0, 0.0);
  fighter.motion.grounded = false;
  land(fighter, controls());
  assertEquals(fighter.landing.lag, 4);
});

/** Starts a chargeable smash with the attack held through its startup. */
function prepareSmashCharge(world: Roster, fighter: Fighter, target: Fighter, input: Controls, style: AttackStyle): void {
  fighter.motion.surface = 0;
  target.motion.x = f32(fighter.motion.x + 100);
  input.attackHeld = true;
  testBeginAttacks(world, style, undefined, true, false);
  for (let tick = 1; tick <= attackStartupFrames(style); tick++) advanceFighter(world, 0, 0, input, -240.0);
}

test("smash charge pauses the pre-active clock, and release enters the hit frame", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(fighter, target);
  const input = controls();
  prepareSmashCharge(world, fighter, target, input, AttackStyle.upSmash);
  assertTrue(fighter.attack.smashCharging);
  assertEquals(fighter.attack.frame, attackStartupFrames(AttackStyle.upSmash) - 1);
  assertEquals(fighter.attack.smashChargeFrames, 1);
  const pausedCooldown = fighter.attack.cooldown;
  const pausedX = fighter.motion.x;
  input.direction = -1;
  input.attackHeld = false;
  advanceFighter(world, 0, 0, input, -240.0);
  assertFalse(fighter.attack.smashCharging);
  assertEquals(fighter.attack.smashChargeFrames, 1);
  assertEquals(fighter.attack.frame, attackStartupFrames(AttackStyle.upSmash));
  assertEquals(fighter.attack.cooldown, pausedCooldown - 1);
  assertEquals(fighter.motion.x, pausedX);
  resolveAttacks(world);
  assertNear(target.status.damage, f32(16 * smashDamageMultiplier(1)), 0.0010000000474974513);
});

test("smash charge caps at sixty ticks and scales to Melee's damage multiplier", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(fighter, target);
  const input = controls();
  prepareSmashCharge(world, fighter, target, input, AttackStyle.upSmash);
  for (let tick = 2; tick <= SMASH_MAX_CHARGE_FRAMES; tick++) advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(fighter.attack.smashChargeFrames, SMASH_MAX_CHARGE_FRAMES);
  assertTrue(fighter.attack.smashCharging);
  input.attackHeld = false;
  advanceFighter(world, 0, 0, input, -240.0);
  assertFalse(fighter.attack.smashCharging);
  assertEquals(fighter.attack.smashChargeFrames, SMASH_MAX_CHARGE_FRAMES);
  assertEquals(fighter.attack.frame, attackStartupFrames(AttackStyle.upSmash));
  resolveAttacks(world);
  assertNear(target.status.damage, f32(16 * SMASH_MAX_DAMAGE_MULTIPLIER), 0.0010000000474974513);
  assertEquals(smashDamageMultiplier(SMASH_MAX_CHARGE_FRAMES), SMASH_MAX_DAMAGE_MULTIPLIER);
});

test("a direct smash doesn't charge, and charge freezes only the fighter's control clock", () => {
  const direct = createFighter(Character.archer, 0.0, 1);
  const directTarget = createFighter(Character.rifleman, 100.0, -1);
  const directWorld = testWorld(direct, directTarget);
  const directInput = controls({ attackHeld: true });
  testBeginAttacks(directWorld, AttackStyle.forwardSmash, undefined);
  for (let tick = 1; tick <= attackStartupFrames(AttackStyle.forwardSmash); tick++) advanceFighter(directWorld, 0, 0, directInput, -240.0);
  assertFalse(direct.attack.smashCharging);
  assertEquals(direct.attack.frame, attackStartupFrames(AttackStyle.forwardSmash));
  resolveAttacks(directWorld);
  assertNear(directTarget.status.damage, 18.0, 0.0010000000474974513);
  const fighter = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(fighter, target);
  const input = controls();
  prepareSmashCharge(world, fighter, target, input, AttackStyle.downSmash);
  const { frame: attackFrame, cooldown } = fighter.attack;
  const { x } = fighter.motion;
  fighter.status.invincible = 10;
  fighter.motion.dropTime = 10;
  fighter.launch.hitlag = 3;
  for (let tick = 1; tick <= 2; tick++) advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(fighter.attack.smashChargeFrames, 1);
  assertEquals(fighter.attack.frame, attackFrame);
  assertEquals(fighter.attack.cooldown, cooldown);
  advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(fighter.attack.smashChargeFrames, 2);
  assertEquals(fighter.attack.frame, attackFrame);
  assertEquals(fighter.attack.cooldown, cooldown);
  assertEquals(fighter.status.invincible, 9);
  assertEquals(fighter.motion.dropTime, 9);
  assertEquals(fighter.motion.x, x);
});

test("smash charge stops when the fighter leaves the ground and clears on interruption or stock loss", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const input = controls();
  prepareSmashCharge(testWorld(fighter, target), fighter, target, input, AttackStyle.upSmash);
  fighter.motion.grounded = false;
  advanceFighter(testWorld(fighter, target), 0, 0, input, -240.0);
  assertFalse(fighter.attack.smashCharging);
  assertFalse(fighter.attack.smashChargeAllowed);
  assertEquals(fighter.attack.frame, attackStartupFrames(AttackStyle.upSmash));
  const attacker = createFighter(Character.rifleman, 100.0, -1);
  attacker.attack.style = AttackStyle.jab;
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(testWorld(fighter, attacker));
  assertEquals(fighter.attack.style, undefined);
  assertEquals(fighter.attack.smashChargeFrames, 0);
  const stockFighter = createFighter(Character.archer, 0.0, 1);
  const stockTarget = createFighter(Character.rifleman, 100.0, -1);
  const stockWorld = testWorld(stockFighter, stockTarget);
  const stockInput = controls();
  prepareSmashCharge(stockWorld, stockFighter, stockTarget, stockInput, AttackStyle.upSmash);
  stockFighter.motion.x = (stageBounds(0).blast.right + 0.0009765625);
  stockInput.attackHeld = false;
  advanceFighter(stockWorld, 0, 0, stockInput, -240.0);
  assertTrue(stockFighter.status.out);
  assertFalse(stockFighter.attack.smashCharging);
  assertEquals(stockFighter.attack.smashChargeFrames, 0);
});

test("a simultaneous charged smash trade snapshots both charge amounts", () => {
  const first = createFighter(Character.archer, 0.0, 1);
  const second = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(first, second);
  first.motion.surface = 0;
  second.motion.surface = 0;
  const firstInput = controls({ attackHeld: true });
  const secondInput = controls({ attackHeld: true });
  testBeginAttacks(world, AttackStyle.upSmash, AttackStyle.upSmash, true, true);
  const step = () => {
    advanceFighter(world, 0, 0, firstInput, -240.0);
    advanceFighter(world, 1, 0, secondInput, 240.0);
  };
  for (let tick = 1; tick <= attackStartupFrames(AttackStyle.upSmash); tick++) step();
  for (let tick = 2; tick <= SMASH_MAX_CHARGE_FRAMES; tick++) step();
  assertEquals(first.attack.smashChargeFrames, SMASH_MAX_CHARGE_FRAMES);
  assertEquals(second.attack.smashChargeFrames, SMASH_MAX_CHARGE_FRAMES);
  firstInput.attackHeld = false;
  secondInput.attackHeld = false;
  step();
  resolveAttacks(world);
  assertNear(first.status.damage, f32(16 * SMASH_MAX_DAMAGE_MULTIPLIER), 0.0010000000474974513);
  assertNear(second.status.damage, f32(16 * SMASH_MAX_DAMAGE_MULTIPLIER), 0.0010000000474974513);
});

test("jump events follow the takeoff and an accepted air jump", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    const world = soloWorld(fighter);
    const input = controls({ jumpPressed: true, jumpHeld: true });
    advanceFighter(world, 0, 0, input, 0.0);
    assertEquals(fighter.jump.serial, 0);
    input.jumpPressed = false;
    for (let frame = 2; frame <= jumpSquatFrames(character); frame++) {
      advanceFighter(world, 0, 0, input, 0.0);
      assertEquals(fighter.jump.serial, 0);
    }
    advanceFighter(world, 0, 0, input, 0.0);
    assertEquals(fighter.jump.serial, 1);
    assertFalse(fighter.jump.isDouble);
    assertFalse(fighter.motion.grounded);
    advanceFighter(world, 0, 0, input, 0.0);
    assertEquals(fighter.jump.serial, 1);
    input.jumpPressed = true;
    advanceFighter(world, 0, 0, input, 0.0);
    assertEquals(fighter.jump.serial, 2);
    assertTrue(fighter.jump.isDouble);
    advanceFighter(world, 0, 0, input, 0.0);
    assertEquals(fighter.jump.serial, 2);
    respawnFighter(world, 0, 0.0);
    assertEquals(fighter.jump.serial, 0);
    assertFalse(fighter.jump.isDouble);
  }
});

test("a blocked jump doesn't produce a takeoff event", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.launch.hitstun = 10;
  advanceSolo(fighter, 0, controls({ jumpPressed: true, jumpHeld: true }), 0.0);
  assertEquals(fighter.jump.serial, 0);
  assertEquals(fighter.jump.remaining, 2);
  assertTrue(fighter.motion.grounded);
});

const GROUND_STYLES = [
  AttackStyle.jab, AttackStyle.shot, AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.forwardSmash, AttackStyle.grab,
  AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown,
] as const;

test("every ground action exposes startup, active and recovery frames", () => {
  for (const style of GROUND_STYLES) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    const world = testWorld(fighter, createFighter(Character.rifleman, 400.0, -1));
    const input = controls();
    testBeginAttacks(world, style, undefined);
    assertEquals(fighter.attack.serial, 1);
    assertEquals(fighter.attack.frame, 0);
    assertEquals(attackPhase(fighter), AttackPhase.startup);
    for (let frame = 1; frame <= attackStartupFrames(style) - 1; frame++) {
      advanceFighter(world, 0, 0, input, -240.0);
      assertEquals(attackPhase(fighter), AttackPhase.startup);
    }
    advanceFighter(world, 0, 0, input, -240.0);
    assertEquals(attackPhase(fighter), AttackPhase.active);
    for (let frame = 1; frame <= attackActiveFrames(style) - 1; frame++) {
      advanceFighter(world, 0, 0, input, -240.0);
      assertEquals(attackPhase(fighter), AttackPhase.active);
    }
    advanceFighter(world, 0, 0, input, -240.0);
    assertEquals(attackPhase(fighter), AttackPhase.recovery);
    for (let frame = 1; frame <= fighter.attack.duration - attackStartupFrames(style) - attackActiveFrames(style); frame++) {
      advanceFighter(world, 0, 0, input, -240.0);
    }
    assertEquals(attackPhase(fighter), AttackPhase.none);
    assertEquals(fighter.attack.cooldown, 0);
    assertTrue(canAttack(fighter));
    testBeginAttacks(world, style, undefined);
    assertEquals(fighter.attack.serial, 2);
    assertEquals(attackPhase(fighter), AttackPhase.startup);
  }
});

test("recovery frames can't deal damage", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(attacker, target);
  const input = controls();
  testBeginAttacks(world, AttackStyle.jab, undefined);
  for (let frame = 1; frame <= attackStartupFrames(AttackStyle.jab) + attackActiveFrames(AttackStyle.jab); frame++) advanceFighter(world, 0, 0, input, -240.0);
  assertEquals(attackPhase(attacker), AttackPhase.recovery);
  for (let frame = 0; frame <= 5; frame++) resolveAttacks(world);
  assertEquals(target.status.damage, 0.0);
});
