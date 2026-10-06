import { stageBounds } from "./stageBounds";
// Dodge intangibility, swept landing and blast-zone loss share the frame
// executor; these contracts retain that interaction through recovery and stocks.
// Air dodges, ground dodges and blast zones.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import {
  GROUND_ROLL_FRAMES,
  GROUND_ROLL_INTANGIBLE_START,
  SPOT_DODGE_FRAMES,
  SPOT_DODGE_INTANGIBLE_END,
  SPOT_DODGE_INTANGIBLE_START,
  canAttack,
  isGroundDodging,
  isIntangible,
} from "./conditions";
import { AIR_DODGE_LANDING_LAG } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { AIR_DODGE_ANIMATION_FRAMES, beginAirDodge } from "./jumpsAndDodges";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "./knockback";
import { attackStartupFrames } from "./moves";
import { surfaceRight, surfaceZ } from "./stage";
import { respawnFighter } from "./stocks";
import { advanceSolo, controls, soloWorld, testWorld } from "./testWorld";
import { GROUND_TRACTION, authoredPhysics } from "./tuning";

test("an air dodge changes velocity, and landing restores jumps", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 20.0;
  const input = controls({ airDodgePressed: true, dodgeX: 1, dodgeZ: -1 });
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.motion.vx > 0);
  assertTrue(fighter.motion.vz < 0);
  assertNear(fighter.motion.vx, 11.836966514587402, 0.009999999776482582);
  let ticks = 0;
  input.airDodgePressed = false;
  input.dodgeX = 0;
  input.dodgeZ = 0;
  while (!fighter.motion.grounded && ticks < 100) {
    advanceSolo(fighter, 0, input, -240.0);
    ticks++;
  }
  assertLessThan(ticks, 100);
  assertEquals(fighter.motion.z, 0.0);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.jump.remaining, 2);
  assertEquals(fighter.landing.lag, 10);
  input.direction = 1;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.landing.lag, 9);
});

const ALL_FIGHTERS = Object.values(Character);

/** A fighter of `character` high above the stage that air dodges down-right this frame. */
function airDodgedFighter(character: Character): Fighter {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 3000.0;
  fighter.jump.remaining = 1;
  advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: 1, dodgeZ: -1 }), -240.0);
  assertTrue(fighter.dodge.airDodging);
  assertTrue(fighter.dodge.airUsed);
  return fighter;
}

test("every fighter's air dodge ends actionable, spends no jump and allows one per airtime", () => {
  for (const character of ALL_FIGHTERS) {
    const fighter = airDodgedFighter(character);
    assertEquals(fighter.jump.remaining, 1);
    const idle = controls();
    for (let frame = 2; frame < AIR_DODGE_ANIMATION_FRAMES; frame++) {
      advanceSolo(fighter, 0, idle, -240.0);
      assertTrue(fighter.dodge.airDodging);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, idle, -240.0);
    assertFalse(fighter.motion.grounded);
    assertFalse(fighter.dodge.airDodging);
    assertTrue(canAttack(fighter));
    // A second dodge in the same airtime is refused; the remaining jump still works.
    advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: -1 }), -240.0);
    assertFalse(fighter.dodge.airDodging);
    advanceSolo(fighter, 0, controls({ jumpPressed: true }), -240.0);
    assertEquals(fighter.jump.remaining, 0);
    assertTrue(fighter.dodge.airUsed);
  }
});

test("landing after the dodge ends uses ordinary landing and refreshes the air dodge for every fighter", () => {
  for (const character of ALL_FIGHTERS) {
    const fighter = airDodgedFighter(character);
    fighter.motion.z = 400.0;
    const idle = controls();
    let ticks = 0;
    while (!fighter.motion.grounded && ticks < 400) {
      advanceSolo(fighter, 0, idle, -240.0);
      ticks++;
    }
    assertTrue(fighter.motion.grounded);
    assertFalse(fighter.dodge.airUsed);
    assertLessThan(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
  }
});

test("a waveland during the dodge keeps its special landing and refreshes the dodge for every fighter", () => {
  for (const character of ALL_FIGHTERS) {
    const fighter = createFighter(character, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 6.0;
    advanceSolo(fighter, 0, controls({ airDodgePressed: true, dodgeX: 1 }), -240.0);
    let ticks = 0;
    while (!fighter.motion.grounded && ticks < 20) {
      advanceSolo(fighter, 0, controls(), -240.0);
      ticks++;
    }
    assertTrue(fighter.motion.grounded);
    assertGreaterThan(fighter.motion.vx, 0.0);
    assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG - ticks + 1);
    assertFalse(fighter.dodge.airUsed);
  }
});

test("a hit refreshes a spent air dodge for every fighter", () => {
  for (const character of ALL_FIGHTERS) {
    const fighter = airDodgedFighter(character);
    for (let frame = 2; frame <= AIR_DODGE_ANIMATION_FRAMES; frame++) advanceSolo(fighter, 0, controls(), -240.0);
    fighter.status.invincible = 0;
    const attacker = createFighter(Character.archer, fighter.motion.x - 40.0, 1);
    attacker.motion.grounded = false;
    attacker.motion.z = fighter.motion.z;
    attacker.attack.style = AttackStyle.neutralAir;
    attacker.attack.frame = attackStartupFrames(AttackStyle.neutralAir);
    resolveAttacks(testWorld(attacker, fighter));
    assertGreaterThan(fighter.launch.hitstun, 0);
    assertFalse(fighter.dodge.airUsed);
  }
});

test("an air dodge replaces prior movement and launch momentum", () => {
  for (const direction of [0, 1]) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 300.0;
    fighter.motion.vx = -30.0;
    fighter.motion.vz = 20.0;
    fighter.launch.knockbackX = 40.0;
    fighter.launch.knockbackZ = -50.0;
    const input = controls({ airDodgePressed: true, dodgeX: direction });
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.launch.knockbackX, 0.0);
    assertEquals(fighter.launch.knockbackZ, 0.0);
    assertNear(fighter.motion.x, direction * 15.920684814453125, 0.0010000000474974513);
    assertNear(fighter.motion.vx, direction * 15.920684814453125, 0.0010000000474974513);
    assertNear(fighter.motion.z, 300.0 - direction * 5.172944068908691, 0.0010000000474974513);
    assertNear(fighter.motion.vz, -direction * 5.172944068908691, 0.0010000000474974513);
    input.airDodgePressed = false;
    advanceSolo(fighter, 0, input, 0.0);
    assertNear(fighter.motion.x, direction * 30.24930191040039, 0.0010000000474974513);
    assertNear(fighter.motion.z, 300.0 - direction * 9.828594207763672, 0.0010000000474974513);
  }
});

test("a horizontal air dodge defaults to a shallow wavedash on both sides", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [-1, 1]) {
      const fighter = createFighter(character, 0.0, -direction);
      fighter.motion.grounded = false;
      fighter.motion.z = 1.0;
      beginAirDodge(fighter, direction, 0);
      assertNear(fighter.motion.vx, direction * 17.689651489257812, 0.00009999999747378752);
      assertNear(fighter.motion.vz, -5.747715950012207, 0.00009999999747378752);
      assertNear(f32(f32(fighter.motion.vx * fighter.motion.vx) + f32(fighter.motion.vz * fighter.motion.vz)), 345.9599914550781, 0.0010000000474974513);
      const input = controls();
      advanceSolo(fighter, 0, input, 0.0);
      assertTrue(fighter.motion.grounded);
      assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
      assertGreaterThan(fighter.motion.vx * direction, 11.4552001953125);
      const landedX = fighter.motion.x;
      advanceSolo(fighter, 0, input, 0.0);
      assertGreaterThan((fighter.motion.x - landedX) * direction, 0.0);
    }
  }
});

test("diagonal down doesn't trigger a fast fall, but straight down does", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const direction of [-1, 0, 1]) {
      const fighter = createFighter(character, 0.0, 1);
      fighter.motion.grounded = false;
      fighter.motion.z = 300.0;
      fighter.motion.vz = -1.0;
      advanceSolo(fighter, 0, controls({ down: true, verticalDirection: -1, direction }), 0.0);
      const physics = authoredPhysics(character);
      if (direction === 0) {
        assertNear(fighter.motion.vz, -physics.fastFallSpeed, 0.0010000000474974513);
      } else {
        assertNear(fighter.motion.vz, -1 - physics.gravity, 0.0010000000474974513);
        assertGreaterThan(fighter.motion.vx * direction, 0.0);
      }
    }
  }
});

test("a diagonal air dodge displaces both axes with the same decayed vector", () => {
  for (const direction of [-1, 1]) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 300.0;
    beginAirDodge(fighter, 1, direction);
    const input = controls();
    let displacement = 11.836966514587402;
    let distance = 0.0;
    for (let frame = 1; frame <= 29; frame++) {
      advanceSolo(fighter, 0, input, 0.0);
      distance = f32(distance + displacement);
      assertNear(fighter.motion.x, distance, 0.0010000000474974513);
      assertNear(fighter.motion.z, 300 + direction * distance, 0.0010000000474974513);
      assertNear(fighter.motion.vx, displacement, 0.0010000000474974513);
      assertNear(fighter.motion.vz, direction * displacement, 0.0010000000474974513);
      displacement = f32(displacement * 0.8999999761581421);
    }
  }
});

test("a fast air dodge uses the swept platform crossing", () => {
  for (const entersTooLate of [false, true]) {
    const fighter = createFighter(Character.archer, entersTooLate ? -440.0 : -350.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 200.0;
    beginAirDodge(fighter, 1, -1);
    // Stress the collision sweep independently of provisional dodge speed.
    fighter.motion.vx = 100.0;
    fighter.motion.vz = -300.0;
    advanceSolo(fighter, 1, controls(), 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.motion.surface, entersTooLate ? 0 : 1);
    assertEquals(fighter.motion.z, entersTooLate ? 0.0 : 170.0);
    assertNear(fighter.motion.vx, 90.0, 0.0010000000474974513);
    assertEquals(fighter.landing.lag, 10);
  }
});

test("an air dodge landing slides and restores actions after ten ticks", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    const fighter = createFighter(character, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    beginAirDodge(fighter, 1, -1);
    const input = controls();
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.landing.lag, 10);
    assertFalse(canAttack(fighter));
    const landingSpeed = fighter.motion.vx;
    input.direction = -1;
    for (let tick = 1; tick <= 9; tick++) {
      const previousX = fighter.motion.x;
      advanceSolo(fighter, 0, input, 0.0);
      assertGreaterThan(fighter.motion.x, previousX);
      assertNear(fighter.motion.vx, landingSpeed - tick * GROUND_TRACTION, 0.0010000000474974513);
      assertEquals(fighter.landing.lag, 10 - tick);
      assertFalse(canAttack(fighter));
    }
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.landing.lag, 0);
    assertTrue(canAttack(fighter));
    assertNear(fighter.motion.vx, -11.399999618530273, 0.0010000000474974513);
    assertEquals(fighter.ground.dashFrame, 1);
  }
});

test("a delayed jump air dodge lands during its motion and slides", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const fullJump of [false, true]) {
      for (const direction of [-1, 1]) {
        const fighter = createFighter(character, 0.0, direction);
        const input = controls({ jumpPressed: true, jumpHeld: true });
        for (let tick = 1; tick <= 6; tick++) {
          advanceSolo(fighter, 0, input, 0.0);
          input.jumpPressed = false;
          input.jumpHeld = fullJump;
        }
        assertFalse(fighter.motion.grounded);
        input.airDodgePressed = true;
        input.dodgeX = direction;
        input.dodgeZ = -1;
        advanceSolo(fighter, 0, input, 0.0);
        input.airDodgePressed = false;
        while (!fighter.motion.grounded && fighter.dodge.airMotionFrames > 0) advanceSolo(fighter, 0, input, 0.0);
        assertTrue(fighter.motion.grounded);
        assertGreaterThan(fighter.dodge.airMotionFrames, 0);
        assertEquals(fighter.landing.lag, 10);
        assertGreaterThan(fighter.motion.vx * direction, GROUND_TRACTION);
        const landingX = fighter.motion.x;
        const landingSpeed = fighter.motion.vx;
        advanceSolo(fighter, 0, input, 0.0);
        assertGreaterThan((fighter.motion.x - landingX) * direction, 0.0);
        assertNear(fighter.motion.vx, landingSpeed - direction * GROUND_TRACTION, 0.0010000000474974513);
        assertEquals(fighter.landing.lag, 9);
        assertFalse(canAttack(fighter));
      }
    }
  }
});

test("an air dodge landing uses ground friction even while the air timer remains", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = true;
  fighter.dodge.airDodging = true;
  fighter.dodge.airMotionFrames = 20;
  fighter.motion.surface = 0;
  fighter.motion.z = 0.0;
  fighter.motion.vz = 0.0;
  fighter.motion.vx = 5.0;
  const input = controls();
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
  assertEquals(fighter.dodge.airMotionFrames, 19);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.airMotionFrames, 18);
  assertNear(fighter.motion.vx, 5 - 2 * GROUND_TRACTION, 0.009999999776482582);
});

test("a spot dodge starts at frame one, stays in place and uses provisional intangibility", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.surface = 0;
  const input = controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: 0 });
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.groundFrame, 1);
  assertTrue(isGroundDodging(fighter));
  assertFalse(isIntangible(fighter));
  assertEquals(fighter.motion.x, 0.0);
  input.groundDodgePressed = false;
  for (let frame = 2; frame <= SPOT_DODGE_INTANGIBLE_START; frame++) advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.groundFrame, SPOT_DODGE_INTANGIBLE_START);
  assertTrue(isIntangible(fighter));
  for (let frame = SPOT_DODGE_INTANGIBLE_START + 1; frame <= SPOT_DODGE_INTANGIBLE_END; frame++) advanceSolo(fighter, 0, input, -240.0);
  assertTrue(isIntangible(fighter));
  advanceSolo(fighter, 0, input, -240.0);
  assertFalse(isIntangible(fighter));
  for (let frame = SPOT_DODGE_INTANGIBLE_END + 2; frame <= SPOT_DODGE_FRAMES; frame++) advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.groundFrame, SPOT_DODGE_FRAMES);
  assertEquals(fighter.motion.x, 0.0);
  assertFalse(canAttack(fighter));
  input.jumpPressed = true;
  const jumpsBefore = fighter.jump.remaining;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.groundFrame, 0);
  assertEquals(fighter.jump.remaining, jumpsBefore);
});

test("a roll has bounded, locked motion and turns before its recovery ends", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.surface = 0;
  const input = controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: 1, direction: -1 });
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.groundFrame, 1);
  assertEquals(fighter.facing, 1);
  input.groundDodgePressed = false;
  advanceSolo(fighter, 0, input, -240.0);
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.groundFrame, GROUND_ROLL_INTANGIBLE_START - 1);
  assertFalse(isIntangible(fighter));
  advanceSolo(fighter, 0, input, -240.0);
  assertTrue(isIntangible(fighter));
  for (let frame = GROUND_ROLL_INTANGIBLE_START + 1; frame <= GROUND_ROLL_FRAMES; frame++) advanceSolo(fighter, 0, input, -240.0);
  assertNear(fighter.motion.x, 201.60000610351562, 0.00009999999747378752);
  assertEquals(fighter.facing, -1);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.dodge.groundFrame, GROUND_ROLL_FRAMES);
  assertFalse(canAttack(fighter));
  input.jumpPressed = true;
  const jumpsBefore = fighter.jump.remaining;
  advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.dodge.groundFrame, 0);
  assertEquals(fighter.facing, -1);
  assertEquals(fighter.jump.remaining, jumpsBefore);
});

test("a backward roll keeps facing, and a roll can't leave its platform", () => {
  const fighter = createFighter(Character.archer, 590.0, -1);
  fighter.motion.surface = 0;
  const input = controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: 1 });
  advanceSolo(fighter, 0, input, -240.0);
  input.groundDodgePressed = false;
  for (let frame = 2; frame <= GROUND_ROLL_FRAMES + 5; frame++) advanceSolo(fighter, 0, input, -240.0);
  assertEquals(fighter.motion.x, surfaceRight(0, 0, 0));
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.facing, -1);
});

test("a ground dodge rejects hitlag, shieldstun, landing lag and unshielded presses", () => {
  const input = controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: -1 });
  const hitlagged = createFighter(Character.archer, 0.0, 1);
  hitlagged.launch.hitlag = 2;
  advanceSolo(hitlagged, 0, input, -240.0);
  assertEquals(hitlagged.dodge.groundFrame, 0);
  advanceSolo(hitlagged, 0, input, -240.0);
  assertEquals(hitlagged.dodge.groundFrame, 1);
  const blocked = [
    (f: Fighter) => (f.shield.stun = 5),
    (f: Fighter) => (f.landing.lag = 5),
    (f: Fighter) => (f.launch.hitstun = 5),
    (f: Fighter) => (f.attack.cooldown = 5),
    (f: Fighter) => (f.shield.releaseLag = 5),
  ];
  for (const block of blocked) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    block(fighter);
    advanceSolo(fighter, 0, input, -240.0);
    assertEquals(fighter.dodge.groundFrame, 0);
  }
  const unshielded = createFighter(Character.archer, 0.0, 1);
  input.shield = false;
  advanceSolo(unshielded, 0, input, -240.0);
  assertEquals(unshielded.dodge.groundFrame, 0);
});

test("a spot dodge doesn't drop through a pass-through platform", () => {
  const fighter = createFighter(Character.archer, -200.0, 1);
  fighter.motion.surface = 1;
  fighter.motion.z = surfaceZ(1, 1, 0);
  advanceSolo(fighter, 1, controls({ shield: true, down: true, groundDodgePressed: true, groundDodgeDirection: 0 }), -240.0);
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.motion.surface, 1);
  assertEquals(fighter.motion.z, surfaceZ(1, 1, 0));
  assertEquals(fighter.dodge.groundFrame, 1);
});

test("a jump takes priority over a starting ground dodge", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  advanceSolo(fighter, 0, controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: -1, jumpPressed: true }), -240.0);
  assertEquals(fighter.dodge.groundFrame, 0);
  assertEquals(fighter.jump.remaining, 1);
  assertEquals(fighter.jump.squat, authoredPhysics(Character.archer).jumpSquatFrames);
});

test("respawning and getting hit clear the ground dodge state", () => {
  const fighter = createFighter(Character.rifleman, 100.0, -1);
  fighter.dodge.groundFrame = 8;
  fighter.dodge.groundDirection = -1;
  respawnFighter(soloWorld(fighter), 0, 0.0);
  assertEquals(fighter.dodge.groundFrame, 0);
  assertEquals(fighter.dodge.groundDirection, 0);
  fighter.dodge.groundFrame = 1;
  fighter.dodge.groundDirection = -1;
  fighter.motion.x = 100.0;
  fighter.motion.z = 0.0;
  fighter.motion.grounded = true;
  fighter.motion.surface = 0;
  fighter.status.invincible = 0;
  const attacker = createFighter(Character.archer, 0.0, 1);
  attacker.attack.style = AttackStyle.jab;
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(testWorld(attacker, fighter));
  assertEquals(fighter.dodge.groundFrame, 0);
  assertEquals(fighter.dodge.groundDirection, 0);
});

test("crossing a platform from below doesn't land", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.x = -250.0;
  fighter.motion.z = 100.0;
  fighter.motion.vz = 10.0;
  advanceSolo(fighter, 1, controls(), -240.0);
  assertFalse(fighter.motion.grounded);
  assertGreaterThan(fighter.motion.z, 100.0);
});

test("a blast zone removes exactly one stock", () => {
  const fighter = createFighter(Character.archer, (stageBounds(0).blast.right - 2.0), 1);
  fighter.motion.vx = 100.0;
  const input = controls({ direction: 1 });
  const step = () => advanceSolo(fighter, 0, input, -240.0);
  step();
  assertTrue(fighter.status.out);
  assertEquals(fighter.status.stocks, 2);
  for (let ticks = 0; ticks < 130; ticks++) step();
  assertEquals(fighter.status.stocks, 2);
  assertFalse(fighter.status.out);
  fighter.motion.x = (stageBounds(0).blast.right + 0.0009765625);
  step();
  assertEquals(fighter.status.stocks, 1);
  while (fighter.status.respawn > 0) step();
  fighter.motion.x = (stageBounds(0).blast.right + 0.0009765625);
  step();
  assertEquals(fighter.status.stocks, 0);
  assertTrue(fighter.status.out);
  const finalX = fighter.motion.x;
  step();
  assertEquals(fighter.motion.x, finalX);
});

test("the top blast zone requires launch knockback rather than jump speed", () => {
  for (const mode of [0, 1, 2]) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = (stageBounds(0).blast.top + 1.0);
    fighter.motion.vz = 30.0;
    fighter.launch.knockbackZ = mode === 0 ? 0.0 : mode === 1 ? TOP_KO_MINIMUM_UPWARD_KNOCKBACK : f32(TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 0.0010000000474974513);
    advanceSolo(fighter, 0, controls(), 0.0);
    assertEquals(fighter.status.out, mode === 2);
    assertEquals(fighter.status.stocks, mode === 2 ? 2 : 3);
  }
});

test("the top blast zone boundary doesn't consume a stock until crossed", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = stageBounds(0).blast.top;
  fighter.motion.vz = -50.0;
  fighter.launch.knockbackZ = f32(TOP_KO_MINIMUM_UPWARD_KNOCKBACK + 1);
  advanceSolo(fighter, 0, controls(), 0.0);
  assertFalse(fighter.status.out);
  assertEquals(fighter.status.stocks, 3);
});

test("the side blast zone boundaries require a strict crossing", () => {
  for (const direction of [-1, 1]) {
    const fighter = createFighter(Character.archer, f32(direction * stageBounds(0).blast.right), direction);
    const input = controls();
    fighter.motion.grounded = false;
    fighter.motion.z = 400.0;
    advanceSolo(fighter, 0, input, 0.0);
    assertFalse(fighter.status.out);
    fighter.motion.x = f32(direction * (stageBounds(0).blast.right + 0.0009765625));
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(fighter.status.out);
    assertEquals(fighter.status.stocks, 2);
  }
});

test("the bottom blast zone boundary requires a strict crossing", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  const input = controls();
  fighter.motion.grounded = false;
  fighter.motion.z = stageBounds(0).blast.bottom;
  fighter.motion.vz = 50.0;
  advanceSolo(fighter, 0, input, 0.0);
  assertFalse(fighter.status.out);
  fighter.motion.z = (stageBounds(0).blast.bottom - 0.0009765625);
  advanceSolo(fighter, 0, input, 0.0);
  assertTrue(fighter.status.out);
  assertEquals(fighter.status.stocks, 2);
});
