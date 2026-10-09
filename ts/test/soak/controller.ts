


import type { SoakController } from "wisp/scripts/wisp/soak";

export const SOAK_BUTTONS = ["jump", "attack", "special", "grab", "leftTrigger", "rightTrigger", "walk"] as const;


export const STICK_DEAD_ZONE = 35;

export const SOAK_CONTROLLER: SoakController = {
  buttons: SOAK_BUTTONS,

  weights: [2, 3, 3, 1, 1, 1, 0.5],
  axes: ["x", "z"],
  axisLimit: 127,
  deadZone: STICK_DEAD_ZONE,
};
