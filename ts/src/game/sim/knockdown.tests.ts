import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { collectDamageContact } from "./contacts";
import { Character, ContactKind, DownState } from "./codes";
import { isTumbling } from "./conditions";
import { DOWN_BOUND_FRAMES, DOWN_WAIT_FRAMES } from "./down";
import { type Fighter, createFighter } from "./fighter";
import { DIAGONAL_UNIT } from "./knockback";
import type { Controls } from "./roster";
import { advanceSolo, contactBatch, controls, hitEffect, seedTechWindow, testWorld } from "./testWorld";

function landTumbling(fighter: Fighter, input: Readonly<Controls>): void {
  fighter.motion.grounded = false;
  fighter.motion.z = 1.0;
  fighter.motion.vz = -2.0;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 1;
  advanceSolo(fighter, 0, input, 0.0);
  assertEquals(fighter.down.state, DownState.bound);
}

// DownBound accepts get-up attacks pressed fewer than common +0x24C = 60 frames ago (ftCo_DownBound_Anim, ftCo_80098400).

const MELEE_BOUND_ATTACK_PRESS_AGE_LIMIT = 60;

test("a get-up attack pressed during the bound starts as it ends, ahead of a held roll [reference]", () => {
  assertGreaterThan(MELEE_BOUND_ATTACK_PRESS_AGE_LIMIT, DOWN_BOUND_FRAMES);
  for (const pressFrame of [1, DOWN_BOUND_FRAMES - 1]) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    landTumbling(fighter, controls({ getupAttackPressed: true }));
    for (let frame = 1; frame < DOWN_BOUND_FRAMES; frame++) {
      advanceSolo(fighter, 0, controls({ getupAttackPressed: frame === pressFrame, direction: frame === DOWN_BOUND_FRAMES - 1 ? -1 : 0 }), 0.0);
      assertEquals(fighter.down.state, DownState.bound);
    }
    advanceSolo(fighter, 0, controls({ direction: -1 }), 0.0);
    assertEquals(fighter.down.state, DownState.attack);
  }
  const landingPressOnly = createFighter(Character.rifleman, 0.0, 1);
  landTumbling(landingPressOnly, controls({ getupAttackPressed: true }));
  for (let frame = 1; frame <= DOWN_BOUND_FRAMES; frame++) advanceSolo(landingPressOnly, 0, controls(), 0.0);
  assertEquals(landingPressOnly.down.state, DownState.wait);
});

const analog = (x: number, z: number) => controls({ diStickValid: true, diStickX: x, diStickZ: z });

test("get-up rolls and stands follow Melee's stick tilt and angle [reference]", () => {
  // Common +0x248/+0x244 = 0.2 tilt, +0x020 = 50 degrees above horizontal (ftCo_Down.c ftCo_Down_CheckInput, ftCo_DownStand.c).
  const cases: readonly (readonly [number, number, DownState, number])[] = [
    [0.19999998807907104, 0.0, DownState.wait, 0],
    [0.20000000298023224, 0.0, DownState.roll, 1],
    [-0.5, -0.5, DownState.roll, -1],
    [0.6560590267181396, 0.7547096014022827, DownState.roll, 1],
    [-0.6293203830718994, 0.7771459817886353, DownState.stand, 0],
    [0.0, 0.20000000298023224, DownState.stand, 0],
    [0.0, 0.19999998807907104, DownState.wait, 0],
    [0.0, -1.0, DownState.wait, 0],
  ];
  for (const [x, z, state, direction] of cases) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    fighter.down.state = DownState.wait;
    fighter.down.waitRemaining = DOWN_WAIT_FRAMES;
    advanceSolo(fighter, 0, analog(x, z), 0.0);
    assertEquals(fighter.down.state, state);
    assertEquals(fighter.down.direction, direction);
  }
});

test("a floor tech rolls only past Melee's sideways tilt [reference]", () => {
  // Common +0x254 = 0.2 (ftCo_PassiveStand.c ftCo_80098928).
  for (const [x, state] of [[0.19999998807907104, DownState.tech], [-0.20000000298023224, DownState.techRoll]] as const) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    seedTechWindow(fighter, 10);
    fighter.motion.grounded = false;
    fighter.motion.z = 1.0;
    fighter.motion.vz = -2.0;
    fighter.down.state = DownState.tumble;
    advanceSolo(fighter, 0, analog(x, 0.0), 0.0);
    assertEquals(fighter.down.state, state);
  }
});

test("tumble ends only on a fresh sideways flick past Melee's threshold [reference]", () => {
  // Common +0x210 = 0.8 on the frame the stick crosses +0x008 = 0.25 (+0x214 = 1; ftCo_DamageFall.c ftCo_DamageFall_IASA).
  const sequences: readonly (readonly [readonly Controls[], boolean])[] = [
    [[analog(0.0, 0.0), analog(-0.800000011920929, 0.0)], true],
    [[analog(0.0, 0.0), analog(0.7999999523162842, 0.0)], false],
    [[analog(0.30000001192092896, 0.0), analog(0.8999999761581421, 0.0)], false],
    [[controls(), controls({ direction: -1, verticalDirection: 1 })], false],
    [[controls(), controls({ direction: 1 })], true],
  ];
  for (const [inputs, exits] of sequences) {
    const fighter = createFighter(Character.rifleman, 0.0, 1);
    fighter.motion.grounded = false;
    fighter.motion.surface = undefined;
    fighter.motion.z = 400.0;
    fighter.down.state = DownState.tumble;
    for (const input of inputs) advanceSolo(fighter, 0, input, 0.0);
    assertEquals(isTumbling(fighter), !exits);
  }
});

test("a jab reset compares the damage summed over the frame's contacts [reference]", () => {
  // melee:src/melee/ft/kinds/ftCommon/ftCo_DownDamage.c:290 tests the frame's summed percentTemp (ftcoll.c:370) against +0x428 = 7.
  for (const [contacts, reset] of [[1, true], [2, false]] as const) {
    const attacker = createFighter(Character.rifleman, 0.0, 1);
    const lying = createFighter(Character.rifleman, 60.0, -1);
    lying.down.state = DownState.wait;
    lying.down.waitRemaining = DOWN_WAIT_FRAMES;
    const world = testWorld(attacker, lying);
    const weak = hitEffect(4.0, 100.0, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
    contactBatch(world, () => {
      for (let index = 0; index < contacts; index++) collectDamageContact(world, 0, 1, weak, 1, ContactKind.launch, true, undefined, false);
    });
    assertEquals(lying.down.state, reset ? DownState.damage : DownState.none);
  }
});
