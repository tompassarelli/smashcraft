import { at } from "wisp/src/runtime/lookup";
// Warcraft's player colours. A fighter's model shows its slot's colour
// (BlzSetSpecialEffectColorByPlayer with Player(slot)), so the selection card
// and HUD plate of slot N use player N's colour, the same on every client.
// Portrait renders use NEUTRAL_TEAM_COLOR, which no slot uses.

export interface PlayerColor {
  /** The texture-name suffix of the slot's card art (SelectionCard<name>.tga). */
  readonly name: string;
  /** 0xRRGGBB, Warcraft's value. */
  readonly rgb: number;
  /** Warcraft's solid texture in this colour. */
  readonly texture: string;
}

const color = (name: string, rgb: number, index: string): PlayerColor => ({ name, rgb, texture: `ReplaceableTextures\\TeamColor\\TeamColor${index}.blp` });

/** Players 1 to 12 in Warcraft's order. */
export const PLAYER_COLORS: readonly PlayerColor[] = [
  color("Red", 0xff0303, "00"),
  color("Blue", 0x0042ff, "01"),
  color("Teal", 0x1ce6b9, "02"),
  color("Purple", 0x540081, "03"),
  color("Yellow", 0xfffc00, "04"),
  color("Orange", 0xfe8a0e, "05"),
  color("Green", 0x20c000, "06"),
  color("Pink", 0xe55bb0, "07"),
  color("Gray", 0x959697, "08"),
  color("LightBlue", 0x7ebff1, "09"),
  color("DarkGreen", 0x106246, "10"),
  color("Brown", 0x4a2a04, "11"),
];

/** Coal, Warcraft's team colour 21: a dark grey no slot uses, for the portrait renders. */
export const NEUTRAL_TEAM_COLOR = 20;

/** The colour of fighter slot `slot` (0-based): Warcraft's colour for that player. */
export function slotColor(slot: number): PlayerColor {
  return at(PLAYER_COLORS, slot);
}
