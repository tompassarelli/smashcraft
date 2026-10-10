import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { stageScenery } from "./stageScenery";
import { fogProblems, mirrorProblems } from "./stageRules";







const FIGURE_WORDS = ["statue", "totem", "idol", "effigy", "corpse", "skeleton"];

test("each selectable stage has its own sky and fog beyond the fight [k3 measure #170]", () => {
  const skies: string[] = [];
  const fogs: string[] = [];
  for (const { id, name } of STAGE_CATALOG) {
    const { sky, fog } = stageScenery(id);
    assertEquals(sky.length > 0, true, `${name}: missing sky`);
    assertEquals(skies.includes(sky), false, `${name}: shares another stage's sky`);
    skies.push(sky);
    assertEquals(fog !== undefined, true, `${name}: missing fog`);
    if (fog === undefined) continue;
    const color = `${fog.red}/${fog.green}/${fog.blue}`;
    assertEquals(fogs.includes(color), false, `${name}: shares another stage's fog colour`);
    fogs.push(color);
    assertEquals(fogProblems(name, stageScenery(id)).join("\n"), "");
  }
});

test("no stage's scenery pairs a piece with its mirror twin [k3 measure docs/design/stage-art.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    assertEquals(mirrorProblems(name, stageScenery(id).pieces).join("\n"), "");
  }
});

test("stage scenery shows no creatures [k3 measure docs/design/stage-art.md]", () => {
  for (const { id, name } of STAGE_CATALOG) {
    for (const { model } of stageScenery(id).pieces) {
      const creature = model.toLowerCase().startsWith("units\\") || FIGURE_WORDS.some((word) => model.toLowerCase().includes(word));
      assertEquals(creature, false, `${name}: ${model} is a creature`);
    }
  }
});
