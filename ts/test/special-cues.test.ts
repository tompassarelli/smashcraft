// Every special cue (src/game/presentation/specialCues.ts) is a classic model
// read from the game's archives; specialCues.tests.ts checks the windows and
// that no two moves look alike.
import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { allCueModels } from "../src/game/presentation/specialCues";

test("every special cue is a model read from the game's archives", () => {
  const models = allCueModels();
  expect(models.length).toBeGreaterThan(40);
  expect(models.filter((model) => MODEL_FACTS[model] === undefined)).toEqual([]);
});
