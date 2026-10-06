import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import {
  BUST_BOX, PLATE_HEIGHT_PX, PLATE_TOP, PLATE_WIDTH_PX, SHAKE_FRAMES, SHAKE_MAX_PX, STOCK_ICON_PX, damageColour, damageTenths, damageWhole, plateLeft, shakeStrength, shakeX, shakeY,
} from "./plateLayout";
import { TILE_TEXTURE_PX, pixelsForUnits, unitsForPixels } from "./portraitFrames";

test("the HUD plate, bust and stock icons draw 1:1 on a 2880x1920 display, and four plates fit side by side", () => {
  assertEquals(Math.round(pixelsForUnits(unitsForPixels(PLATE_WIDTH_PX), 1920)), 544);
  assertEquals(Math.round(pixelsForUnits(PLATE_TOP - f32(0.012), 1920)), PLATE_HEIGHT_PX);
  assertEquals(BUST_BOX.width, TILE_TEXTURE_PX);
  assertEquals(BUST_BOX.height, BUST_BOX.width);
  assertEquals(STOCK_ICON_PX, 64);
  for (const count of [2, 3, 4]) {
    for (let position = 0; position + 1 < count; position++) {
      assertTrue(plateLeft(position, count) + unitsForPixels(PLATE_WIDTH_PX) < plateLeft(position + 1, count));
    }
    assertTrue(plateLeft(0, count) >= 0.0 && plateLeft(count - 1, count) + unitsForPixels(PLATE_WIDTH_PX) <= f32(0.8));
  }
});

test("the damage readout ramps white to dark red, its tenth beside the whole percent", () => {
  assertEquals(damageColour(0.0), 0xffffff);
  assertEquals(damageColour(40.0), 0xfff27a);
  assertEquals(damageColour(200.0), 0x9a0f12);
  assertEquals(damageColour(999.0), 0x9a0f12);
  assertEquals(damageWhole(0.0), "|cffffffff0|r");
  assertEquals(damageTenths(0.0), "|cffffffff.0%|r");
  // 47 is 7/40 of the way from yellow (f2, 7a) to orange (a5, 3a), each channel step truncated.
  assertEquals(damageWhole(f32(47.375)), "|cffffe56f47|r");
  assertEquals(damageTenths(f32(47.375)), "|cffffe56f.3%|r");
});

test("a hit's shake stays within its bound and settles to zero", () => {
  assertEquals(shakeStrength(999.0), SHAKE_MAX_PX);
  for (let frame = 0; frame < SHAKE_FRAMES; frame++) {
    assertTrue(Math.abs(shakeX(SHAKE_MAX_PX, frame)) <= SHAKE_MAX_PX && Math.abs(shakeY(SHAKE_MAX_PX, frame)) <= SHAKE_MAX_PX);
  }
  assertEquals(shakeX(SHAKE_MAX_PX, SHAKE_FRAMES), 0.0);
  assertEquals(shakeY(SHAKE_MAX_PX, SHAKE_FRAMES), 0.0);
  assertEquals(shakeX(SHAKE_MAX_PX, SHAKE_FRAMES - 1), 0.0);
});
