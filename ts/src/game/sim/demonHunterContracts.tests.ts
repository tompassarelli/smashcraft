import { mutableProjectile } from "./fighterProjectiles";
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, HeroStatusGroup, HeroStatusKind, LedgeState, ProjectileKind, SpecialAction } from "./codes";
import { DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_MANA_BURN_LIFETIME, DEMONHUNTER_MANA_BURN_RECOVERY, DEMONHUNTER_MANA_BURN_SPEED, DEMONHUNTER_MANA_BURN_STARTUP, DEMONHUNTER_WING_DURATION, FLAME_CRASH_FORM, FLAME_CRASH_HANG_LAST, flameCrashRegion, immolationRegion, startFighterSpecial, advanceSpecials } from "./specials";
import { type Fighter, type Projectile, createFighter } from "./fighter";
import { beginFighterAttack } from "./attacks";
import { MANA_BURN_STUN, projectileCount, updateProjectiles } from "./projectiles";
import { heroStatusFrames, maskHeroStatusControls } from "./heroStatus";
import { SHIELD_REFLECTOR_ACTIVE_FRAMES } from "./shield";
import { attackBuffer } from "../input/attackBuffer";
import { f32 } from "wisp/src/sim/f32";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { beginJump } from "./jumpsAndDodges";
import { respawnFighter } from "./stocks";
import { type Roster, createRoster } from "./roster";
import { canAttack } from "./conditions";
import { resolveLedges } from "./ledge";
import { cancelSpecialState } from "./transitions";
import { comboScene } from "../match/comboRoute";
import { fighter, frameMasks } from "../match/padScene";
import { Action, bit } from "../input/actions";

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

test("flameCrashPlungeSpikesAndUsesSingleContact [spec docs/design/illidan.md]", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, -1);
  const target = createFighter(Character.rifleman, 0.0, 1);
  illidan.motion.grounded = false;
  illidan.motion.z = 400.0;
  target.motion.grounded = false;
  target.motion.z = 400.0;
  const world = testWorld(illidan, target);
  assertTrue(startFighterSpecial(illidan, 0, 0, controls({ specialPressed: true, down: true, specialZ: -1 })));
  for (let tick = 1; tick <= FLAME_CRASH_HANG_LAST + 1; tick++) advanceSpecials(world, 0, 0);
  assertEquals(target.status.damage, flameCrashRegion(FLAME_CRASH_FORM, FLAME_CRASH_HANG_LAST + 1).effect.damage);
  assertLessThan(target.launch.knockbackX, 0.0);
  assertLessThan(target.launch.knockbackZ, 0.0);
  const hitlag = target.launch.hitlag;
  illidan.launch.hitlag = 0;
  advanceSpecials(world, 0, 0);
  assertEquals(target.status.damage, flameCrashRegion(FLAME_CRASH_FORM, FLAME_CRASH_HANG_LAST + 1).effect.damage);
  assertEquals(target.launch.hitlag, hitlag);
});

test("manaBurnCreatesFlinchingProjectileWithoutAManaResource [spec #116]", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(Character.rifleman, 500.0, -1);
  const world = testWorld(illidan, target);
  assertTrue(startFighterSpecial(illidan, 0, 0, controls({ specialPressed: true })));
  assertEquals(illidan.special.action, SpecialAction.demonHunterManaBurn);
  for (let tick = 1; tick <= DEMONHUNTER_MANA_BURN_STARTUP; tick++) advanceSpecials(world, 0, 0);
  assertEquals(projectileCount(illidan), 1);
  assertEquals(mutableProjectile(illidan, 0)!.kind, ProjectileKind.manaBurn);
  target.motion.x = mutableProjectile(illidan, 0)!.x + 20.0;
  updateProjectiles(world);
  assertEquals(target.status.damage, 5.0);
  assertGreaterThan(target.launch.hitstun, 0);
  assertGreaterThan(target.launch.hitlag, 0);
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


function orbHit(target: Fighter, world: Roster, orb: Readonly<Projectile>): void {
  target.motion.x = f32(orb.x + 20.0);
  updateProjectiles(world);
}

test("manaBurnCastsASlowOrbOnFrame16RecoversOnFrame46AndKeepsOneOut [spec #116]", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(Character.rifleman, 5000.0, -1);
  const world = testWorld(illidan, target);
  assertTrue(startFighterSpecial(illidan, 0, 0, controls({ specialPressed: true })));
  for (let tick = 1; tick < DEMONHUNTER_MANA_BURN_STARTUP; tick++) {
    advanceSpecials(world, 0, 0);
    assertEquals(projectileCount(illidan), 0);
  }
  advanceSpecials(world, 0, 0);
  assertEquals(projectileCount(illidan), 1);
  const orb = mutableProjectile(illidan, 0)!;
  assertEquals(orb.velocityX, DEMONHUNTER_MANA_BURN_SPEED);
  assertEquals(orb.life, DEMONHUNTER_MANA_BURN_LIFETIME);
  for (let tick = DEMONHUNTER_MANA_BURN_STARTUP + 1; tick < DEMONHUNTER_MANA_BURN_STARTUP + DEMONHUNTER_MANA_BURN_RECOVERY; tick++) advanceSpecials(world, 0, 0);
  assertEquals(illidan.special.action, SpecialAction.demonHunterManaBurn);
  advanceSpecials(world, 0, 0);
  assertEquals(illidan.special.action, SpecialAction.none);
  illidan.attack.cooldown = 0;
  illidan.special.lockFrames = 0;
  illidan.special.cooldowns[SpecialAction.demonHunterManaBurn] = 0;
  assertFalse(startFighterSpecial(illidan, 0, 0, controls({ specialPressed: true })));
  const startX = orb.x;
  for (let tick = 1; tick < DEMONHUNTER_MANA_BURN_LIFETIME; tick++) updateProjectiles(world);
  assertEquals(orb.x, f32(startX + DEMONHUNTER_MANA_BURN_SPEED * (DEMONHUNTER_MANA_BURN_LIFETIME - 1)));
  assertEquals(projectileCount(illidan), 1);
  updateProjectiles(world);
  assertEquals(projectileCount(illidan), 0);
  assertTrue(startFighterSpecial(illidan, 0, 0, controls({ specialPressed: true })));
});

test("manaBurnBurns25ManaAndStunsWithoutKnockbackLongerTheEmptierItLeavesTheTarget [spec docs/design/mana.md]", () => {
  assertEquals(heroStatusFrames(MANA_BURN_STUN, 100), 15);
  assertEquals(heroStatusFrames(MANA_BURN_STUN, 0), 60);

  for (const [before, after, frames] of [[100, 75, 26], [50, 27, 47], [25, 2, 59], [0, 0, 60]] as const) {
    const illidan = createFighter(Character.demonHunter, 0.0, 1);
    const target = createFighter(Character.rifleman, 5000.0, -1);
    const world = testWorld(illidan, target);
    target.mana.points = before;
    target.status.damage = 40.0;
    orbHit(target, world, castOrb(illidan, world));
    assertEquals(target.status.damage, 45.0);
    assertEquals(target.mana.points, after);
    assertEquals(target.status.condition, HeroStatusKind.stun);
    assertEquals(target.status.conditionFrames, frames);
    assertEquals(target.launch.knockbackX, 0.0);
    assertEquals(target.launch.knockbackZ, 0.0);
  }
});

test("manaBurnStunIgnoresInputEndsOnTheNextHitAndCannotChain [spec #116]", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(Character.rifleman, 5000.0, -1);
  const world = testWorld(illidan, target);
  target.status.damage = 95.0;
  orbHit(target, world, castOrb(illidan, world));
  assertEquals(target.status.condition, HeroStatusKind.stun);
  const input = controls({ specialPressed: true, jumpPressed: true, jumpHeld: true, shield: true, shieldPressed: true, attackPressed: true, direction: 1 });
  const commands = attackBuffer(6);
  maskHeroStatusControls(target, input, commands);
  for (const pressed of [input.specialPressed, input.jumpPressed, input.jumpHeld, input.shield, input.shieldPressed, input.attackPressed]) assertFalse(pressed);
  assertEquals(input.direction, 0);

  mutableProjectile(illidan, 0)!.life = 0;
  cancelSpecialState(illidan);
  illidan.attack.cooldown = 0;
  illidan.special.lockFrames = 0;
  illidan.special.cooldowns[SpecialAction.demonHunterManaBurn] = 0;
  orbHit(target, world, castOrb(illidan, world));
  assertEquals(target.status.damage, 105.0);
  assertEquals(target.status.condition, HeroStatusKind.none);
  assertEquals(target.status.conditionImmunity[HeroStatusGroup.sleep], 300);
});

test("aHeldShieldBlocksManaBurnsStun [spec #116]", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(Character.rifleman, 5000.0, -1);
  const world = testWorld(illidan, target);
  target.shield.raised = true;
  orbHit(target, world, castOrb(illidan, world));
  assertEquals(projectileCount(illidan), 0);
  assertEquals(target.status.condition, HeroStatusKind.none);
});

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

test("aPowershieldReflectsManaBurnAndTheOrbStunsIllidan [spec #116]", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const defender = createFighter(Character.rifleman, 5000.0, -1);
  const world = testWorld(illidan, defender);
  const orb = castOrb(illidan, world);

  defender.motion.x = f32(orb.x + 120.0);
  defender.shield.raised = true;
  for (let tick = 0; tick < 20 && projectileCount(illidan) > 0; tick++) {
    defender.shield.reflectFrames = SHIELD_REFLECTOR_ACTIVE_FRAMES;
    updateProjectiles(world);
  }
  assertEquals(projectileCount(illidan), 0);
  const reflected = mutableProjectile(defender, 0)!;
  assertEquals(reflected.kind, ProjectileKind.manaBurn);
  assertLessThan(reflected.velocityX, 0.0);
  defender.shield.raised = false;
  defender.shield.reflectFrames = 0;
  for (let tick = 0; tick < 60 && illidan.status.damage === 0.0; tick++) updateProjectiles(world);
  assertEquals(illidan.status.condition, HeroStatusKind.stun);
});

test("manaBurnAndAnOpposingShotCancelEachOther [spec #116]", () => {
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const rifleman = createFighter(Character.rifleman, 2000.0, -1);
  const world = testWorld(illidan, rifleman);
  const orb = castOrb(illidan, world);
  assertTrue(startFighterSpecial(rifleman, 0, 0, controls({ specialPressed: true })));
  for (let tick = 0; tick < 30 && projectileCount(rifleman) === 0; tick++) advanceSpecials(world, 0, 0);
  assertEquals(projectileCount(rifleman), 1);
  for (let tick = 0; tick < 60 && projectileCount(illidan) > 0; tick++) updateProjectiles(world);
  assertEquals(projectileCount(illidan), 0);
  assertEquals(projectileCount(rifleman), 0);
  assertEquals(illidan.status.damage, 0.0);
  assertEquals(rifleman.status.damage, 0.0);
  assertGreaterThan(orb.x, 0.0);
});



function centreHit(press: (n: number) => number, percent: number, spacing: number): { angle: number; ko: boolean } {
  const match = comboScene({ stage: 0, attacker: Character.demonHunter, defender: Character.rifleman, attackerX: -spacing / 2, defenderX: spacing / 2, facing: 1, attackerZ: 0, defenderZ: 0, percent });
  const target = fighter(match, 1);
  const stocks = target.status.stocks;
  let angle = Number.NaN;
  for (let n = 1; n <= 300; n++) {
    frameMasks(match, (slot) => (slot === 0 ? press(n) : 0));
    if (Number.isNaN(angle) && target.visuals.hit > 0) angle = Math.atan2(target.launch.knockbackZ, target.launch.knockbackX) * 180 / Math.PI;
    if (target.status.stocks < stocks) return { angle, ko: true };
  }
  return { angle, ko: false };
}

test("illidanDashAttackPopsUpAndHisForwardSmashKillsFirst [repro #359]", () => {
  const dashAttack = (n: number) => (n <= 6 ? bit(Action.moveRight) : n === 7 ? bit(Action.attack) : 0);
  const forwardSmash = (n: number) => (n === 1 ? bit(Action.smashRight) : 0);
  const dash = centreHit(dashAttack, 120, 100.0);
  assertGreaterThan(dash.angle, 45.0);
  assertFalse(dash.ko);
  assertTrue(centreHit(forwardSmash, 135, 40.0).ko);
});
