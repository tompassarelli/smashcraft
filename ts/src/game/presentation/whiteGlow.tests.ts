import { assertEquals, test } from "wisp/src/runtime/testing";
import { floorMod } from "wisp/src/sim/intMath";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { createWhiteGlowState, WHITE_GLOW_PERIOD, whiteGlowAlpha } from "./whiteGlow";

test("every fighter pulses white at a fixed period throughout smash charge and stops on release", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    const state = createWhiteGlowState();
    fighter.attack.smashCharging = true;
    for (let frame = 0; frame < 60; frame++) {
      fighter.attack.smashChargeFrames = frame;
      const alpha = whiteGlowAlpha(state, fighter, frame);
      assertEquals(alpha > 0, floorMod(frame, WHITE_GLOW_PERIOD) < 6, fighterName(character));
    }
    fighter.attack.smashCharging = false;
    assertEquals(whiteGlowAlpha(state, fighter, 60), 0, fighterName(character));
  }
});

test("eight-frame and longer hitlag flashes for the entire freeze and lighter hits stay clear", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const fighter = createFighter(character, 0.0, 1);
    const state = createWhiteGlowState();
    let frame = 0;
    for (const duration of [7, 8, 12, 20, 3]) {
      fighter.visuals.hit++;
      for (let remaining = duration; remaining > 0; remaining--) {
        fighter.launch.hitlag = remaining;
        const alpha = whiteGlowAlpha(state, fighter, frame++);
        assertEquals(alpha > 0, duration >= 8, `${fighterName(character)} hitlag ${duration}, remaining ${remaining}`);
        if (duration >= 8) assertEquals(alpha, floorMod(duration - remaining, 4) < 2 ? 220 : 100);
      }
      fighter.launch.hitlag = 0;
      assertEquals(whiteGlowAlpha(state, fighter, frame++), 0);
    }
  }
});
