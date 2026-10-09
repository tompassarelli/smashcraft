


import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { allCueModels } from "../src/game/presentation/specialCues";
import { allAttackCueModels } from "../src/game/presentation/attackCues";
import { DISJOINT_MODELS } from "../src/game/presentation/disjointCues";
import { Character } from "../src/game/sim/codes";

test("every special cue is a model read from the game's archives [native]", () => {
  const models = [...allCueModels(), ...allAttackCueModels()];
  expect(models.length).toBeGreaterThan(40);
  expect(models.filter((model) => MODEL_FACTS[model] === undefined)).toEqual([]);
});

test("every fighter has its own contact accent; none falls back to Rifleman's rocket [spec #365]", () => {
  const fighters = Object.values(Character);
  expect(fighters.length).toBe(26);
  expect(fighters.filter((character) => !DISJOINT_MODELS[character])).toEqual([]);
  const rocket = DISJOINT_MODELS[Character.rifleman];
  expect(fighters.filter((character) => character !== Character.rifleman && DISJOINT_MODELS[character] === rocket)).toEqual([]);
});
