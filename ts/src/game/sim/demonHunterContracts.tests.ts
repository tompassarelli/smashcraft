import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "../../runtime/testing";
import { AttackStyle, Character, LedgeState, ProjectileKind, SpecialAction } from "./codes";
import { DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_MANA_BURN_STARTUP, DEMONHUNTER_WING_DURATION, startFighterSpecial, advanceSpecials } from "./specials";
import { DEMONHUNTER_PARRY_START } from "./hits";
import { createFighter } from "./fighter";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { projectileCount, updateProjectiles } from "./projectiles";
import { attackDurationFramesForGrounding, attackStartupFrames } from "./moves";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { simulationJump } from "./jumpsAndDodges";
import { reset } from "./stocks";
import { createRoster } from "./roster";
import { canAttack } from "./conditions";
import { resolveLedges } from "./ledge";
import { cancelSpecialState } from "./transitions";

test("demonHunterGroundInputsCanHitStandingOpponents", () => {
  for (const facing of [-1, 1]) for (let variant = 0; variant <= 8; variant++) {
    const walking = variant >= 4;
    const horizontal = variant === 3 || variant === 4 || variant >= 7 ? facing : 0;
    const vertical = variant === 1 || variant === 5 || variant === 7 ? 1 : variant === 2 || variant === 6 || variant === 8 ? -1 : 0;
    const style = walking
      ? vertical > 0 ? AttackStyle.upTilt : vertical < 0 ? AttackStyle.downTilt : AttackStyle.forwardTilt
      : vertical > 0 ? AttackStyle.upSmash : vertical < 0 ? AttackStyle.downSmash : horizontal !== 0 ? AttackStyle.forwardSmash : AttackStyle.jab;
    const attacker = createFighter(Character.demonHunter, 0.0, facing);
    const target = createFighter(Character.archer, facing * 60.0, -facing);
    if (style === AttackStyle.upSmash || style === AttackStyle.upTilt) target.motion.z = 65.0;
    if (style === AttackStyle.downSmash || style === AttackStyle.downTilt) target.motion.z = -65.0;
    const world = testWorld(attacker, target);
    beginFighterAttack(world, 0, style, false);
    attacker.attack.frame = attackStartupFrames(style);
    resolveAttacks(world);
    assertGreaterThan(target.status.damage, 0.0);
  }
});

test("demonHunterSharesGrabGetupAndLedgeContactRules", () => {
  for (const facing of [-1, 1]) for (const action of [0, 1, 2]) {
    const style = action === 0 ? AttackStyle.grab : action === 1 ? AttackStyle.getupAttack : AttackStyle.ledgeAttack;
    const attacker = createFighter(Character.demonHunter, 0.0, facing);
    const target = createFighter(Character.archer, facing * 60.0, -facing);
    const world = testWorld(attacker, target);
    attacker.attack.style = style;
    attacker.attack.frame = attackStartupFrames(style);
    attacker.attack.duration = attackDurationFramesForGrounding(style, true);
    resolveAttacks(world);
    if (action === 0) {
      assertEquals(attacker.grab.target, 1);
      assertEquals(target.grab.owner, 0);
    } else assertGreaterThan(target.status.damage, 0.0);
    reset(world, 0, 0.0);
  }
});

test("simultaneousImmolatesTradeInEitherSlotOrder", () => {
  for (const airborne of [false, true]) for (const reversed of [false, true]) {
    const left = createFighter(Character.demonHunter, 0.0, 1);
    const right = createFighter(Character.demonHunter, 60.0, -1);
    if (airborne) {
      left.motion.grounded = false;
      right.motion.grounded = false;
      left.motion.z = 400.0;
      right.motion.z = 400.0;
    }
    assertTrue(startFighterSpecial(left, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
    assertTrue(startFighterSpecial(right, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
    const world = reversed ? testWorld(right, left) : testWorld(left, right);
    for (let tick = 1; tick <= DEMONHUNTER_IMMOLATE_STARTUP; tick++) advanceSpecials(world, 0);
    const damage = airborne ? 9.0 : 7.0;
    assertEquals(left.status.damage, damage);
    assertEquals(right.status.damage, damage);
    assertGreaterThan(left.launch.hitstun, 0);
    assertGreaterThan(right.launch.hitstun, 0);
  }
});

test("immolateGroundShineMirrorsAndHitsOneTargetOnce", () => {
  for (const facing of [-1, 1]) {
    const illidan = createFighter(Character.demonHunter, 0.0, facing);
    const target = createFighter(Character.archer, facing * 70.0, -facing);
    const world = testWorld(illidan, target);
    assertTrue(startFighterSpecial(illidan, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
    assertEquals(illidan.special.action, SpecialAction.demonHunterImmolate);
    for (let tick = 1; tick <= DEMONHUNTER_IMMOLATE_STARTUP; tick++) advanceSpecials(world, 0);
    assertEquals(target.status.damage, 7.0);
    assertGreaterThan(target.launch.knockbackX * facing, 0.0);
    assertEquals(target.launch.knockbackZ, 0.0);
    const damage = target.status.damage;
    for (let tick = 1; tick <= 3; tick++) advanceSpecials(world, 0);
    assertEquals(target.status.damage, damage);
  }
});

test("immolateAirSpecialSpikesAndUsesSingleContact", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, -1);
  const target = createFighter(Character.rifleman, 0.0, 1);
  illidan.motion.grounded = false;
  illidan.motion.z = 400.0;
  target.motion.grounded = false;
  target.motion.z = 400.0;
  const world = testWorld(illidan, target);
  assertTrue(startFighterSpecial(illidan, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
  for (let tick = 1; tick <= DEMONHUNTER_IMMOLATE_STARTUP; tick++) advanceSpecials(world, 0);
  assertEquals(target.status.damage, 9.0);
  assertLessThan(target.launch.knockbackX, 0.0);
  assertLessThan(target.launch.knockbackZ, 0.0);
  const hitlag = target.launch.hitlag;
  illidan.launch.hitlag = 0;
  advanceSpecials(world, 0);
  assertEquals(target.status.damage, 9.0);
  assertEquals(target.launch.hitlag, hitlag);
});

test("manaBurnCreatesFlinchingProjectileWithoutAManaResource", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(Character.archer, 500.0, -1);
  const world = testWorld(illidan, target);
  assertTrue(startFighterSpecial(illidan, 0, controls({ specialPressed: true })));
  assertEquals(illidan.special.action, SpecialAction.demonHunterManaBurn);
  for (let tick = 1; tick <= DEMONHUNTER_MANA_BURN_STARTUP; tick++) advanceSpecials(world, 0);
  assertEquals(projectileCount(illidan), 1);
  assertEquals(illidan.projectiles[0]!.kind, ProjectileKind.manaBurn);
  target.motion.x = illidan.projectiles[0]!.x + 20.0;
  updateProjectiles(world);
  assertEquals(target.status.damage, 5.0);
  assertGreaterThan(target.launch.hitstun, 0);
  assertGreaterThan(target.launch.hitlag, 0);
});

test("parryStepPunishesContactInItsWindowButDoesNotReflectShots", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const illidan = createFighter(Character.demonHunter, 90.0, -1);
  const world = testWorld(illidan, attacker);
  assertTrue(startFighterSpecial(illidan, 0, controls({ specialPressed: true, direction: -1, specialX: -1 })));
  for (let tick = 1; tick <= DEMONHUNTER_PARRY_START; tick++) advanceSpecials(world, 0);
  beginFighterAttack(world, 1, AttackStyle.jab, false);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  assertEquals(attacker.launch.hitstun, 10);
  assertEquals(attacker.launch.hitlag, 4);
  assertEquals(attacker.attack.style, undefined);
  assertEquals(illidan.status.damage, 0.0);

  const shooter = createFighter(Character.archer, 0.0, 1);
  const parrier = createFighter(Character.demonHunter, 160.0, -1);
  const shotWorld = testWorld(parrier, shooter);
  assertTrue(startFighterSpecial(shooter, 0, controls({ specialPressed: true })));
  assertTrue(startFighterSpecial(parrier, 0, controls({ specialPressed: true, direction: -1, specialX: -1 })));
  for (let tick = 1; tick <= DEMONHUNTER_PARRY_START; tick++) {
    advanceSpecials(shotWorld, 0);
    updateProjectiles(shotWorld);
  }
  assertEquals(projectileCount(shooter), 0);
  assertEquals(projectileCount(parrier), 0);
  assertEquals(parrier.status.damage, 0.0);
});

test("wingAscentConsumesJumpsAndEndsInHelplessFallAfterInterruptionRules", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    const target = createFighter(character === Character.archer ? Character.rifleman : Character.archer, 500.0, -1);
    fighter.motion.grounded = false;
    fighter.motion.z = 500.0;
    fighter.jump.remaining = 1;
    assertTrue(startFighterSpecial(fighter, 0, controls({ specialPressed: true, verticalDirection: 1, specialZ: 1 })));
    assertEquals(fighter.jump.remaining, 0);
    for (let frame = 1; frame <= 38; frame++) {
      fighter.attack.cooldown = Math.max(0, fighter.attack.cooldown - 1);
      fighter.special.lockFrames = Math.max(0, fighter.special.lockFrames - 1);
      advanceSpecials(testWorld(fighter, target), 0);
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
    assertFalse(startFighterSpecial(fighter, 0, controls({ specialPressed: true })));
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
    const other = createFighter(character === Character.archer ? Character.rifleman : Character.archer, 0.0, 1);
    ledge.motion.grounded = false;
    ledge.motion.z = -30.0;
    ledge.motion.vz = -2.0;
    ledge.special.fall = true;
    ledge.jump.remaining = 0;
    const ledgeWorld = testWorld(ledge, other);
    resolveLedges(ledgeWorld, 0, [controls(), controls(), controls(), controls()]);
    assertEquals(ledge.ledge.state, LedgeState.hang);
    assertFalse(ledge.special.fall);
    landing.special.fall = true;
    reset(createRoster(1, [landing]), 0, 0.0);
    assertFalse(landing.special.fall);
  }
});

test("demonHunterTapDuringDashUsesItsOwnDashAttackAction", () => {
  for (const facing of [-1, 1]) {
    const illidan = createFighter(Character.demonHunter, 0.0, facing);
    const target = createFighter(Character.archer, facing * 70.0, -facing);
    const world = testWorld(illidan, target);
    illidan.ground.dashFrame = 1;
    illidan.ground.dashDirection = facing;
    beginFighterAttack(world, 0, AttackStyle.jab, false);
    assertEquals(illidan.attack.style, AttackStyle.demonHunterDashAttack);
    illidan.attack.frame = attackStartupFrames(AttackStyle.demonHunterDashAttack);
    resolveAttacks(world);
    assertEquals(target.status.damage, 9.0);
  }
});

test("demonHunterNormalActionsHaveContactInBothFacingsAndGroundAirSets", () => {
  const aerialStyles = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir];
  for (const facing of [-1, 1]) for (const aerial of [false, true]) {
    const count = aerial ? 5 : 9;
    for (let index = 0; index < count; index++) {
      const groundStyle = (index === 0 ? AttackStyle.jab : index < 4 ? index + 1 : index + 2) as AttackStyle;
      const style = aerial ? aerialStyles[index]! : groundStyle;
      const attacker = createFighter(Character.demonHunter, 0.0, facing);
      const targetX = style === AttackStyle.backAir ? -facing * 60.0 : facing * 60.0;
      const target = createFighter(Character.archer, targetX, -facing);
      if (aerial) attacker.motion.grounded = false;
      if (style === AttackStyle.upAir || style === AttackStyle.upSmash || style === AttackStyle.upTilt || style === AttackStyle.forwardTiltUp) target.motion.z = 65.0;
      if (style === AttackStyle.downAir || style === AttackStyle.downSmash || style === AttackStyle.downTilt || style === AttackStyle.forwardTiltDown) target.motion.z = -65.0;
      const world = testWorld(attacker, target);
      beginFighterAttack(world, 0, style, false);
      attacker.attack.frame = attackStartupFrames(style);
      attacker.attack.cooldown = attacker.attack.duration - attacker.attack.frame;
      resolveAttacks(world);
      assertGreaterThan(target.status.damage, 0.0);
    }
  }
});

test("hitInterruptsIllidanSpecialAndStockResetClearsSpecialState", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const attacker = createFighter(Character.archer, 500.0, -1);
  const world = testWorld(illidan, attacker);
  assertTrue(startFighterSpecial(illidan, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
  for (let tick = 1; tick < DEMONHUNTER_IMMOLATE_STARTUP; tick++) advanceSpecials(world, 0);
  attacker.motion.x = 60.0;
  const hitWorld = testWorld(attacker, illidan);
  beginFighterAttack(hitWorld, 0, AttackStyle.jab, false);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(hitWorld);
  assertGreaterThan(illidan.launch.hitstun, 0);
  assertEquals(illidan.special.action, SpecialAction.none);
  assertFalse(illidan.special.hit);
  assertGreaterThan(illidan.special.cooldowns[SpecialAction.demonHunterImmolate]!, 0);
  reset(createRoster(1, [illidan]), 0, 0.0);
  assertEquals(illidan.special.action, SpecialAction.none);
  assertEquals(illidan.special.frame, 0);
  assertFalse(illidan.special.fall);
  assertEquals(illidan.special.cooldowns[SpecialAction.demonHunterImmolate], 0);
});
