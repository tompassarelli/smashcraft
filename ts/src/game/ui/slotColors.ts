import { at } from "wisp/src/runtime/lookup";





interface PlayerColor {

  readonly name: string;

  readonly rgb: number;

  readonly texture: string;
}

const color = (name: string, rgb: number, index: string): PlayerColor => ({ name, rgb, texture: `ReplaceableTextures\\TeamColor\\TeamColor${index}.blp` });


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


export const NEUTRAL_TEAM_COLOR = 20;


export function slotColor(slot: number): PlayerColor {
  return at(PLAYER_COLORS, slot);
}
