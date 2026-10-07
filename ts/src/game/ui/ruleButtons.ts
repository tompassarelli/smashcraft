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
const toggleBox = (x: number, y: number): RuleBox => ({ x, y, width: f32(0.178), height: RULE_HEIGHT });

export const RULE_BUTTONS = {
  fewerStocks: stepBox(f32(0.38), f32(0.585)),
  moreStocks: stepBox(f32(0.528), f32(0.585)),
  lessTime: stepBox(f32(0.572), f32(0.585)),
  moreTime: stepBox(f32(0.72), f32(0.585)),
  endless: toggleBox(f32(0.38), f32(0.551)),
  automaticRematch: toggleBox(f32(0.572), f32(0.551)),
  training: toggleBox(f32(0.572), f32(0.517)),
  lessBehaviour: stepBox(f32(0.38), f32(0.585)),
  moreBehaviour: stepBox(f32(0.528), f32(0.585)),
  lessEscape: stepBox(f32(0.572), f32(0.585)),
  moreEscape: stepBox(f32(0.72), f32(0.585)),
  lessTech: stepBox(f32(0.38), f32(0.551)),
  moreTech: stepBox(f32(0.528), f32(0.551)),
  lessDamage: stepBox(f32(0.572), f32(0.551)),
  moreDamage: stepBox(f32(0.72), f32(0.551)),
  hitAreas: toggleBox(f32(0.38), f32(0.517)),
  speed: toggleBox(f32(0.055), f32(0.519)),
} as const;

/** The partner choices training steps through. */
export type TrainingSetting = "behaviour" | "escape" | "tech" | "damage";

/** Below the chip drag area (cardSlot), so opening settings cannot pick up a chip. */
export function cpuSettingsBox(slot: number): RuleBox {
  return { x: f32(f32(cardX(slot)) + f32(0.007)), y: f32(0.078), width: f32(0.146), height: f32(0.019) };
}
