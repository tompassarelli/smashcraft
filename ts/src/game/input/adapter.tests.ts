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
import { actionFor, decodeBindings, encodeBindings, presetBindings, rebind } from "./keyBindings";
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

test("Z hold lengths match quick-release jump height and takeoff frame, even with jump held [spec #321]", () => {
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

test("Tilt selects neutral horizontal specials and faces the held direction on keyboard and pad [repro #326]", () => {
  for (const keyboard of [false, true]) for (const tilt of [false, true]) {
    for (const x of [-1, 0, 1] as const) for (const z of [-1, 0, 1] as const) {
      const f = fixture();
      f.fighter.motion.grounded = true;
      f.fighter.motion.surface = 0;
      f.fighter.facing = x === -1 ? 1 : -1;
      const held = maskOf(Action.special) | (tilt ? maskOf(Action.walk) : 0)
        | (x === -1 ? maskOf(Action.moveLeft) : x === 1 ? maskOf(Action.moveRight) : 0)
        | (z === -1 ? maskOf(Action.moveDown) : z === 1 ? maskOf(Action.moveUp) : 0);
      if (keyboard) {
        const capture = keyboardCapture();
        sampleKeys(capture, held);
        f.adapt(capture.row, 1);
      } else f.adapt({ held, pressed: maskOf(Action.special), axisX: x * 127, axisZ: z * 127, specialX: x, specialZ: z }, 1);
      startFighterSpecial(f.fighter, 0, 0, f.input);
      const wanted = z > 0 ? SpecialAction.riflemanRecovery : z < 0 ? SpecialAction.riflemanTrap
        : x !== 0 && !tilt ? SpecialAction.riflemanBear : SpecialAction.riflemanBlaster;
      const label = `${keyboard ? "keyboard" : "pad"} tilt ${tilt} x ${x} z ${z}`;
      assertEquals(f.fighter.special.action, wanted, label);
      if (z === 0 && x !== 0) assertEquals(f.fighter.facing, x, `${label} facing`);
    }
  }
});

test("LT and keyboard 9 or custom 0 raise the lightest shield, larger and weaker than RT [spec docs/melee-analog-shield.md]", () => {
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

test("the helper's left trigger key raises light shield with the saved custom profile, not jump [repro #205]", () => {
  const old = presetBindings("custom");
  assertTrue(rebind(old, Action.lightShield, 1, undefined));
  const bindings = assertDefined(decodeBindings(`K4${encodeBindings(old).slice(2)}`));
  const keys = playerKeys();
  assertEquals(pressKey(keys, 84, bindings), Action.lightShield);
  const capture = keyboardCapture();
  assertTrue(sampleKeys(capture, heldActions(keys)));
  assertEquals(capture.row.triggerLeft, 77);
  const light = fixture();
  light.adapt(capture.row, 1);
  assertFalse(light.input.jumpHeld);
  assertFalse(light.input.jumpPressed);
  advanceSolo(light.fighter, 0, light.input, 0.0);
  assertTrue(light.fighter.shield.raised);
  assertEquals(light.fighter.shield.strength, analogShieldStrength(77));
});

test("digital taps become movement without confusing C-stick down [spec docs/delivery-goal.md]", () => {
  const f = fixture();
  f.adapt({ pressed: maskOf(Action.moveLeft, Action.smashDown), released: maskOf(Action.moveLeft) }, 1);
  assertEquals(f.input.direction, -1);
  assertEquals(f.input.verticalDirection, 0);
  assertEquals(f.input.cStickZ, 0);
  assertFalse(f.input.down);
  assertFalse(f.input.attackRequested);
  f.adapt({ held: maskOf(Action.smashDown), pressed: maskOf(Action.smashDown) }, 2);
  assertEquals(f.input.direction, 0);
  assertEquals(f.input.verticalDirection, 0);
  assertEquals(f.input.cStickZ, -1);
  assertFalse(f.input.down);
  assertEquals(f.take(2).style, 3);
});

test("analog axes remain usable without keyboard action bits [spec docs/melee-analog-shield.md]", () => {
  const f = fixture();
  f.adapt({ axisX: -63, axisZ: 91 }, 1);
  assertEquals(f.input.direction, -1);
  assertEquals(f.input.verticalDirection, 1);
  f.adapt({ triggerLeft: 1 }, 2);
  assertFalse(f.input.shield);
  f.adapt({ triggerLeft: 77 }, 3);
  assertTrue(f.input.shield);
});

test("attack and jump share the exact frame and C-stick priority wins [spec docs/gameplay-design.md]", () => {
  const f = fixture();
  f.adapt({ held: maskOf(Action.jump, Action.attack), pressed: maskOf(Action.jump, Action.attack, Action.smashRight), axisX: 127 }, 18);
  assertTrue(f.input.jumpPressed);
  assertTrue(f.input.jumpHeld);
  assertTrue(f.input.attackPressed);
  assertEquals(assertDefined(f.attacks.pending).frame, 18);
  const command = f.take(18);
  assertEquals(command.style, 4);
  assertEquals(command.facing, 1);
});

test("shield attack becomes grab and trigger presses retain dodge and tech intent [reference]", () => {
  const f = fixture();
  f.fighter.shield.raised = true;
  f.adapt({ held: maskOf(Action.attack, Action.leftTrigger), pressed: maskOf(Action.attack, Action.leftTrigger), axisX: -127, triggerLeft: 255, dodgeX: -1 }, 4);
  assertTrue(f.input.shield);
  assertTrue(f.input.techPressed);
  assertTrue(f.input.airDodgePressed);
  assertEquals(f.input.dodgeX, -1);
  assertEquals(f.take(4).style, 5);
});

test("special releases preserve press direction and leave neutral turnaround to simulation [reference]", () => {
  const f = fixture(Character.demonHunter);
  f.fighter.motion.grounded = false;
  const downSpecial: RowFields = { pressed: maskOf(Action.special), released: maskOf(Action.moveDown), specialZ: -1 };
  f.adapt(downSpecial, 1);
  assertEquals(f.input.direction, 0);
  assertTrue(f.input.specialPressed);
  assertEquals(f.input.specialZ, -1);
  assertTrue(f.input.getupAttackPressed);
  // Melee's down and ledge attacks take any A or B press: melee:src/melee/ft/kinds/ftCommon/ftCo_DownAttack.c, ftCo_CliffAttack.c.
  const rifleman = fixture(Character.rifleman);
  rifleman.adapt(downSpecial, 2);
  assertTrue(rifleman.input.getupAttackPressed);
  f.fighter.motion.turnaroundSide = -1;
  f.fighter.motion.turnaroundAge = 0;
  f.adapt({ pressed: maskOf(Action.special) }, 3);
  assertEquals(f.input.specialX, 0);
  assertEquals(f.input.specialZ, 0);
});

test("walking selects tilts and same-frame opposing smashes cancel facing [spec docs/gameplay-design.md]", () => {
  const f = fixture();
  f.adapt({ held: maskOf(Action.attack, Action.walk, Action.moveUp), pressed: maskOf(Action.attack, Action.smashLeft, Action.smashRight), axisZ: 127 }, 10);
  assertTrue(f.input.walking);
  const command = f.take(10);
  assertEquals(command.style, 4);
  assertEquals(command.facing, 0);
});
