import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { luma } from "./stagePalette";
import { STAGE_LIGHTS } from "./stageLighting";

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
