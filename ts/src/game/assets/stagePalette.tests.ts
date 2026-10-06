import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { stageScenery } from "../presentation/stageScenery";
import { STAGE_DECK_PALETTES, luma } from "./stagePalette";

// smashcraft:docs/design/stage-art.md, rule 10.
test("every selectable stage has its own deck palette", () => {
  for (const { id, name } of STAGE_CATALOG) {
    assertEquals(STAGE_DECK_PALETTES.filter(({ stage }) => stage === id).length, 1, `${name} has no deck palette`);
  }
  const tops = STAGE_DECK_PALETTES.map(({ palette }) => palette.top.join(","));
  assertEquals(new Set(tops).size, tops.length, "two stages share a deck top");
});

test("each deck's top stands apart from its fog in value and its body is darker than its top", () => {
  for (const { stage, theme, palette } of STAGE_DECK_PALETTES) {
    const top = luma(palette.top);
    assertEquals(luma(palette.body) <= top - 50, true, `${theme}: body ${luma(palette.body)} is within 50 of top ${top}`);
    const fog = stageScenery(stage).fog;
    if (fog === undefined) continue;
    const background = luma([fog.red * 255, fog.green * 255, fog.blue * 255]);
    assertEquals(Math.abs(top - background) >= 40, true, `${theme}: top ${top} is within 40 of fog ${background}`);
  }
});
