import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { STAGE_LIGHTS } from "./stageLighting";
import { intensityProblems, lightProblems } from "../presentation/stageRules";


test("every selectable stage has its own light [spec docs/design/visual-quality.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    assertEquals(STAGE_LIGHTS.filter(({ stage }) => stage === id).length, 1, `${name} has no light`);
  }
  const lights = STAGE_LIGHTS.map(({ light }) => `${light.key.join(",")}/${light.ambient.join(",")}`);
  assertEquals(new Set(lights).size, lights.length, "two stages share a light");
});

test("each stage's light keeps fighters bright, shaded sides readable and team colours their own [spec docs/design/visual-quality.md]", () => {
  for (const { theme, light } of STAGE_LIGHTS) assertEquals(lightProblems(theme, light).join("\n"), "");
});

test("every stage's light intensity stays positive and at most 1.25, Naxxramas at most 2 [spec #296]", () => {
  for (const { stage, theme, light } of STAGE_LIGHTS) assertEquals(intensityProblems(theme, stage, light).join("\n"), "");
});
