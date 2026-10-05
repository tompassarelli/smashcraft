// Retail NTSC 1.02 analog shield observations; see smashcraft:docs/melee-analog-shield.md.
import { assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { roundToFloat32 } from "waygate/src/sim/binary32";
import { f32 } from "waygate/src/sim/f32";
import { Character, ContactKind } from "./codes";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "./contacts";
import { createFighter } from "./fighter";
import {
  SHIELD_MIN_HOLD_FRAMES,
  SHIELD_RELEASE_LAG_FRAMES,
  analogShieldStrength,
  shieldContactDamage,
  shieldDrain,
  shieldPushback,
  shieldSizeMultiplier,
  shieldstunDuration,
} from "./shield";
import { advance } from "./step";
import { reset } from "./stocks";
import { advanceSolo, controls, soloWorld, testWorld } from "./testWorld";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";

const PRESSURES = [0.4000000059604645, 0.0028011202812194824, 0.28851544857025146, 0.6918767690658569, 1.0];
const HEALTHS = [60.0, 30.0, 1.0];
const DAMAGES = [3.0, 10.0, 30.0];

test("observed retail shield drain", () => {
  const expected = [
    [59.879600524902344, 29.879600524902344, 0.8795999884605408],
    [59.98525619506836, 29.985254287719727, 0.9852548837661743],
    [59.90925598144531, 29.90925407409668, 0.9092549085617065],
    [59.80195999145508, 29.801959991455078, 0.8019607663154602],
    [59.720001220703125, 29.719999313354492, 0.7200000286102295],
  ];
  PRESSURES.forEach((pressure, row) => {
    HEALTHS.forEach((health, column) => {
      assertEquals(roundToFloat32(f32(health - shieldDrain(pressure))), expected[row]![column]!, `pressure ${pressure} health ${health}`);
    });
  });
});

test("observed retail shield stun", () => {
  const expected = [
    [5.105000019073486, 12.350000381469727, 33.05000305175781],
    [6.266806602478027, 16.222688674926758, 44.668067932128906],
    [5.431092262268066, 13.436975479125977, 36.31092834472656],
    [4.251260757446289, 9.504201889038086, 24.512605667114258],
    [3.3500001430511475, 6.5, 15.5],
  ];
  PRESSURES.forEach((pressure, row) => {
    DAMAGES.forEach((damage, column) => {
      assertEquals(shieldstunDuration(damage, pressure), expected[row]![column]!, `pressure ${pressure} damage ${damage}`);
    });
  });
});

test("observed retail shield size", () => {
  const expected = [
    [0.8300000429153442, 0.49000000953674316, 0.1613333374261856],
    [0.9988095164299011, 0.574404776096344, 0.16414682567119598],
    [0.8773809671401978, 0.5136904716491699, 0.16212302446365356],
    [0.7059524059295654, 0.42797619104385376, 0.15926587581634521],
    [0.5750000476837158, 0.36250001192092896, 0.15708333253860474],
  ];
  PRESSURES.forEach((pressure, row) => {
    HEALTHS.forEach((health, column) => {
      assertEquals(shieldSizeMultiplier(health, pressure), expected[row]![column]!, `pressure ${pressure} health ${health}`);
    });
  });
});

test("observed retail shield damage", () => {
  // By pressure, then health, then damage.
  const expected = [
    [[57.540000915527344, 51.79999923706055, 35.400001525878906], [27.540000915527344, 21.799999237060547, 5.399999618530273], [-1.4600000381469727, -7.199999809265137, -23.600000381469727]],
    [[57.30168151855469, 51.0056037902832, 33.016807556152344], [27.301681518554688, 21.005603790283203, 3.0168075561523438], [-1.6983191967010498, -7.994397163391113, -25.983192443847656]],
    [[57.47311019897461, 51.577030181884766, 34.73109436035156], [27.47311019897461, 21.577030181884766, 4.73109245300293], [-1.526890754699707, -7.422968864440918, -24.26890754699707]],
    [[57.715126037597656, 52.38375473022461, 37.15126037597656], [27.715126037597656, 22.38375473022461, 7.1512603759765625], [-1.2848739624023438, -6.616246223449707, -21.848739624023438]],
    [[57.900001525878906, 53.0, 39.0], [27.899999618530273, 23.0, 9.0], [-1.0999999046325684, -6.0, -20.0]],
  ];
  PRESSURES.forEach((pressure, row) => {
    HEALTHS.forEach((health, healthIndex) => {
      DAMAGES.forEach((damage, damageIndex) => {
        assertEquals(roundToFloat32(f32(health - shieldContactDamage(damage, pressure))), expected[row]![healthIndex]![damageIndex]!,
          `pressure ${pressure} health ${health} damage ${damage}`);
      });
    });
  });
});

test("observed retail shield pushback", () => {
  const expected = [
    [0.6126000285148621, 1.4820001125335693, 2.0],
    [0.7520168423652649, 1.9467227458953857, 2.0],
    [0.6517311334609985, 1.612437129020691, 2.0],
    [0.5101513266563416, 1.140504240989685, 2.0],
    [0.4020000398159027, 0.7800000905990601, 1.8600001335144043],
  ];
  PRESSURES.forEach((pressure, row) => {
    DAMAGES.forEach((damage, column) => {
      assertEquals(shieldPushback(damage, pressure), f32(expected[row]![column]! * WORLD_UNITS_PER_MELEE_UNIT), `pressure ${pressure} damage ${damage}`);
    });
  });
});

test("observed retail shield pressure", () => {
  assertEquals(analogShieldStrength(77), 0.0028011202812194824);
  assertEquals(analogShieldStrength(128), 0.28851544857025146);
  assertEquals(analogShieldStrength(200), 0.6918767690658569);
  assertEquals(analogShieldStrength(255), 1.0);
});

test("a light shield enters, drains, changes pressure and keeps its minimum hold", () => {
  const f = createFighter(Character.archer, 0.0, 1);
  const input = controls({ shield: true, shieldStrength: analogShieldStrength(128) });
  advanceSolo(f, 0, input, 0.0);
  assertTrue(f.shield.raised);
  assertEquals(f.shield.energy, 60.0);
  assertEquals(f.shield.strength, input.shieldStrength);
  advanceSolo(f, 0, input, 0.0);
  assertEquals(f.shield.energy, 59.90925598144531);
  input.shieldStrength = analogShieldStrength(77);
  advanceSolo(f, 0, input, 0.0);
  assertEquals(f.shield.strength, input.shieldStrength);
  input.shield = false;
  const heldStrength = f.shield.strength;
  while (f.shield.heldFrames < SHIELD_MIN_HOLD_FRAMES) {
    advanceSolo(f, 0, input, 0.0);
    assertTrue(f.shield.raised);
    assertEquals(f.shield.strength, heldStrength);
  }
  advanceSolo(f, 0, input, 0.0);
  assertFalse(f.shield.raised);
  assertEquals(f.shield.releaseLag, SHIELD_RELEASE_LAG_FRAMES);
  reset(soloWorld(f), 0, 0.0);
  assertEquals(f.shield.strength, 1.0);
});

test("a light shield contact uses its strength and freezes it through stun", () => {
  const owner = createFighter(Character.archer, -100.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(owner, target);
  target.shield.raised = true;
  target.shield.strength = analogShieldStrength(128);
  beginDamageContacts();
  queueDamageContact(world, 0, 1, { damage: 10.0, growth: 100.0, base: 20.0, launchX: 1.0, launchZ: 1.0, electric: false }, 1, ContactKind.launch, true, undefined);
  finishDamageContacts(world);
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.shield.energy, 51.577030181884766);
  assertEquals(target.shield.stun, 13);
  assertEquals(target.shield.pushbackX, f32(1.612437129020691 * WORLD_UNITS_PER_MELEE_UNIT));
  const { strength, energy } = target.shield;
  const input = controls({ shield: true, shieldStrength: 1.0 });
  while (target.launch.hitlag > 1 || target.shield.stun > 0) {
    advance(world, 1, 0, input, 0.0);
    assertEquals(target.shield.strength, strength);
    assertEquals(target.shield.energy, energy);
  }
});
