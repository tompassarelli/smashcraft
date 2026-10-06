import { f32 } from "wisp/src/sim/f32";
import { cardX } from "../menu/selectionDrag";

/** A rules button's top-left corner and size in Warcraft's UI coordinates. */
export interface RuleBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const STEP_WIDTH = f32(0.03);
export const RULE_HEIGHT = f32(0.027);
const stepBox = (x: number, y: number): RuleBox => ({ x, y, width: STEP_WIDTH, height: RULE_HEIGHT });
const toggleBox = (y: number): RuleBox => ({ x: f32(0.03), y, width: f32(0.22), height: RULE_HEIGHT });

/**
 * The match rules beside the roster, which every player sees and any player
 * changes. The native capture journey clicks their centers
 * (smashcraft:ts/scripts/integrity/journey.ts).
 */
export const RULE_BUTTONS = {
  fewerStocks: stepBox(f32(0.03), f32(0.428)),
  moreStocks: stepBox(f32(0.22), f32(0.428)),
  lessTime: stepBox(f32(0.03), f32(0.394)),
  moreTime: stepBox(f32(0.22), f32(0.394)),
  endless: toggleBox(f32(0.36)),
  automaticRematch: toggleBox(f32(0.326)),
  /** Training and, while it is on, the partner's choices in place of the rules it has no use for. */
  training: toggleBox(f32(0.53)),
  lessBehaviour: stepBox(f32(0.03), f32(0.496)),
  moreBehaviour: stepBox(f32(0.22), f32(0.496)),
  lessEscape: stepBox(f32(0.03), f32(0.462)),
  moreEscape: stepBox(f32(0.22), f32(0.462)),
  lessTech: stepBox(f32(0.03), f32(0.428)),
  moreTech: stepBox(f32(0.22), f32(0.428)),
  lessDamage: stepBox(f32(0.03), f32(0.394)),
  moreDamage: stepBox(f32(0.22), f32(0.394)),
  hitAreas: toggleBox(f32(0.36)),
  speed: toggleBox(f32(0.326)),
} as const;

/** The partner choices training steps through. */
export type TrainingSetting = "behaviour" | "escape" | "tech" | "damage";

const LEVEL_STEP_WIDTH = f32(0.025);
const LEVEL_ROW_Y = f32(0.072);
export const LEVEL_ROW_HEIGHT = f32(0.022);

/**
 * A computer card's level buttons, under the card where pressing never
 * picks up its chip (cardSlot): `-1` lowers the level, `1` raises it. The
 * level reads between them.
 */
export function cpuLevelBox(slot: number, direction: -1 | 1): RuleBox {
  const left = f32(cardX(slot));
  const x = direction < 0 ? f32(left + f32(0.014)) : f32(left + f32(0.121));
  return { x, y: LEVEL_ROW_Y, width: LEVEL_STEP_WIDTH, height: LEVEL_ROW_HEIGHT };
}
