import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { SELECTABLE_CHARACTERS, fighterName, fighterPortrait } from "./registry";

test("every selectable fighter shows its own Warcraft icon and name", () => {
  const portraits = new Set<string>();
  const names = new Set<string>();
  for (const character of SELECTABLE_CHARACTERS) {
    portraits.add(fighterPortrait(character));
    assertTrue(fighterPortrait(character).startsWith("ReplaceableTextures\\CommandButtons\\BTN"));
    names.add(fighterName(character));
  }
  assertEquals(portraits.size, SELECTABLE_CHARACTERS.length);
  assertEquals(names.size, SELECTABLE_CHARACTERS.length);
  assertTrue(SELECTABLE_CHARACTERS.length >= 10);
});
