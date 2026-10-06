import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { rosterGrid } from "../menu/selectionGrid";
import { RENDERED_FIGHTERS, SELECTABLE_CHARACTERS, fighterIcon, fighterPortrait } from "../sim/heroes/registry";
import { CARD_PORTRAIT, CARD_TEXTURE_PX, HUD_PORTRAIT, OFFSCREEN_PORTRAIT, TILE_TEXTURE_PX, pixelsForUnits, tilePortrait } from "./portraitFrames";

// Frames are square (BlzFrameSetSize takes one size for both sides), so a portrait
// is never stretched; this pins that each is drawn at or below its texture's pixels.
const pixels = (units: number) => Math.round(pixelsForUnits(units, 1920));

test("player card, HUD and off-screen portraits draw their renders at their own pixel size on a 2880x1920 display", () => {
  assertEquals(pixels(CARD_PORTRAIT), CARD_TEXTURE_PX);
  assertEquals(pixels(HUD_PORTRAIT), CARD_TEXTURE_PX);
  assertEquals(pixels(OFFSCREEN_PORTRAIT), TILE_TEXTURE_PX / 2);
});

test("roster tile portraits never stretch the tile render past its pixels, for any roster size", () => {
  for (let count = 1; count <= 16; count++) {
    const portrait = tilePortrait(rosterGrid(count).scale);
    assertTrue(portrait > 0 && pixelsForUnits(portrait, 1920) <= TILE_TEXTURE_PX + 0.5);
  }
});

test("every rendered fighter shows its render; any other fighter shows its command icon", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const rendered = RENDERED_FIGHTERS.includes(character);
    const card = fighterPortrait(character, false);
    assertTrue(rendered ? card.startsWith("war3mapImported\\FighterCard") : card === fighterIcon(character));
    assertTrue(!rendered || fighterPortrait(character, true).startsWith("war3mapImported\\FighterTile"));
  }
});
