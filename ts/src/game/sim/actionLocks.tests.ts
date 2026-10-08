// What blocks and releases actions: shield hold and release, shield grabs,
// jump squat, dodge protection and attack recovery.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { max } from "../../runtime/numbers";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { canAttack, canShieldGrab, canStartAttackStyle } from "./conditions";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { beginAirDodge } from "./jumpsAndDodges";
import { attackDurationFrames, attackStartupFrames } from "./moves";
import { SHIELD_MIN_HOLD_FRAMES, SHIELD_RELEASE_LAG_FRAMES } from "./shield";
import { advanceSolo, controls, setRecovery, testWorld } from "./testWorld";
import { authoredPhysics, melee } from "./tuning";

const jumpSquatFrames = (character: Character) => authoredPhysics(character).jumpSquatFrames;

test("releasing a shield waits for the minimum hold, then applies release lag [spec #100]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls({ shield: true });
  advanceSolo(fighter, 0, input, -240.0);
  input.shield = false;
  for (let i = 0; i <= SHIELD_MIN_HOLD_FRAMES - 2; i++) {
    advanceSolo(fighter, 0, input, -240.0);
    assertTrue(fighter.shield.raised);
  }
  advanceSolo(fighter, 0, input, -240.0);
  assertFalse(fighter.shield.raised);
  assertEquals(fighter.shield.releaseLag, SHIELD_RELEASE_LAG_FRAMES);
  const energyAtRelease = fighter.shield.energy;
  advanceSolo(fighter, 0, input, -240.0);
  assertGreaterThan(fighter.shield.energy, energyAtRelease);
  assertEquals(fighter.shield.releaseLag, SHIELD_RELEASE_LAG_FRAMES - 1);
});

test("every fighter's dropped shield blocks attacks for Ultimate's 11 frames, then frees them [spec #100]", () => {
  assertEquals(SHIELD_RELEASE_LAG_FRAMES, 11);
  for (const character of Object.values(Character)) {
    const fighter = createFighter(character, 0.0, 1);
    const input = controls({ shield: true });
    for (let i = 0; i < SHIELD_MIN_HOLD_FRAMES; i++) advanceSolo(fighter, 0, input, -240.0);
    input.shield = false;
    advanceSolo(fighter, 0, input, -240.0);
    assertFalse(fighter.shield.raised);
    assertEquals(fighter.shield.releaseLag, 11);
    for (let frame = 1; frame < 11; frame++) {
      assertFalse(canAttack(fighter));
      advanceSolo(fighter, 0, input, -240.0);
    }
    assertEquals(fighter.shield.releaseLag, 1);
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.shield.releaseLag, 0);
    assertTrue(canAttack(fighter));
  }
});

test("a shield grab requires an unstunned, grounded, active shield and keeps other attacks locked [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.shield.raised = true;
  assertFalse(canAttack(fighter));
  assertTrue(canShieldGrab(fighter));
  assertTrue(canStartAttackStyle(fighter, AttackStyle.grab));
  assertFalse(canStartAttackStyle(fighter, AttackStyle.jab));
  const blockers: (readonly [() => void, () => void])[] = [
    [() => (fighter.shield.stun = 1), () => (fighter.shield.stun = 0)],
    [() => (fighter.launch.hitlag = 1), () => (fighter.launch.hitlag = 0)],
    [() => (fighter.launch.hitstun = 1), () => (fighter.launch.hitstun = 0)],
    [() => (fighter.shield.releaseLag = 1), () => (fighter.shield.releaseLag = 0)],
    [() => (fighter.landing.lag = 1), () => (fighter.landing.lag = 0)],
    [() => (fighter.attack.cooldown = 1), () => (fighter.attack.cooldown = 0)],
    [() => (fighter.jump.squat = 1), () => (fighter.jump.squat = 0)],
    [() => (fighter.grab.grabbedFrames = 1), () => (fighter.grab.grabbedFrames = 0)],
    [() => (fighter.motion.grounded = false), () => (fighter.motion.grounded = true)],
    [() => (fighter.status.out = true), () => (fighter.status.out = false)],
  ];
  for (const [block, unblock] of blockers) {
    block();
    assertFalse(canShieldGrab(fighter));
    unblock();
  }
  fighter.shield.energy = 0.0;
  assertTrue(canShieldGrab(fighter));
  fighter.shield.raised = false;
  assertFalse(canShieldGrab(fighter));
});

test("full and short jumps use distinct launch speeds [reference]", () => {
  const full = createFighter(Character.archer, 0.0, 1);
  const short = createFighter(Character.archer, 0.0, 1);
  const input = controls({ jumpPressed: true, jumpHeld: true });
  advanceSolo(full, 0, input, -240.0);
  advanceSolo(short, 0, input, -240.0);
  input.jumpPressed = false;
  input.jumpHeld = false;
  for (let tick = 1; tick <= 3; tick++) advanceSolo(short, 0, input, -240.0);
  assertNear(short.motion.vz, 12.600000381469727, 0.00009999999747378752);
  input.jumpHeld = true;
  for (let tick = 1; tick <= 3; tick++) advanceSolo(full, 0, input, -240.0);
  assertNear(full.motion.vz, 22.079999923706055, 0.00009999999747378752);
});

test("an air dodge protects only frames four through twenty-nine [reference]", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (let frame = 1; frame <= 30; frame++) {
      const fighter = createFighter(character, 100.0, -1);
      fighter.motion.z = 300.0;
      fighter.motion.grounded = false;
      beginAirDodge(fighter, 0, 0);
      const input = controls();
      for (let tick = 1; tick <= frame; tick++) advanceSolo(fighter, 0, input, -240.0);
      const attacker = createFighter(Character.archer, 0.0, 1);
      attacker.motion.z = fighter.motion.z;
      attacker.attack.style = AttackStyle.jab;
      attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
      resolveAttacks(testWorld(attacker, fighter));
      assertEquals(fighter.status.damage, frame >= 4 && frame <= 29 ? 0.0 : 5.0);
    }
  }
});

test("a hit during dodge startup interrupts the dodge's movement [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.archer, 100.0, -1);
  fighter.motion.z = 300.0;
  fighter.motion.grounded = false;
  beginAirDodge(fighter, 1, 0);
  const attacker = createFighter(Character.archer, 0.0, 1);
  attacker.motion.z = 300.0;
  attacker.attack.style = AttackStyle.jab;
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(testWorld(attacker, fighter));
  assertEquals(fighter.status.damage, 5.0);
  assertFalse(fighter.dodge.airDodging);
  assertEquals(fighter.dodge.airMotionFrames, 0);
  assertGreaterThan(fighter.launch.hitstun, 0);
});

test("landing ends dodge protection without removing respawn protection [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.archer, 100.0, -1);
  fighter.motion.z = 30.0;
  fighter.motion.grounded = false;
  beginAirDodge(fighter, 0, 0);
  const input = controls();
  for (let frame = 1; frame <= 4; frame++) advanceSolo(fighter, 0, input, -240.0);
  fighter.motion.z = 1.0;
  fighter.motion.vz = -5.0;
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.motion.grounded);
  const attacker = createFighter(Character.archer, 0.0, 1);
  attacker.motion.z = fighter.motion.z;
  attacker.attack.style = AttackStyle.jab;
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(testWorld(attacker, fighter));
  assertEquals(fighter.status.damage, 5.0);
  const respawned = createFighter(Character.archer, 100.0, -1);
  respawned.status.invincible = 20;
  const otherAttacker = createFighter(Character.rifleman, 0.0, 1);
  otherAttacker.attack.style = AttackStyle.jab;
  otherAttacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(testWorld(otherAttacker, respawned));
  assertEquals(respawned.status.damage, 0.0);
});

function groundJumpApex(character: Character, holdJump: boolean): number {
  const fighter = createFighter(character, 0.0, 1);
  const input = controls({ jumpPressed: true, jumpHeld: holdJump });
  let apex = 0.0;
  for (let frame = 1; frame <= 120; frame++) {
    advanceSolo(fighter, 0, input, -240.0);
    input.jumpPressed = false;
    apex = max(apex, fighter.motion.z);
  }
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.jump.remaining, 2);
  return apex;
}

function airJumpApex(character: Character): number {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 100.0;
  fighter.motion.vz = -5.0;
  fighter.jump.remaining = 1;
  const input = controls({ jumpPressed: true, jumpHeld: true });
  let apex = fighter.motion.z;
  for (let frame = 1; frame <= 120; frame++) {
    advanceSolo(fighter, 0, input, -240.0);
    input.jumpPressed = false;
    apex = max(apex, fighter.motion.z);
  }
  assertTrue(fighter.motion.grounded);
  return apex - 100;
}

test("complete jump trajectories match the reference heights [reference]", () => {
  assertNear(groundJumpApex(Character.archer, true), melee(31.280000686645508), 0.019999999552965164);
  assertNear(groundJumpApex(Character.archer, false), melee(10.649999618530273), 0.019999999552965164);
  assertNear(airJumpApex(Character.archer), melee(40.20399856567383), 0.019999999552965164);
  assertNear(groundJumpApex(Character.rifleman, true), melee(51.5), 0.019999999552965164);
  assertNear(groundJumpApex(Character.rifleman, false), melee(11.579999923706055), 0.019999999552965164);
  assertNear(airJumpApex(Character.rifleman), melee(41.77799987792969), 0.019999999552965164);
});

test("another press during jump squat doesn't restart it or spend an air jump [spec docs/physics.md]", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    const input = controls({ jumpPressed: true, jumpHeld: true });
    advanceSolo(fighter, 0, input, -240.0);
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.jump.squat, jumpSquatFrames(character) - 1);
    assertEquals(fighter.jump.remaining, 1);
  }
});

test("releasing, then re-pressing during squat keeps a short hop [reference]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const input = controls({ jumpPressed: true, jumpHeld: true });
  advanceSolo(fighter, 0, input, -240.0);
  input.jumpPressed = false;
  input.jumpHeld = false;
  advanceSolo(fighter, 0, input, -240.0);
  input.jumpHeld = true;
  for (let frame = 3; frame <= 6; frame++) advanceSolo(fighter, 0, input, -240.0);
  assertNear(fighter.motion.vz, 11.399999618530273, 0.00009999999747378752);
  assertEquals(fighter.jump.remaining, 1);
});

test("attack recovery blocks a jump through the advance [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  setRecovery(fighter, 3);
  advanceSolo(fighter, 0, controls({ jumpPressed: true, jumpHeld: true }), -240.0);
  assertEquals(fighter.jump.remaining, 2);
  assertEquals(fighter.jump.squat, 0);
  assertTrue(fighter.motion.grounded);
});

test("attack recovery blocks an air dodge through the advance [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 10.0;
  setRecovery(fighter, 3);
  advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: 1 }), -240.0);
  assertFalse(fighter.dodge.airDodging);
  assertEquals(fighter.dodge.airMotionFrames, 0);
  assertEquals(fighter.jump.remaining, 2);
});

test("attack recovery blocks a shield through the advance [spec docs/physics.md]", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  setRecovery(fighter, 3);
  advanceSolo(fighter, 0, controls({ shield: true }), -240.0);
  assertFalse(fighter.shield.raised);
});

test("attack commitment blocks ground steering but keeps air drift [spec docs/physics.md]", () => {
  const grounded = createFighter(Character.archer, 0.0, 1);
  setRecovery(grounded, 10);
  advanceSolo(grounded, 0, controls({ direction: -1 }), -240.0);
  assertEquals(grounded.facing, 1);
  assertEquals(grounded.motion.vx, 0.0);
  const airborne = createFighter(Character.archer, 0.0, 1);
  airborne.motion.grounded = false;
  airborne.motion.z = 120.0;
  setRecovery(airborne, 10);
  advanceSolo(airborne, 0, controls({ direction: -1 }), -240.0);
  assertEquals(airborne.facing, 1);
  assertLessThan(airborne.motion.vx, 0.0);
});

test("the final recovery frame allows actions on the same simulation tick [spec docs/physics.md]", () => {
  const jumper = createFighter(Character.archer, 0.0, 1);
  setRecovery(jumper, 1);
  jumper.attack.frame = attackDurationFrames(AttackStyle.jab) - 1;
  advanceSolo(jumper, 0, controls({ jumpPressed: true, jumpHeld: true }), -240.0);
  assertEquals(jumper.attack.cooldown, 0);
  assertEquals(jumper.jump.squat, jumpSquatFrames(Character.archer));
  const dodger = createFighter(Character.archer, 0.0, 1);
  dodger.motion.grounded = false;
  dodger.motion.z = 120.0;
  setRecovery(dodger, 1);
  dodger.attack.frame = attackDurationFrames(AttackStyle.jab) - 1;
  advanceSolo(dodger, 0, controls({ airDodgePressed: true, dodgeX: 1 }), -240.0);
  assertTrue(dodger.dodge.airDodging);
  assertEquals(dodger.attack.cooldown, 0);
  const shielder = createFighter(Character.archer, 0.0, 1);
  setRecovery(shielder, 1);
  shielder.attack.frame = attackDurationFrames(AttackStyle.jab) - 1;
  advanceSolo(shielder, 0, controls({ shield: true }), -240.0);
  assertTrue(shielder.shield.raised);
  assertEquals(shielder.attack.cooldown, 0);
});

test("a jump out of shield clears the shield throughout squat [spec docs/physics.md]", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    fighter.shield.raised = true;
    fighter.shield.heldFrames = 1;
    const input = controls({ shield: true, jumpPressed: true, jumpHeld: true });
    for (let frame = 1; frame <= jumpSquatFrames(character) + 1; frame++) {
      advanceSolo(fighter, 0, input, -240.0);
      input.jumpPressed = false;
      assertFalse(fighter.shield.raised);
      assertEquals(fighter.shield.releaseLag, 0);
      assertEquals(fighter.jump.squat, jumpSquatFrames(character) + 1 - frame);
    }
    assertFalse(fighter.motion.grounded);
    assertEquals(fighter.jump.remaining, 1);
  }
});

test("a jump cancels shield release into an ordinary squat [spec docs/physics.md]", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (let remaining = 1; remaining <= SHIELD_RELEASE_LAG_FRAMES; remaining++) {
      const fighter = createFighter(character, 0.0, 1);
      const input = controls({ shield: true });
      for (let frame = 1; frame <= SHIELD_MIN_HOLD_FRAMES; frame++) advanceSolo(fighter, 0, input, -240.0);
      input.shield = false;
      advanceSolo(fighter, 0, input, -240.0);
      assertEquals(fighter.shield.releaseLag, SHIELD_RELEASE_LAG_FRAMES);
      for (let frame = remaining + 1; frame <= SHIELD_RELEASE_LAG_FRAMES; frame++) advanceSolo(fighter, 0, input, -240.0);
      assertEquals(fighter.shield.releaseLag, remaining);
      input.jumpPressed = true;
      input.jumpHeld = true;
      advanceSolo(fighter, 0, input, -240.0);
      assertEquals(fighter.shield.releaseLag, 0);
      assertEquals(fighter.jump.squat, jumpSquatFrames(character));
      assertEquals(fighter.jump.remaining, 1);
      input.jumpPressed = false;
      for (let frame = 2; frame <= jumpSquatFrames(character) + 1; frame++) advanceSolo(fighter, 0, input, -240.0);
      assertFalse(fighter.motion.grounded);
      assertEquals(fighter.jump.serial, 1);
    }
  }
});

test("a shield-release jump still respects stun and action recovery [spec docs/physics.md]", () => {
  const blockers = [
    (f: Fighter) => (f.shield.stun = 5),
    (f: Fighter) => (f.launch.hitlag = 5),
    (f: Fighter) => (f.launch.hitstun = 5),
    (f: Fighter) => (f.landing.lag = 5),
    (f: Fighter) => (f.attack.cooldown = 5),
  ];
  for (const block of blockers) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    fighter.shield.releaseLag = SHIELD_RELEASE_LAG_FRAMES;
    block(fighter);
    advanceSolo(fighter, 0, controls({ jumpPressed: true, jumpHeld: true }), -240.0);
    assertEquals(fighter.jump.squat, 0);
    assertEquals(fighter.jump.remaining, 2);
    assertTrue(fighter.motion.grounded);
  }
});

test("a shield jump into a directional dodge lands with a sliding recovery [spec docs/physics.md]", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    fighter.shield.raised = true;
    const input = controls({ shield: true, jumpPressed: true, jumpHeld: true });
    for (let frame = 1; frame <= jumpSquatFrames(character) + 1; frame++) {
      advanceSolo(fighter, 0, input, -240.0);
      input.jumpPressed = false;
    }
    input.airDodgePressed = true;
    input.dodgeX = 1;
    input.dodgeZ = -1;
    advanceSolo(fighter, 0, input, -240.0);
    input.airDodgePressed = false;
    assertTrue(fighter.dodge.airDodging);
    let frames = 0;
    while (!fighter.motion.grounded && frames < 20) {
      advanceSolo(fighter, 0, input, -240.0);
      frames++;
    }
    assertTrue(fighter.motion.grounded);
    assertFalse(fighter.dodge.airDodging);
    assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
    assertGreaterThan(fighter.motion.vx, 0.0);
    assertEquals(fighter.jump.remaining, 2);
    const landingX = fighter.motion.x;
    advanceSolo(fighter, 0, input, -240.0);
    assertGreaterThan(fighter.motion.x, landingX);
    assertFalse(fighter.shield.raised);
    assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG - 1);
  }
});
