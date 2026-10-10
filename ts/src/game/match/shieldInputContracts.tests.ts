import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AIR_DODGE_LANDING_LAG } from "../sim/down";
import { Character } from "../sim/codes";
import { createReferenceFighter } from "../sim/referenceRig";
import { type Pad, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";
import { f32 } from "wisp/src/sim/f32";

function wavedashOutOfShield(shield: Pad, dodge: Pad): void {
  const match = testMatch(3, Character.sylvanas);
  const fighter = createReferenceFighter(Character.sylvanas, -300.0, 1);
  match.world.fighters[0] = fighter;
  match.world.fighters[1] = createReferenceFighter(Character.sylvanas, 300.0, -1);
  const run = padMatch(match, "wavedash");
  for (let frame = 1; frame <= 12; frame++) playPads(run, shield, {});
  assertTrue(fighter.shield.raised);
  playPads(run, { ...shield, jump: true }, {});
  playPads(run, { ...shield, ...dodge, jump: true, x: f32(0.7), y: f32(-0.7) }, {});
  let landed = false;
  for (let frame = 0; frame < 20 && !landed; frame++) {
    playPads(run, { ...shield, ...dodge, x: f32(0.7), y: f32(-0.7) }, {});
    landed = fighter.landing.lag === AIR_DODGE_LANDING_LAG;
  }
  assertTrue(landed);
  assertTrue(fighter.motion.grounded);
  assertEquals(Math.sign(fighter.motion.vx), 1);
}

test("holding shield, jumping and pressing Tilt down-forward wavedashes out of shield in the tom layout [k3 measure docs/play.md]", () => {
  wavedashOutOfShield({ trigger: true }, { tilt: true });
});

test("holding one trigger, jumping and pressing the other trigger down-forward wavedashes out of shield [k4 reference melee]", () => {
  for (const [held, other] of [["trigger", "rightTrigger"], ["rightTrigger", "trigger"]] as const) wavedashOutOfShield({ [held]: true }, { [other]: true });
});

test("full-forward jump-squat buffer replays every wavedash position recorded on main 1cd260a28 [k1 scenario]", () => {
  const recordedX = [
    -300.0, -300.0, -300.0, -282.5386047363281, -265.55718994140625,
    -249.05580139160156, -233.03439331054688, -217.4929962158203, -202.43157958984375, -187.85018920898438,
    -173.74879455566406, -160.1273956298828, -146.98599243164062, -134.3245849609375, -122.1431884765625,
    -110.44178771972656, -99.22039031982422, -88.4789810180664, -78.21757507324219, -68.43616485595703,
    -59.13475799560547, -50.31334686279297, -41.97194290161133, -34.11053466796875, -26.7291259765625,
    -19.82771873474121, -13.406310081481934, -7.464902400970459, -2.0034947395324707, 2.9779129028320312,
    7.479320526123047, 11.500728607177734, 15.042135238647461, 18.10354232788086, 20.684951782226562,
    22.786357879638672, 24.407764434814453, 25.549171447753906, 26.210580825805664, 26.391990661621094,
  ];
  const match = testMatch(3, Character.sylvanas);
  const fighter = createReferenceFighter(Character.sylvanas, -300.0, 1);
  match.world.fighters[0] = fighter;
  match.world.fighters[1] = createReferenceFighter(Character.sylvanas, 300.0, -1);
  const run = padMatch(match, "jump-squat-full-forward-441");
  let frame = 0;
  for (const x of recordedX) {
    frame++;
    const pad: Pad = frame === 1 ? { jump: true } : frame === 2 ? { jump: true, trigger: true, x: 1.0 } : {};
    playPads(run, pad, {});
    assertEquals(fighter.motion.x, x, `x on frame ${frame}`);
    assertEquals(fighter.motion.z, 0.0, `z on frame ${frame}`);
    if (frame === 2 || frame === 3) assertTrue(fighter.jump.dodgeQueued);
    if (frame === 4) {
      assertEquals(fighter.jump.dodgeQueued, false);
      assertTrue(fighter.motion.grounded);
      assertEquals(fighter.landing.lag, AIR_DODGE_LANDING_LAG);
    }
  }
});
