import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { SELECTABLE_CHARACTERS, fighterName, fighterPortrait } from "./registry";

test("every selectable fighter shows its own portrait, tile and name [spec docs/design/fighter-portraits.md]", () => {
  const portraits = new Set<string>();
  const tiles = new Set<string>();
  const names = new Set<string>();
  for (const character of SELECTABLE_CHARACTERS) {
    portraits.add(fighterPortrait(character, "Card"));
    tiles.add(fighterPortrait(character, "Tile"));
    names.add(fighterName(character));
  }
  assertEquals(portraits.size, SELECTABLE_CHARACTERS.length);
  assertEquals(tiles.size, SELECTABLE_CHARACTERS.length);
  assertEquals(names.size, SELECTABLE_CHARACTERS.length);
  assertTrue(SELECTABLE_CHARACTERS.length >= 10);
});
