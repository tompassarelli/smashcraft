import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, SpecialAction } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { startFighterSpecial } from "../sim/specials";
import { analogShieldActive, analogShieldStrength, shieldContactDamage, shieldSizeMultiplier, shieldstunFrames } from "../sim/shield";
import { advanceSolo } from "../sim/testWorld";
import { Action, maskOf } from "./actions";
import { adaptInput } from "./adapter";
import { attackBuffer, takeAttack } from "./attackBuffer";
import { inputRow, type RowFields } from "./inputRow";
import { actionFor, presetBindings } from "./keyBindings";
import { commitEdges, keyboardCapture, sampleKeys } from "./keyboardCapture";
import { heldActions, playerKeys, pressKey } from "./playerKeys";

function fixture(character: Character = Character.rifleman, graceFrames = 0) {
  const fighter = createFighter(character, 0, 1);
  const input = neutralControls();
  const attacks = attackBuffer(graceFrames);
  return {
    fighter, input, attacks,
    adapt(fields: RowFields, frame: number) {
      adaptInput(assertDefined(inputRow(fields)), fighter, frame, input, attacks);
    },
    take(frame: number) { return assertDefined(takeAttack(attacks, frame, true)); },
  };
}

test("Z hold lengths match quick-release jump height and takeoff frame, even with jump held [k1 scenario]", () => {
  for (const character of [Character.rifleman, Character.demonHunter]) {
    for (const jumpHeld of [false, true]) {
    for (const hold of [1, 3, 10, 60]) {
      const reference = fixture(character);
      const hop = fixture(character);
      const capture = keyboardCapture();
      const keys = playerKeys();
      const bindings = presetBindings("standard");
      pressKey(keys, 90, bindings);
      assertEquals(heldActions(keys), maskOf(Action.shortHop));
      for (let frame = 1; frame <= 90; frame++) {
        sampleKeys(capture, frame <= hold ? heldActions(keys) | (jumpHeld ? maskOf(Action.jump) : 0) : 0);
        adaptInput(capture.row, hop.fighter, frame, hop.input, hop.attacks);
        commitEdges(capture);
        reference.adapt({ held: frame === 1 ? maskOf(Action.jump) : 0, pressed: frame === 1 ? maskOf(Action.jump) : 0 }, frame);
        advanceSolo(reference.fighter, 0, reference.input, -240);
        advanceSolo(hop.fighter, 0, hop.input, -240);
        assertEquals(hop.fighter.motion.z, reference.fighter.motion.z, `character ${character} hold ${hold} frame ${frame}: height`);
        assertEquals(hop.fighter.motion.grounded, reference.fighter.motion.grounded, `character ${character} hold ${hold} frame ${frame}: takeoff`);
        assertEquals(hop.fighter.jump.serial, reference.fighter.jump.serial);
      }
    }
    }
  }
});

test("LT and keyboard 9 or custom 0 raise the lightest shield, larger and weaker than RT [k4 reference melee]", () => {
  const lightRows = [assertDefined(inputRow({ held: maskOf(Action.leftTrigger), pressed: maskOf(Action.leftTrigger), triggerLeft: 77 }))];
  for (const preset of ["standard", "custom"] as const) {
    const action = assertDefined(actionFor(presetBindings(preset), preset === "standard" ? 57 : 48));
    assertEquals(action, Action.lightShield);
    const capture = keyboardCapture();
    assertTrue(sampleKeys(capture, maskOf(action)));
    assertEquals(capture.row.triggerLeft, 77);
    lightRows.push(assertDefined(inputRow(capture.row)));
  }
  assertFalse(analogShieldActive(76));
  const full = fixture();
  full.adapt({ held: maskOf(Action.rightTrigger), pressed: maskOf(Action.rightTrigger), triggerRight: 255 }, 1);
  advanceSolo(full.fighter, 0, full.input, 0.0);
  assertTrue(full.fighter.shield.raised);
  assertEquals(full.fighter.shield.strength, 1.0);
  for (const row of lightRows) {
    const light = fixture();
    light.adapt(row, 1);
    advanceSolo(light.fighter, 0, light.input, 0.0);
    assertTrue(light.fighter.shield.raised);
    assertEquals(light.fighter.shield.strength, analogShieldStrength(77));
    assertTrue(shieldSizeMultiplier(60.0, light.fighter.shield.strength) > shieldSizeMultiplier(60.0, full.fighter.shield.strength));
    assertTrue(shieldContactDamage(10.0, light.fighter.shield.strength) > shieldContactDamage(10.0, full.fighter.shield.strength));
    assertTrue(shieldstunFrames(10.0, light.fighter.shield.strength) > shieldstunFrames(10.0, full.fighter.shield.strength));
    assertTrue(light.input.techPressed);
  }
  const q = keyboardCapture();
  assertTrue(sampleKeys(q, maskOf(assertDefined(actionFor(presetBindings("standard"), 81)))));
  assertEquals(q.row.triggerLeft, 255);
});
