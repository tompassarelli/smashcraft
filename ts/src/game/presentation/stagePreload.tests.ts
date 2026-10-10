import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { preloadModels, preloadSkies, stageModels } from "./stagePreload";
import { stageScenery } from "./stageScenery";

test("preload covers every model and sky each selectable stage draws [k2 property]", () => {
  const models = preloadModels();
  const skies = preloadSkies();
  for (const { id, name } of STAGE_CATALOG) {
    const expected = stageModels(id);
    assertEquals(expected.length > 0, true, `${name} draws no models`);
    for (const model of expected) assertEquals(models.includes(model), true, `${name}: ${model} is not preloaded`);
    for (const piece of stageScenery(id).pieces) assertEquals(models.includes(piece.model), true, `${name}: scenery ${piece.model} is not preloaded`);
    assertEquals(skies.includes(stageScenery(id).sky), true, `${name}: sky is not preloaded`);
  }
});
