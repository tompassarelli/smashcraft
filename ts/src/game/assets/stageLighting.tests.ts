import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { STAGE_LIGHTS } from "./stageLighting";
import { intensityProblems, lightProblems } from "../presentation/stageRules";

test("each stage's light keeps fighters bright, shaded sides readable and team colours their own [k3 measure docs/design/visual-quality.md]", () => {
  for (const { theme, light } of STAGE_LIGHTS) assertEquals(lightProblems(theme, light).join("\n"), "");
});

test("every stage's light intensity stays positive and at most 1.25, Naxxramas at most 2 [k3 measure #296]", () => {
  for (const { stage, theme, light } of STAGE_LIGHTS) assertEquals(intensityProblems(theme, stage, light).join("\n"), "");
});
