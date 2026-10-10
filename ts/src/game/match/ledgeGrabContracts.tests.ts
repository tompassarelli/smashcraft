


import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, LedgeState } from "../sim/codes";
import { isIntangible } from "../sim/conditions";
import { createFighter } from "../sim/fighter";
import { ledgeCatchBox } from "../sim/ledge";
import { surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

const ROSTER = [Character.rifleman, Character.demonHunter] as const;

const GRAB_DISTANCE = 70.0;

test("a standing grab from the stage cannot catch a fighter hanging on the ledge after its intangible frames [k4 reference melee]", () => {
  for (const character of ROSTER) {
    for (const side of [-1, 1]) {
      const match = testMatch(3, character);
      const edge = side < 0 ? surfaceLeft(0, 0, 0) : surfaceRight(0, 0, 0);
      const grabber = createFighter(character, f32(edge - side * GRAB_DISTANCE), side);
      const hanger = createFighter(character, f32(edge + side * f32(ledgeCatchBox(character).reach - 6.0)), -side);
      hanger.motion.grounded = false;
      hanger.motion.surface = undefined;
      hanger.motion.z = surfaceZ(0, 0, 0);
      hanger.jump.remaining = 1;
      match.world.fighters[0] = grabber;
      match.world.fighters[1] = hanger;
      const run = padMatch(match, "ledge-grab");
      const label = `${character} side ${side}`;
      for (let frame = 1; frame <= 120 && (hanger.ledge.state !== LedgeState.hang || isIntangible(hanger)); frame++) playPads(run, {}, {});
      assertEquals(hanger.ledge.state, LedgeState.hang, label);
      assertFalse(isIntangible(hanger));

      playPads(run, { trigger: true }, {});
      let grabbed = false;
      for (let frame = 0; frame < 40; frame++) {
        playPads(run, { trigger: true, attack: frame === 0 }, {});
        grabbed = grabbed || grabber.attack.style === AttackStyle.grab;
        assertEquals(hanger.grab.grabbedFrames, 0, label);
        assertEquals(hanger.status.damage, 0, label);
        assertEquals(hanger.ledge.state, LedgeState.hang, label);
      }
      assertTrue(grabbed);
    }
  }
});
