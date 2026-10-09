import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { luma } from "./stagePalette";
import { STAGE_LIGHTS } from "./stageLighting";
import { FROZEN_THRONE_STAGE } from "../sim/stage";
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

// #265: over Frozen Throne's bright glacier backdrop the full light cut fighter contrast (ΔE00 35.2 → 33.0, 30.9 → 30.1).
test("Frozen Throne's lit key stays dimmer than Reforged's stock noon key [spec #265]", () => {
  const frozen = STAGE_LIGHTS.find(({ stage }) => stage === FROZEN_THRONE_STAGE)!.light;
  // Reforged's stock noon key, 0.92 × (0.839, 0.839, 0.980), the dimmest of the three modes.
  const stockKey = 0.9200000166893005 * luma([0.8389999866485596 * 255, 0.8389999866485596 * 255, 0.9800000190734863 * 255]);
  assertEquals(luma(frozen.key) * (frozen.intensity ?? 1) < stockKey, true, "Frozen Throne's key is not dimmer than stock");
});
