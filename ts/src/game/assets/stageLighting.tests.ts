import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { luma } from "./stagePalette";
import { STAGE_LIGHTS } from "./stageLighting";
import { DRIFTING_DECK_STAGE, FROZEN_THRONE_STAGE, TIMED_TEST_STAGE } from "../sim/stage";

// smashcraft:docs/design/visual-quality.md, "Stage light rules".
test("every selectable stage has its own light [spec docs/design/visual-quality.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    assertEquals(STAGE_LIGHTS.filter(({ stage }) => stage === id).length, 1, `${name} has no light`);
  }
  const lights = STAGE_LIGHTS.map(({ light }) => `${light.key.join(",")}/${light.ambient.join(",")}`);
  assertEquals(new Set(lights).size, lights.length, "two stages share a light");
});

test("each stage's light keeps fighters bright, shaded sides readable and team colours their own [spec docs/design/visual-quality.md]", () => {
  for (const { theme, light } of STAGE_LIGHTS) {
    const key = luma(light.key);
    const ambient = luma(light.ambient);
    assertEquals(key >= 210, true, `${theme}: key light luma ${key} is below 210`);
    assertEquals(ambient >= 120, true, `${theme}: ambient luma ${ambient} is below 120`);
    assertEquals(ambient <= key, true, `${theme}: ambient luma ${ambient} exceeds key ${key}`);
    for (const part of ["key", "ambient"] as const) {
      const chroma = Math.max(...light[part]) - Math.min(...light[part]);
      assertEquals(chroma <= 80, true, `${theme}: ${part} light chroma ${chroma} exceeds 80`);
    }
  }
});

// #267: over Ahn'Qiraj's bright sandstone ring the full light cut fighter contrast (abs ΔL 33.5 → 22.9, 14.6 → 3.8).
test("Ahn'Qiraj's light shines at half strength so fighters stay darker than the bright ring [spec docs/design/visual-quality.md]", () => {
  const qiraji = STAGE_LIGHTS.find(({ stage }) => stage === TIMED_TEST_STAGE)?.light;
  assertEquals(`${qiraji?.key.join(",")}/${qiraji?.ambient.join(",")}@${qiraji?.intensity}`, "255,240,204/192,170,136@0.5");
  for (const { theme, light } of STAGE_LIGHTS) {
    const intensity = light.intensity ?? 1;
    assertEquals(intensity > 0 && intensity <= 1, true, `${theme}: intensity ${intensity} is outside (0, 1]`);
  }
});

// #170 measured Durotar's full-intensity light lifting fighters toward its bright ring (ΔE00 −3.3, −3.5); #266 dims it.
test("Durotar's key and fill stay dimmed to 0.65 so fighters keep their contrast against its bright backdrop [spec docs/design/visual-quality.md]", () => {
  const durotar = STAGE_LIGHTS.find(({ stage }) => stage === DRIFTING_DECK_STAGE)?.light;
  assertEquals(`${durotar?.key.join(",")}/${durotar?.ambient.join(",")}`, "255,226,180/190,152,134");
  assertEquals(durotar?.intensity, f32(0.65));
});

// #265: over Frozen Throne's bright glacier backdrop the full light cut fighter contrast (ΔE00 35.2 → 33.0, 30.9 → 30.1).
test("Frozen Throne's light shines at 0.8 so lit fighters sit below the stock noon light [spec #265]", () => {
  const frozen = STAGE_LIGHTS.find(({ stage }) => stage === FROZEN_THRONE_STAGE)?.light;
  assertEquals(`${frozen?.key.join(",")}/${frozen?.ambient.join(",")}`, "226,240,255/150,172,220");
  assertEquals(frozen?.intensity, f32(0.8));
  // Reforged's stock noon key, 0.92 × (0.839, 0.839, 0.980), the dimmest of the three modes.
  const stockKey = 0.9200000166893005 * luma([0.8389999866485596 * 255, 0.8389999866485596 * 255, 0.9800000190734863 * 255]);
  assertEquals(luma(frozen!.key) * frozen!.intensity! < stockKey, true, "Frozen Throne's key is not dimmer than stock");
});
