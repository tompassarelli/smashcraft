


import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { allCueModels } from "../src/game/presentation/specialCues";
import { allAttackCueModels } from "../src/game/presentation/attackCues";

test("every special cue is a model read from the game's archives [k4 reference native]", () => {
  const models = [...allCueModels(), ...allAttackCueModels()];
  expect(models.length).toBeGreaterThan(40);
  expect(models.filter((model) => MODEL_FACTS[model] === undefined)).toEqual([]);
});
