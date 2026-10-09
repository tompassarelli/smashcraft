import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { rosterGrid } from "../menu/selectionGrid";
import { RENDERED_FIGHTERS, SELECTABLE_CHARACTERS, fighterPortrait } from "../sim/heroes/registry";
import { TILE_TEXTURE_PX, pixelsForUnits, tilePortrait } from "./portraitFrames";
import { PARTICIPANT_SLOTS } from "../input/participants";

test("roster tile portraits never stretch the tile render past its pixels, for any roster size [spec #138]", () => {
  for (let count = 1; count <= 16; count++) {
    const portrait = tilePortrait(rosterGrid(count).scale);
    assertTrue(portrait > 0 && pixelsForUnits(portrait, 1920) <= TILE_TEXTURE_PX + 0.5);
  }
});

test("every selectable fighter uses cut-out renders in the HUD and selection [spec #323]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    for (const kind of ["Card", "Bust", "Stock", "Tile"] as const) {
      assertTrue(fighterPortrait(character, kind).startsWith(`war3mapImported\\Fighter${kind}`));
    }
  }
});

test("picked and match portraits select each slot's costume while grid portraits remain neutral [spec #161]", () => {
  for (const character of RENDERED_FIGHTERS) {
    for (const kind of ["Card", "Bust", "Stock", "Tile"] as const) {
      const neutral = fighterPortrait(character, kind);
      const variants = new Set<string>();
      for (const slot of PARTICIPANT_SLOTS) {
        const path = fighterPortrait(character, kind, slot);
        variants.add(path);
      }
      assertEquals(variants.size, PARTICIPANT_SLOTS.length);
      assertTrue(!variants.has(neutral));
    }
  }
});
