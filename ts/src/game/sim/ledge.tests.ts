
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, DownState, LedgeState, SpecialAction } from "./codes";
import { type Fighter } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { AIR_DODGE_ANIMATION_FRAMES } from "./jumpsAndDodges";
import { ledgeIntangibleFrames, LEDGE_INTANGIBLE_FRAMES, ledgeCatchBox, ledgeSnap, resolveLedges } from "./ledge";
import type { Controls } from "./roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { BODY_HALF_WIDTH } from "./surfaces";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { LEDGE_REGRAB_FRAMES, clearLedge } from "./transitions";

function ledgeTestFighter(character: Character, side: number): Fighter {
  const fighter = createReferenceFighter(character, f32(side * 620.0), -side);
  fighter.motion.grounded = false;
  fighter.motion.z = -80.0;
  fighter.motion.vz = -2.0;
  fighter.motion.deltaZ = -2.0;
  fighter.jump.remaining = 0;
  return fighter;
}

function catchTestLedge(fighter: Fighter, input: Readonly<Controls>): void {
  resolveLedges(testWorld(fighter, createReferenceFighter(Character.rifleman, 0.0, 1)), 0, [input, controls()]);
}

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

test("each fighter catches with its reference fighter's NTSC 1.02 ledge snap data [k4 reference melee]", () => {
  // Ledge box ftData x44 +0x10/+0x14/+0x18: PlFx.dat/PlFc.dat = 11,13,9; PlCa.dat = 9,17,11 (ftData_x44_t).

  const references = [
    [Character.sylvanas, 11.0, 13.0, 9.0],
    [Character.rifleman, 11.0, 13.0, 9.0],
    [Character.demonHunter, 9.0, 17.0, 11.0],
  ] as const;
  for (const [character, x, y, height] of references) {
    const snap = ledgeSnap(character);
    assertEquals(snap.x, x);
    assertEquals(snap.y, y);
    assertEquals(snap.height, height);

    const box = ledgeCatchBox(character);
    assertEquals(BODY_HALF_WIDTH, 2.0);
    assertEquals(box.reach, f32(f32(x + 2.0) * 6.0));
    assertEquals(box.lowest, f32(f32(y - f32(height * 0.5)) * 6.0));
    assertEquals(box.highest, f32(f32(y + f32(height * 0.5)) * 6.0));
  }
  assertEquals(ledgeCatchBox(Character.sylvanas).reach, 78.0);
  assertEquals(ledgeCatchBox(Character.sylvanas).lowest, 51.0);
  assertEquals(ledgeCatchBox(Character.sylvanas).highest, 105.0);
  assertEquals(ledgeCatchBox(Character.demonHunter).reach, 66.0);
  assertEquals(ledgeCatchBox(Character.demonHunter).lowest, 69.0);
  assertEquals(ledgeCatchBox(Character.demonHunter).highest, 135.0);
});

test("the catch box's edges are strict for every fighter and side [k4 reference melee]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    const { reach, lowest, highest } = ledgeCatchBox(character);
    const middle = f32(f32(lowest + highest) * 0.5);
    for (const side of [-1, 1]) {

      assertTrue(catchesAfterMovement(character, side, f32(reach - 1.0), f32(middle - 1.0), f32(reach - 1.0), middle));
      assertFalse(catchesAfterMovement(character, side, reach, f32(middle - 1.0), reach, middle));
      assertTrue(catchesAfterMovement(character, side, 1.0, f32(middle - 1.0), 1.0, middle));
      assertFalse(catchesAfterMovement(character, side, 0.0, f32(middle - 1.0), 0.0, middle));

      assertFalse(catchesAfterMovement(character, side, 20.0, f32(lowest - 2.0), 20.0, lowest));
      assertTrue(catchesAfterMovement(character, side, 20.0, f32(lowest - 1.0), 20.0, f32(lowest + 1.0)));
      assertFalse(catchesAfterMovement(character, side, 20.0, highest, 20.0, f32(highest + 2.0)));
      assertTrue(catchesAfterMovement(character, side, 20.0, f32(highest - 1.0), 20.0, f32(highest + 1.0)));
    }
  }
});

test("the catch box sweeps the frame's movement, and only a downward movement catches [k4 reference melee]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    const { reach, lowest, highest } = ledgeCatchBox(character);
    const middle = f32(f32(lowest + highest) * 0.5);
    for (const side of [-1, 1]) {

      assertTrue(catchesAfterMovement(character, side, 20.0, f32(lowest - 10.0), 20.0, f32(highest + 10.0)));
      assertTrue(catchesAfterMovement(character, side, f32(reach - 1.0), f32(middle - 1.0), f32(reach + 10.0), middle));
      assertFalse(catchesAfterMovement(character, side, f32(reach + 10.0), f32(middle - 1.0), f32(reach + 10.0), middle));

      assertFalse(catchesAfterMovement(character, side, 20.0, f32(middle + 1.0), 20.0, middle));
      assertFalse(catchesAfterMovement(character, side, 20.0, middle, 20.0, middle));
    }
  }
});

test("falling, running up specials, helpless, post-dodge and tumbling fighters catch; other specials, aerials, air dodges and hitstun don't [k4 reference melee]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    const states: readonly (readonly [boolean, (f: Fighter) => void])[] = [
      [true, () => undefined],
      [true, (f) => (f.special.fall = true)],
      [true, (f) => (f.down.state = DownState.tumble)],
      [true, (f) => (f.dodge.airUsed = true)],
      [false, (f) => {
        f.dodge.airDodging = true;
        f.dodge.airFrame = AIR_DODGE_ANIMATION_FRAMES - 1;
      }],
      [false, (f) => {
        f.attack.style = AttackStyle.neutralAir;
        f.attack.cooldown = 1;
      }],
      [true, (f) => {
        f.special.action = character === Character.sylvanas ? SpecialAction.heroUp : character === Character.rifleman ? SpecialAction.riflemanRecovery : SpecialAction.demonHunterWingAscent;
        f.special.lockFrames = 1;
        f.attack.cooldown = 1;
      }],
      [false, (f) => {
        f.special.action = SpecialAction.heroSide;
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
        assertFalse(fighter.dodge.airUsed);
        assertFalse(fighter.special.fall);
      }
    }
  }
});

test("only a full down passes ledges; a slight downward tilt still catches [k4 reference melee-decomp]", () => {
  // Melee refuses ledge catches at stick y -0.66 (ftCliffCommon_80081298, common +0x480).

  const fighter = ledgeTestFighter(Character.sylvanas, -1);
  const input = controls();
  input.verticalDirection = -1;
  catchTestLedge(fighter, input);
  assertEquals(fighter.ledge.state, LedgeState.hang);
});

test("ledge contention uses distance, not argument order, and the owner hogs [k3 measure docs/physics.md]", () => {
  for (const reversed of [false, true]) {
    const near = ledgeTestFighter(Character.sylvanas, -1);
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

test("the ledge release regrab cooldown expires after thirty unfrozen ticks [k4 reference melee]", () => {
  const fighter = ledgeTestFighter(Character.sylvanas, -1);
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

test("each regrab without touching the stage shortens ledge intangibility until none is left [k3 measure #386]", () => {
  const fighter = ledgeTestFighter(Character.rifleman, 1);
  let previous = LEDGE_INTANGIBLE_FRAMES + 1;
  let reachedNone = false;
  for (let grab = 0; grab < 6; grab++) {
    fighter.ledge.regrab = 0;
    fighter.motion.grounded = false;
    fighter.motion.x = f32(surfaceRight(0, 0, 0) + 40.0);
    fighter.motion.z = f32(surfaceZ(0, 0, 0) - 80.0);
    fighter.motion.deltaX = 0.0;
    fighter.motion.deltaZ = -2.0;
    fighter.facing = -1;
    catchTestLedge(fighter, controls());
    assertEquals(fighter.ledge.state, LedgeState.hang);
    assertEquals(fighter.ledge.intangible, ledgeIntangibleFrames(grab));
    assertTrue(fighter.ledge.intangible < previous || fighter.ledge.intangible === 0);
    previous = fighter.ledge.intangible;
    reachedNone = reachedNone || fighter.ledge.intangible === 0;
    clearLedge(fighter);
  }
  assertTrue(reachedNone);
  assertEquals(ledgeIntangibleFrames(0), LEDGE_INTANGIBLE_FRAMES);
});

