import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AIR_DODGE_LANDING_LAG } from "../sim/down";
import { Character } from "../sim/codes";
import { createReferenceFighter } from "../sim/referenceRig";
import { type Pad, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

function wavedashOutOfShield(shield: Pad, dodge: Pad): void {
  const match = testMatch(3, Character.sylvanas);
  const fighter = createReferenceFighter(Character.sylvanas, -300.0, 1);
  match.world.fighters[0] = fighter;
  match.world.fighters[1] = createReferenceFighter(Character.sylvanas, 300.0, -1);
  const run = padMatch(match, "wavedash");
  for (let frame = 1; frame <= 12; frame++) playPads(run, shield, {});
  assertTrue(fighter.shield.raised);
  playPads(run, { ...shield, jump: true }, {});
  playPads(run, { ...shield, ...dodge, jump: true, x: 0.7, y: -0.7 }, {});
  let landed = false;
  for (let frame = 0; frame < 20 && !landed; frame++) {
    playPads(run, { ...shield, ...dodge, x: 0.7, y: -0.7 }, {});
    landed = fighter.landing.lag === AIR_DODGE_LANDING_LAG;
  }
  assertTrue(landed);
  assertTrue(fighter.motion.grounded);
  assertEquals(Math.sign(fighter.motion.vx), 1);
}

test("holding shield, jumping and pressing Tilt down-forward wavedashes out of shield in the tom layout [spec melee]", () => {
  wavedashOutOfShield({ trigger: true }, { tilt: true });
});

test("holding one trigger, jumping and pressing the other trigger down-forward wavedashes out of shield [spec melee]", () => {
  for (const [held, other] of [["trigger", "rightTrigger"], ["rightTrigger", "trigger"]] as const) wavedashOutOfShield({ [held]: true }, { [other]: true });
});
