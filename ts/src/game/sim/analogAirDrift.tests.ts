import { assertDefined, assertEquals, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Action, bit, maskOf } from "../input/actions";
import { adaptInput } from "../input/adapter";
import { attackBuffer } from "../input/attackBuffer";
import { type InputRow, inputRow } from "../input/inputRow";
import { keyboardCapture, sampleKeys } from "../input/keyboardCapture";
import { createFighter } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { type Character } from "./codes";
import { controls, advanceSolo } from "./testWorld";

function drift(character: Character, row: Readonly<InputRow>, frames: number) {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 1000.0;
  const input = controls();
  const attacks = attackBuffer(0);
  for (let frame = 0; frame < frames; frame++) {
    adaptInput(row, fighter, frame, input, attacks);
    advanceSolo(fighter, 0, input, 0.0);
  }
  return fighter;
}

test("half-pushed input rows drift slower than full rows and keyboard stays at full rate", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const direction of [-1, 1]) {
      const half = assertDefined(inputRow({ axisX: 63 * direction }));
      const full = assertDefined(inputRow({ axisX: 127 * direction }));
      const keyboard = keyboardCapture();
      assertTrue(sampleKeys(keyboard, bit(direction < 0 ? Action.moveLeft : Action.moveRight)));
      assertEquals(keyboard.row.axisX, full.axisX);
      for (const frames of [1, 12]) {
        const halfDrift = drift(character, half, frames);
        const fullDrift = drift(character, full, frames);
        const keyDrift = drift(character, keyboard.row, frames);
        assertGreaterThan(Math.abs(fullDrift.motion.vx), Math.abs(halfDrift.motion.vx));
        assertGreaterThan(Math.abs(fullDrift.motion.x), Math.abs(halfDrift.motion.x));
        assertEquals(keyDrift.motion.vx, fullDrift.motion.vx);
        assertEquals(keyDrift.motion.x, fullDrift.motion.x);
        if (frames === 1) assertEquals(fullDrift.motion.vx, f32(fullDrift.tuning.physics.airAcceleration * direction));
      }
      const diagonal = keyboardCapture();
      assertTrue(sampleKeys(diagonal, maskOf(direction < 0 ? Action.moveLeft : Action.moveRight, Action.moveDown)));
      const diagonalDrift = drift(character, diagonal.row, 12);
      const fullDrift = drift(character, full, 12);
      assertEquals(diagonalDrift.motion.vx, fullDrift.motion.vx);
      assertNear(diagonalDrift.motion.x, fullDrift.motion.x, 0.00009999999747378752);
    }
  }
});
