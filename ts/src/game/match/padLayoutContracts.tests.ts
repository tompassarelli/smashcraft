import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, GroundAction } from "../sim/codes";
import { AIR_DODGE_LANDING_LAG } from "../sim/down";
import { createReferenceFighter } from "../sim/referenceRig";
import { type Pad, type PadMatch, padMatch, playPads } from "./helperPads";
import { ROSTER_MANA } from "../sim/mana";
import { testMatch } from "./testMatch";
import { f32 } from "wisp/src/sim/f32";

function padRun(): { readonly run: PadMatch; readonly fighter: ReturnType<typeof createReferenceFighter> } {
  const match = testMatch(3, Character.sylvanas);
  const fighter = createReferenceFighter(Character.sylvanas, -300.0, 1);
  match.world.fighters[0] = fighter;
  match.world.fighters[1] = createReferenceFighter(Character.sylvanas, 300.0, -1);
  return { run: padMatch(match, "pad-layout"), fighter };
}

function hopRise(press: Pad, heldFrames: number): number {
  const { run, fighter } = padRun();
  for (let frame = 0; frame < 4; frame++) playPads(run, {}, {});
  const ground = fighter.motion.z;
  let apex = ground;
  for (let frame = 0; frame < 80; frame++) {
    playPads(run, frame < heldFrames ? press : {}, {});
    if (fighter.motion.z > apex) apex = fighter.motion.z;
  }
  return apex - ground;
}

test("the short-hop key held for 30 frames rises exactly as high as a tapped jump, below a held full hop [k3 measure docs/gameplay-design.md]", () => {
  const tapped = hopRise({ jump: true }, 1);
  assertEquals(hopRise({ shortHop: true }, 30), tapped);
  assertGreaterThan(hopRise({ jump: true }, 30), tapped);
});

test("shield pressed on any jump-squat frame air dodges on the first airborne frame, from the jump and short-hop keys [k3 measure docs/physics.md]", () => {
  for (const jump of [{ jump: true }, { shortHop: true }] as const) {
    for (let offset = 0; ; offset++) {
      const { run, fighter } = padRun();
      for (let frame = 0; frame < 4; frame++) playPads(run, {}, {});
      const stick = { x: f32(0.7), y: f32(-0.7) };
      playPads(run, offset === 0 ? { ...jump, ...stick, trigger: true } : { ...jump, ...stick }, {});
      const squat = fighter.jump.squat;
      assertGreaterThan(squat, 0);
      if (offset > squat) break;
      let takeoffDodged = false;
      for (let frame = 1; frame <= squat; frame++) {
        playPads(run, frame === offset ? { ...jump, ...stick, trigger: true } : { ...jump, ...stick }, {});
        if (fighter.jump.serial === 1) {
          takeoffDodged = fighter.dodge.airDodging || fighter.landing.lag === AIR_DODGE_LANDING_LAG;
          break;
        }
      }
      assertEquals(takeoffDodged ? offset : -1, offset);
    }
  }
});

test("holding the tilt button with a direction walks and attack tilts, where the same stick alone dashes [k3 measure docs/gameplay-design.md]", () => {
  const dash = padRun();
  playPads(dash.run, { x: 1.0 }, {});
  assertEquals(dash.fighter.ground.action, GroundAction.dash);
  const { run, fighter } = padRun();
  for (let frame = 0; frame < 40; frame++) {
    playPads(run, { tilt: true, x: 1.0 }, {});
    assertEquals(fighter.ground.action, GroundAction.none);
  }
  assertGreaterThan(fighter.motion.vx, 0.0);
  assertTrue(fighter.motion.vx <= fighter.tuning.physics.walkSpeed);
  playPads(run, { tilt: true, x: 1.0, attack: true }, {});
  playPads(run, { tilt: true, x: 1.0, attack: true }, {});
  assertEquals(fighter.attack.style, AttackStyle.forwardTilt);
});

test("Meter + Special and Shield + Special each spend one EX segment, Special alone spends none [k3 measure #382]", () => {
  for (const [hold, spent] of [[{ meter: true }, true], [{ trigger: true }, true], [{}, false]] as const) {
    const { run, fighter } = padRun();
    fighter.mana.points = ROSTER_MANA.max;
    for (let frame = 0; frame < 4; frame++) playPads(run, hold, {});
    playPads(run, { ...hold, special: true }, {});
    assertEquals(fighter.mana.points, spent ? ROSTER_MANA.max - ROSTER_MANA.exCost : ROSTER_MANA.max);
  }
});

test("tom layout: grounded right stick tilts where the default right stick smashes [k3 measure docs/gameplay-design.md]", () => {
  for (const [rightStickTilts, cx, cy, expected] of [
    [true, 1.0, 0.0, AttackStyle.forwardTilt], [true, 0.0, 1.0, AttackStyle.upTilt], [true, 0.0, -1.0, AttackStyle.downTilt],
    [false, 1.0, 0.0, AttackStyle.forwardSmash],
  ] as const) {
    const { run, fighter } = padRun();
    for (let frame = 0; frame < 4; frame++) playPads(run, {}, {});
    playPads(run, { cx, cy, rightStickTilts }, {});
    playPads(run, { cx, cy, rightStickTilts }, {});
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.attack.style, expected);
  }
});

test("tom layout: airborne right stick throws the matching aerial [k3 measure docs/gameplay-design.md]", () => {
  for (const [cx, cy, expected] of [
    [1.0, 0.0, AttackStyle.forwardAir], [-1.0, 0.0, AttackStyle.backAir], [0.0, 1.0, AttackStyle.upAir], [0.0, -1.0, AttackStyle.downAir],
  ] as const) {
    const { run, fighter } = padRun();
    for (let frame = 0; frame < 4; frame++) playPads(run, {}, {});
    for (let frame = 0; frame < 20 && fighter.motion.grounded; frame++) playPads(run, { jump: true }, {});
    for (let frame = 0; frame < 8; frame++) playPads(run, {}, {});
    assertTrue(!fighter.motion.grounded);
    playPads(run, { cx, cy, rightStickTilts: true }, {});
    playPads(run, { cx, cy, rightStickTilts: true }, {});
    assertEquals(fighter.attack.style, expected);
  }
});
