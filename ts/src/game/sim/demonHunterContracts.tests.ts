import { mutableProjectile } from "./fighterProjectiles";
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, HeroStatusKind, LedgeState, SpecialAction } from "./codes";
import { DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_MANA_BURN_STARTUP, FLAME_CRASH_HANG_LAST, immolationRegion, startFighterSpecial, advanceSpecials } from "./specials";
import { type Fighter, type Projectile, createFighter } from "./fighter";
import { beginFighterAttack } from "./attacks";
import { updateProjectiles } from "./projectiles";
import { f32 } from "wisp/src/sim/f32";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { respawnFighter } from "./stocks";
import { type Roster, createRoster } from "./roster";
import { canAttack } from "./conditions";
import { resolveLedges } from "./ledge";
import { cancelSpecialState } from "./transitions";

test("simultaneousImmolatesTradeInEitherSlotOrder [invariant]", () => {
  for (const airborne of [false, true]) for (const reversed of [false, true]) {
    const left = createFighter(Character.demonHunter, 0.0, 1);
    const right = createFighter(Character.demonHunter, 60.0, -1);
    if (airborne) {
      left.motion.grounded = false;
      right.motion.grounded = false;
      left.motion.z = 400.0;
      right.motion.z = 400.0;
    }
    assertTrue(startFighterSpecial(left, 0, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
    assertTrue(startFighterSpecial(right, 0, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
    const world = reversed ? testWorld(right, left) : testWorld(left, right);

    for (let tick = 1; tick <= (airborne ? FLAME_CRASH_HANG_LAST + 1 : DEMONHUNTER_IMMOLATE_STARTUP); tick++) advanceSpecials(world, 0, 0);
    const damage = immolationRegion(!airborne).effect.damage;
    assertEquals(left.status.damage, damage);
    assertEquals(right.status.damage, damage);
    assertGreaterThan(left.launch.hitstun, 0);
    assertGreaterThan(right.launch.hitstun, 0);
  }
});

test("wingAscentConsumesJumpsAndEndsInHelplessFallAfterInterruptionRules [spec docs/physics.md]", () => {
  for (const character of [Character.demonHunter, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    const target = createFighter(character === Character.rifleman ? Character.rifleman : Character.rifleman, 500.0, -1);
    fighter.motion.grounded = false;
    fighter.motion.z = 500.0;
    fighter.jump.remaining = 1;
    assertTrue(startFighterSpecial(fighter, 0, 0, controls({ specialPressed: true, verticalDirection: 1, specialZ: 1 })));
    assertEquals(fighter.jump.remaining, 0);
    for (let frame = 1; frame <= 40; frame++) {
      fighter.attack.cooldown = Math.max(0, fighter.attack.cooldown - 1);
      fighter.special.lockFrames = Math.max(0, fighter.special.lockFrames - 1);
      advanceSpecials(testWorld(fighter, target), 0, 0);
    }
    assertEquals(fighter.special.action, SpecialAction.none);
    assertTrue(fighter.special.fall);
    assertEquals(fighter.jump.remaining, 0);
    assertFalse(canAttack(fighter));
    const airInput = controls({ jumpPressed: true, airDodgePressed: true, dodgeX: 1, direction: 1, specialX: 1 });
    advanceSolo(fighter, 0, airInput, 0.0);
    assertTrue(fighter.special.fall);
    assertEquals(fighter.jump.squat, 0);
    assertFalse(fighter.dodge.airDodging);
    assertEquals(fighter.jump.remaining, 0);
    beginFighterAttack(testWorld(fighter, target), 0, AttackStyle.neutralAir, false);
    assertEquals(fighter.attack.style, undefined);
    assertFalse(startFighterSpecial(fighter, 0, 0, controls({ specialPressed: true })));
    fighter.launch.hitstun = 2;
    cancelSpecialState(fighter);
    assertFalse(fighter.special.fall);
    const jumpInput = controls({ jumpPressed: true });
    for (let tick = 1; tick <= 3; tick++) advanceSolo(fighter, 0, jumpInput, 0.0);
    assertFalse(fighter.special.fall);
    assertEquals(fighter.jump.remaining, 0);
    assertTrue(canAttack(fighter));

    const landing = createFighter(character, 0.0, 1);
    landing.motion.grounded = false;
    landing.motion.z = 1.0;
    landing.motion.vz = -2.0;
    landing.jump.remaining = 0;
    landing.special.fall = true;
    for (let tick = 1; tick <= 5; tick++) advanceSolo(landing, 0, controls(), 0.0);
    assertTrue(landing.motion.grounded);
    assertFalse(landing.special.fall);
    assertEquals(landing.jump.remaining, 2);

    const ledge = createFighter(character, 620.0, -1);
    const other = createFighter(character === Character.rifleman ? Character.rifleman : Character.rifleman, 0.0, 1);
    ledge.motion.grounded = false;
    ledge.motion.z = -80.0;
    ledge.motion.vz = -2.0;
    ledge.motion.deltaZ = -2.0;
    ledge.special.fall = true;
    ledge.jump.remaining = 0;
    const ledgeWorld = testWorld(ledge, other);
    resolveLedges(ledgeWorld, 0, [controls(), controls(), controls(), controls()]);
    assertEquals(ledge.ledge.state, LedgeState.hang);
    assertFalse(ledge.special.fall);
    landing.special.fall = true;
    respawnFighter(createRoster(1, [landing]), 0, 0.0);
    assertFalse(landing.special.fall);
  }
});

function castOrb(illidan: Fighter, world: Roster): Projectile {
  assertTrue(startFighterSpecial(illidan, 0, 0, controls({ specialPressed: true })));
  for (let tick = 1; tick <= DEMONHUNTER_MANA_BURN_STARTUP; tick++) advanceSpecials(world, 0, 0);
  return mutableProjectile(illidan, 0)!;
}

test("aFullJumpClearsManaBurnWhereStandingStillIsHit [spec #116]", () => {
  for (const jumps of [false, true]) {
    const illidan = createFighter(Character.demonHunter, 0.0, 1);
    const target = createFighter(Character.rifleman, 600.0, -1);
    const world = testWorld(illidan, target);
    const orb = castOrb(illidan, world);
    let pressed = false;
    for (let tick = 0; tick < 90 && target.status.damage === 0.0; tick++) {
      const press = jumps && !pressed && f32(target.motion.x - orb.x) <= 150.0;
      if (press) pressed = true;
      advanceSolo(target, 0, controls({ jumpPressed: press, jumpHeld: jumps }), 600.0);
      updateProjectiles(world);
    }
    if (jumps) {
      assertEquals(target.status.damage, 0.0);
      assertGreaterThan(orb.x, target.motion.x);
    } else assertEquals(target.status.condition, HeroStatusKind.stun);
  }
});

