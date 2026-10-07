import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { NEUTRAL_TEAM_COLOR, PLAYER_COLORS, slotColor } from "./slotColors";

test("slots 1 to 4 take Warcraft's colours for players 1 to 4, the colours their fighters' models show", () => {
  const expected = [
    ["Red", 0xff0303, "00"],
    ["Blue", 0x0042ff, "01"],
    ["Teal", 0x1ce6b9, "02"],
    ["Purple", 0x540081, "03"],
  ] as const;
  assertEquals(PARTICIPANT_CAPACITY, expected.length);
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const [name, rgb, index] = expected[slot]!;
    const color = slotColor(slot);
    assertEquals(color.name, name);
    assertEquals(color.rgb, rgb);
    assertEquals(color.texture, `ReplaceableTextures\\TeamColor\\TeamColor${index}.blp`);
  }
});

test("portrait renders use a team colour no player has", () => {
  assertEquals(PLAYER_COLORS.length, 12);
  assertTrue(NEUTRAL_TEAM_COLOR >= PLAYER_COLORS.length);
});
