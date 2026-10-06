// Ledge catches, contention, hang options and their protection.
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { resolveAttacks } from "./attacks";
import { AttackPhase, AttackStyle, Character, DownState, LedgeState, ShieldBreak, SpecialAction } from "./codes";
import { attackPhase, canAttack, isIntangible } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { AIR_DODGE_ANIMATION_FRAMES } from "./jumpsAndDodges";
import { LEDGE_CLIMB_FRAMES, LEDGE_INTANGIBLE_FRAMES, LEDGE_ROLL_FRAMES, ledgeCatchBox, ledgeSnap, resolveLedges } from "./ledge";
import { LEDGE_ATTACK_FRAMES, attackStartupFrames, grabHoldFrames } from "./moves";
import type { Controls } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { BODY_HALF_WIDTH } from "./surfaces";
import { respawnFighter } from "./stocks";
import { advanceSolo, controls, soloWorld, testBeginAttacks, testWorld } from "./testWorld";
import { LEDGE_REGRAB_FRAMES } from "./transitions";
import { authoredPhysics } from "./tuning";

const LEDGE_PHASES = [LedgeState.hang, LedgeState.climb, LedgeState.roll, LedgeState.attack] as const;

/** A fighter beside a main-deck ledge, facing the stage, whose last movement fell into every fighter's catch box. */
function ledgeTestFighter(character: Character, side: number): Fighter {
  const fighter = createFighter(character, f32(side * 620.0), -side);
  fighter.motion.grounded = false;
  fighter.motion.z = -80.0;
  fighter.motion.vz = -2.0;
  fighter.motion.deltaZ = -2.0;
  fighter.jump.remaining = 0;
  return fighter;
}

function catchTestLedge(fighter: Fighter, input: Readonly<Controls>): void {
  resolveLedges(testWorld(fighter, createFighter(Character.rifleman, 0.0, 1)), 0, [input, controls()]);
}

/**
 * Whether a fighter of `character` facing the `side` ledge catches it after a
 * movement from (outsideBefore, belowBefore) to (outside, below), measured
 * outward from and down from the ledge.
 */
function catchesAfterMovement(character: Character, side: number, outsideBefore: number, belowBefore: number, outside: number, below: number): boolean {
  const fighter = ledgeTestFighter(character, side);
  const edge = side < 0 ? surfaceLeft(0, 0, 0) : surfaceRight(0, 0, 0);
  fighter.motion.x = f32(edge + f32(side * outside));
  fighter.motion.z = f32(surfaceZ(0, 0, 0) - below);
  fighter.motion.deltaX = f32(side * f32(outside - outsideBefore));
  fighter.motion.deltaZ = f32(belowBefore - below);
  catchTestLedge(fighter, controls());
  return fighter.ledge.state === LedgeState.hang;
}

test("each fighter catches with its reference fighter's NTSC 1.02 ledge snap data", () => {
  // ftData x44 +0x10/+0x14/+0x18 (melee:src/melee/ft/types.h ftData_x44_t), read
  // by melee:src/melee/ft/ft_081B.c into the box of melee:src/melee/mp/mpcoll.c.
  // PlFx.dat (Fox) and PlFc.dat (Falco): 11, 13, 9. PlCa.dat (Captain Falcon): 9, 17, 11.
  const references = [
    [Character.archer, 11.0, 13.0, 9.0],
    [Character.rifleman, 11.0, 13.0, 9.0],
    [Character.demonHunter, 9.0, 17.0, 11.0],
  ] as const;
  for (const [character, x, y, height] of references) {
    const snap = ledgeSnap(character);
    assertEquals(snap.x, x);
    assertEquals(snap.y, y);
    assertEquals(snap.height, height);
    // Reach adds Melee's 2-unit minimum airborne collision half-width; six world units per Melee unit.
    const box = ledgeCatchBox(character);
    assertEquals(BODY_HALF_WIDTH, 2.0);
    assertEquals(box.reach, f32(f32(x + 2.0) * 6.0));
    assertEquals(box.lowest, f32(f32(y - f32(height * 0.5)) * 6.0));
    assertEquals(box.highest, f32(f32(y + f32(height * 0.5)) * 6.0));
  }
  assertEquals(ledgeCatchBox(Character.archer).reach, 78.0);
  assertEquals(ledgeCatchBox(Character.archer).lowest, 51.0);
  assertEquals(ledgeCatchBox(Character.archer).highest, 105.0);
  assertEquals(ledgeCatchBox(Character.demonHunter).reach, 66.0);
  assertEquals(ledgeCatchBox(Character.demonHunter).lowest, 69.0);
  assertEquals(ledgeCatchBox(Character.demonHunter).highest, 135.0);
});

test("the catch box's edges are strict for every fighter and side", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const { reach, lowest, highest } = ledgeCatchBox(character);
    const middle = f32(f32(lowest + highest) * 0.5);
    for (const side of [-1, 1]) {
      // Ahead of the fighter: strictly beyond the ledge and strictly within reach.
      assertTrue(catchesAfterMovement(character, side, f32(reach - 1.0), f32(middle - 1.0), f32(reach - 1.0), middle));
      assertFalse(catchesAfterMovement(character, side, reach, f32(middle - 1.0), reach, middle));
      assertTrue(catchesAfterMovement(character, side, 1.0, f32(middle - 1.0), 1.0, middle));
      assertFalse(catchesAfterMovement(character, side, 0.0, f32(middle - 1.0), 0.0, middle));
      // Below it: strictly between the lowest and highest ledge heights above the feet.
      assertFalse(catchesAfterMovement(character, side, 20.0, f32(lowest - 2.0), 20.0, lowest));
      assertTrue(catchesAfterMovement(character, side, 20.0, f32(lowest - 1.0), 20.0, f32(lowest + 1.0)));
      assertFalse(catchesAfterMovement(character, side, 20.0, highest, 20.0, f32(highest + 2.0)));
      assertTrue(catchesAfterMovement(character, side, 20.0, f32(highest - 1.0), 20.0, f32(highest + 1.0)));
    }
  }
});

test("the catch box sweeps the frame's movement, and only a downward movement catches", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const { reach, lowest, highest } = ledgeCatchBox(character);
    const middle = f32(f32(lowest + highest) * 0.5);
    for (const side of [-1, 1]) {
      // A fall through the whole window in one frame, and a drift out of reach, still catch.
      assertTrue(catchesAfterMovement(character, side, 20.0, f32(lowest - 10.0), 20.0, f32(highest + 10.0)));
      assertTrue(catchesAfterMovement(character, side, f32(reach - 1.0), f32(middle - 1.0), f32(reach + 10.0), middle));
      assertFalse(catchesAfterMovement(character, side, f32(reach + 10.0), f32(middle - 1.0), f32(reach + 10.0), middle));
      // Rising or level movement never catches, even inside the box.
      assertFalse(catchesAfterMovement(character, side, 20.0, f32(middle + 1.0), 20.0, middle));
      assertFalse(catchesAfterMovement(character, side, 20.0, middle, 20.0, middle));
    }
  }
});

test("falling, helpless and tumbling fighters catch; aerials, specials, air dodges and hitstun don't", () => {
  const upSpecials = [SpecialAction.archerRecovery, SpecialAction.riflemanRecovery, SpecialAction.demonHunterWingAscent] as const;
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const states: readonly (readonly [boolean, (f: Fighter) => void])[] = [
      [true, () => undefined],
      [true, (f) => (f.special.fall = true)],
      [true, (f) => (f.down.state = DownState.tumble)],
      [true, (f) => {
        f.dodge.airDodging = true;
        f.dodge.airFrame = AIR_DODGE_ANIMATION_FRAMES;
      }],
      [false, (f) => {
        f.dodge.airDodging = true;
        f.dodge.airFrame = AIR_DODGE_ANIMATION_FRAMES - 1;
      }],
      [false, (f) => {
        f.attack.style = AttackStyle.neutralAir;
        f.attack.cooldown = 1;
      }],
      [false, (f) => {
        f.special.action = upSpecials[character];
        f.special.lockFrames = 1;
      }],
      [false, (f) => {
        f.down.state = DownState.tumble;
        f.launch.hitstun = 1;
      }],
    ];
    for (const [catches, enter] of states) {
      const fighter = ledgeTestFighter(character, -1);
      enter(fighter);
      catchTestLedge(fighter, controls());
      assertEquals(fighter.ledge.state, catches ? LedgeState.hang : LedgeState.none);
      if (catches) {
        assertFalse(fighter.dodge.airDodging);
        assertFalse(fighter.special.fall);
      }
    }
  }
});

test("a ledge catch on either side restores one air jump for every fighter", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    for (const side of [-1, 1]) {
      const fighter = ledgeTestFighter(character, side);
      fighter.status.damage = 75.0;
      fighter.shield.energy = 12.0;
      fighter.launch.knockbackX = 1.0;
      catchTestLedge(fighter, controls());
      assertEquals(fighter.ledge.state, LedgeState.hang);
      assertEquals(fighter.ledge.side, side);
      assertEquals(fighter.ledge.frame, 0);
      assertEquals(fighter.ledge.serial, 1);
      assertEquals(fighter.facing, -side);
      assertEquals(fighter.motion.x, f32(side * 624.0));
      assertEquals(fighter.motion.z, -90.0);
      assertEquals(fighter.motion.vx, 0.0);
      assertEquals(fighter.motion.vz, 0.0);
      assertEquals(fighter.jump.remaining, 1);
      assertEquals(fighter.launch.knockbackX, 0.0);
      assertEquals(fighter.status.damage, 75.0);
      assertEquals(fighter.shield.energy, 12.0);
      assertEquals(fighter.status.invincible, 0);
      assertTrue(isIntangible(fighter));
    }
  }
});

test("ledge eligibility rejects locks, wrong facing and positions outside the region", () => {
  const rejections: ((fighter: Fighter, input: Controls) => void)[] = [
    (f) => (f.motion.deltaZ = 1.0),
    (f) => (f.motion.deltaZ = 0.0),
    (f) => (f.facing = -1),
    (_, input) => (input.down = true),
    (f) => (f.launch.hitstun = 1),
    (f) => (f.launch.hitlag = 1),
    (f) => (f.attack.cooldown = 1),
    (f) => (f.dodge.airDodging = true),
    (f) => (f.shield.breakState = ShieldBreak.air),
    (f) => (f.grab.grabbedFrames = 1),
    (f) => (f.ledge.regrab = 1),
    (f) => (f.motion.x = -700.0),
    (f) => (f.motion.z = -140.0),
    (f) => (f.motion.z = 13.0),
    (f) => (f.motion.x = -599.0),
  ];
  for (const reject of rejections) {
    const fighter = ledgeTestFighter(Character.archer, -1);
    const input = controls();
    reject(fighter, input);
    catchTestLedge(fighter, input);
    assertEquals(fighter.ledge.state, LedgeState.none);
  }
});

test("only a full down passes ledges; a slight downward tilt still catches", () => {
  // Melee refuses a catch from stick y -0.66 (ftCliffCommon_80081298, +0x480);
  // the helper reports `down` there, and any tilt past the deadzone as the axis.
  const fighter = ledgeTestFighter(Character.archer, -1);
  const input = controls();
  input.verticalDirection = -1;
  catchTestLedge(fighter, input);
  assertEquals(fighter.ledge.state, LedgeState.hang);
});

test("upper platform ledges can't be caught", () => {
  const fighter = ledgeTestFighter(Character.rifleman, -1);
  fighter.motion.x = f32(surfaceLeft(1, 1, 0) - 20);
  fighter.motion.z = f32(surfaceZ(1, 1, 0) - 30);
  const input = controls();
  resolveLedges(testWorld(fighter, createFighter(Character.archer, 0.0, 1)), 1, [input, input]);
  assertEquals(fighter.ledge.state, LedgeState.none);
});

test("ledge contention uses distance, not argument order, and the owner hogs", () => {
  for (const reversed of [false, true]) {
    const near = ledgeTestFighter(Character.archer, -1);
    const far = ledgeTestFighter(Character.rifleman, -1);
    const input = controls();
    far.motion.x = -640.0;
    resolveLedges(reversed ? testWorld(far, near) : testWorld(near, far), 0, [input, input]);
    assertEquals(near.ledge.state, LedgeState.hang);
    assertEquals(far.ledge.state, LedgeState.none);
    near.ledge.intangible = 0;
    far.motion.x = -601.0;
    far.motion.z = -80.0;
    resolveLedges(testWorld(far, near), 0, [input, input]);
    assertEquals(far.ledge.state, LedgeState.none);
  }
});

test("tied ledge candidates catch neither, and opposite edges are independent", () => {
  const first = ledgeTestFighter(Character.archer, 1);
  const second = ledgeTestFighter(Character.rifleman, 1);
  const input = controls();
  resolveLedges(testWorld(first, second), 0, [input, input]);
  assertEquals(first.ledge.state, LedgeState.none);
  assertEquals(second.ledge.state, LedgeState.none);
  second.motion.x = -620.0;
  second.facing = 1;
  resolveLedges(testWorld(first, second), 0, [input, input]);
  assertEquals(first.ledge.state, LedgeState.hang);
  assertEquals(second.ledge.state, LedgeState.hang);
});

test("ledge options honor priority, locks and exact recovery durations", () => {
  for (const character of [Character.archer, Character.rifleman]) {
    for (const side of [-1, 1]) {
      for (let option = 0; option <= 6; option++) {
        const fighter = ledgeTestFighter(character, side);
        const input = controls();
        catchTestLedge(fighter, input);
        advanceSolo(fighter, 0, input, 0.0);
        input.jumpPressed = option === 0;
        input.getupDirectionPressed = option === 1 || option === 2;
        input.getupDirection = option === 1 ? -side : side;
        input.ledgeVerticalPressed = option === 3 ? 1 : option === 4 ? -1 : 0;
        input.airDodgePressed = option === 5;
        input.getupAttackPressed = true;
        advanceSolo(fighter, 0, input, 0.0);
        if (option === 0 || option === 2 || option === 4) {
          assertEquals(fighter.ledge.state, LedgeState.none);
          // Letting go starts the regrab lock; a ledge jump doesn't.
          assertEquals(fighter.ledge.regrab, option === 0 ? 0 : LEDGE_REGRAB_FRAMES);
          assertFalse(isIntangible(fighter));
          assertEquals(fighter.jump.remaining, 1);
          if (option === 0) {
            assertEquals(fighter.motion.vz, authoredPhysics(character).fullJumpSpeed);
            assertEquals(fighter.jump.serial, 1);
          } else {
            assertEquals(fighter.motion.vz, -2.0);
          }
          continue;
        }
        const phase = option === 5 ? LedgeState.roll : option === 6 ? LedgeState.attack : LedgeState.climb;
        const duration = option === 5 ? LEDGE_ROLL_FRAMES : option === 6 ? LEDGE_ATTACK_FRAMES : LEDGE_CLIMB_FRAMES;
        assertEquals(fighter.ledge.state, phase);
        assertEquals(fighter.ledge.frame, 0);
        input.jumpPressed = true;
        input.shield = true;
        input.down = true;
        for (let tick = 1; tick <= duration - 1; tick++) {
          advanceSolo(fighter, 0, input, 0.0);
          assertEquals(fighter.ledge.state, phase);
          assertEquals(fighter.ledge.frame, tick);
          assertEquals(fighter.jump.serial, 0);
          assertFalse(fighter.shield.raised);
          assertFalse(canAttack(fighter));
        }
        advanceSolo(fighter, 0, input, 0.0);
        assertEquals(fighter.ledge.state, LedgeState.none);
        assertTrue(fighter.motion.grounded);
        assertEquals(fighter.motion.surface, 0);
        assertEquals(fighter.motion.z, 0.0);
        assertEquals(fighter.motion.x, f32(side * (option === 5 ? 460.0 : option === 6 ? 536.0 : 576.0)));
        assertEquals(fighter.attack.style, undefined);
        assertEquals(fighter.jump.remaining, 2);
        assertEquals(fighter.ledge.regrab, 0);
      }
    }
  }
});

test("ledge hang protection expires, and hitlag freezes the ledge phase", () => {
  const fighter = ledgeTestFighter(Character.archer, -1);
  const input = controls();
  catchTestLedge(fighter, input);
  input.direction = 1;
  input.verticalDirection = 1;
  input.shield = true;
  input.attackHeld = true;
  for (let tick = 1; tick <= LEDGE_INTANGIBLE_FRAMES - 1; tick++) {
    advanceSolo(fighter, 0, input, 0.0);
    assertTrue(isIntangible(fighter));
    assertEquals(fighter.ledge.state, LedgeState.hang);
  }
  advanceSolo(fighter, 0, input, 0.0);
  assertFalse(isIntangible(fighter));
  input.getupAttackPressed = true;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.ledge.state, LedgeState.attack);
  assertFalse(isIntangible(fighter));
  fighter.launch.hitlag = 2;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.ledge.frame, 0);
  assertEquals(fighter.attack.frame, 0);
  assertEquals(fighter.motion.x, -624.0);
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.ledge.frame, 1);
  assertEquals(fighter.attack.frame, 1);
});

test("a ledge attack has startup, an active window that hits once, and recovery", () => {
  for (const side of [-1, 1]) {
    const fighter = ledgeTestFighter(Character.archer, side);
    const target = createFighter(Character.rifleman, f32(side * 470.0), side);
    const world = testWorld(fighter, target);
    const input = controls();
    catchTestLedge(fighter, input);
    advanceSolo(fighter, 0, input, 0.0);
    input.getupAttackPressed = true;
    advanceSolo(fighter, 0, input, 0.0);
    assertEquals(fighter.attack.style, AttackStyle.ledgeAttack);
    for (let tick = 1; tick <= attackStartupFrames(AttackStyle.ledgeAttack) - 1; tick++) {
      advanceSolo(fighter, 0, input, 0.0);
      resolveAttacks(world);
      assertEquals(target.status.damage, 0.0);
    }
    advanceSolo(fighter, 0, input, 0.0);
    resolveAttacks(world);
    assertEquals(target.status.damage, 7.0);
    resolveAttacks(world);
    assertEquals(target.status.damage, 7.0);
    fighter.launch.hitlag = 0;
    fighter.attack.frame = 19;
    assertEquals(attackPhase(fighter), AttackPhase.recovery);
  }
});

test("ledge hits and grabs interrupt, and a respawn clears ledge ownership", () => {
  for (const phase of LEDGE_PHASES) {
    for (let mode = 0; mode <= 2; mode++) {
      const fighter = ledgeTestFighter(Character.archer, -1);
      const input = controls();
      catchTestLedge(fighter, input);
      fighter.ledge.state = phase;
      fighter.ledge.intangible = 0;
      if (mode < 2) {
        const attacker = createFighter(Character.rifleman, -570.0, -1);
        const world = testWorld(attacker, fighter);
        attacker.motion.grounded = true;
        const style = mode === 0 ? AttackStyle.downSmash : AttackStyle.grab;
        testBeginAttacks(world, style, undefined);
        attacker.attack.frame = attackStartupFrames(style);
        resolveAttacks(world);
        if (mode === 1 && phase === LedgeState.hang) {
          assertEquals(fighter.ledge.state, LedgeState.hang);
          assertEquals(fighter.grab.grabbedFrames, 0);
          respawnFighter(soloWorld(fighter), 0, 0.0);
          continue;
        }
        assertEquals(fighter.ledge.state, LedgeState.none);
        assertEquals(fighter.ledge.side, 0);
        assertEquals(fighter.ledge.frame, 0);
        assertEquals(fighter.ledge.intangible, 0);
        assertEquals(fighter.ledge.regrab, LEDGE_REGRAB_FRAMES);
        if (mode === 0) assertGreaterThan(fighter.launch.hitstun, 0);
        else assertEquals(fighter.grab.grabbedFrames, grabHoldFrames(fighter.status.damage));
      } else {
        fighter.motion.z = -421.0;
        advanceSolo(fighter, 0, input, 0.0);
        assertEquals(fighter.status.stocks, 2);
        assertEquals(fighter.ledge.state, LedgeState.none);
        assertEquals(fighter.ledge.regrab, 0);
      }
      respawnFighter(soloWorld(fighter), 0, 0.0);
      assertEquals(fighter.ledge.state, LedgeState.none);
      assertEquals(fighter.ledge.serial, 0);
      assertEquals(fighter.ledge.regrab, 0);
    }
  }
});

test("the ledge release regrab cooldown expires after thirty unfrozen ticks", () => {
  const fighter = ledgeTestFighter(Character.archer, -1);
  const input = controls();
  catchTestLedge(fighter, input);
  advanceSolo(fighter, 0, input, 0.0);
  input.ledgeVerticalPressed = -1;
  advanceSolo(fighter, 0, input, 0.0);
  input.ledgeVerticalPressed = 0;
  for (let tick = 1; tick <= LEDGE_REGRAB_FRAMES; tick++) {
    fighter.motion.x = -620.0;
    fighter.motion.z = -80.0;
    fighter.motion.vz = -2.0;
    fighter.motion.deltaZ = -2.0;
    catchTestLedge(fighter, input);
    assertEquals(fighter.ledge.state, LedgeState.none);
    advanceSolo(fighter, 0, input, 0.0);
  }
  assertEquals(fighter.ledge.regrab, 0);
  catchTestLedge(fighter, input);
  assertEquals(fighter.ledge.state, LedgeState.hang);
  assertEquals(fighter.ledge.serial, 2);
});

test("ledge protection blocks strikes until it expires, and a grab never catches the hang", () => {
  for (const style of [AttackStyle.downSmash, AttackStyle.grab]) {
    const fighter = ledgeTestFighter(Character.archer, -1);
    const attacker = createFighter(Character.rifleman, -570.0, -1);
    const world = testWorld(attacker, fighter);
    attacker.motion.grounded = true;
    const input = controls();
    catchTestLedge(fighter, input);
    testBeginAttacks(world, style, undefined);
    attacker.attack.frame = attackStartupFrames(style);
    resolveAttacks(world);
    assertEquals(fighter.ledge.state, LedgeState.hang);
    assertEquals(fighter.status.damage, 0.0);
    assertEquals(fighter.grab.grabbedFrames, 0);
    for (let tick = 1; tick <= LEDGE_INTANGIBLE_FRAMES; tick++) advanceSolo(fighter, 0, input, 0.0);
    resolveAttacks(world);
    if (style === AttackStyle.downSmash) {
      assertEquals(fighter.ledge.state, LedgeState.none);
      assertGreaterThan(fighter.status.damage, 0.0);
    } else {
      assertEquals(fighter.ledge.state, LedgeState.hang);
      assertEquals(fighter.grab.grabbedFrames, 0);
    }
  }
});
