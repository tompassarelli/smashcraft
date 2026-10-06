// The controller Smashcraft's soak fuzzes (scripts/wisp/soak.ts): one button
// per combat action the journal rows carry, and the stick in rows' units.
// test/soak/game.ts turns its edges into journal rows.
import type { SoakController } from "wisp/scripts/wisp/soak";

export const SOAK_BUTTONS = ["jump", "attack", "special", "grab", "leftTrigger", "rightTrigger", "walk"] as const;

/** Melee's 0.28 dead zone of the rows' 127-unit stick. */
export const STICK_DEAD_ZONE = 35;

export const SOAK_CONTROLLER: SoakController = {
  buttons: SOAK_BUTTONS,
  // Attacks and specials come up most in play; walk is a modifier.
  weights: [2, 3, 3, 1, 1, 1, 0.5],
  axes: ["x", "z"],
  axisLimit: 127,
  deadZone: STICK_DEAD_ZONE,
};
