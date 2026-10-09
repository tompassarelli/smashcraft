


import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { IMPORTED_MODEL_FILES, VALKYR_MODEL } from "../src/game/assets/importedModelInfo";
import { allProjectileModels, heroProjectileArt } from "../src/game/presentation/projectileArt";
import { LICH_KING_SPECIALS } from "../src/game/sim/heroes/lichKingSpecials";

test("every projectile missile is a model read from the game's archives [native]", () => {
  const models = allProjectileModels();
  expect(models.length).toBeGreaterThan(5);
  expect(models.filter((model) => MODEL_FACTS[model] === undefined)).toEqual([]);
});

test("Val'kyr uses the stock Banshee path so Definitive art can resolve [repro #319]", () => {
  const side = heroProjectileArt(LICH_KING_SPECIALS).filter(({ slot }) => slot === "side").map(({ spec }) => spec.model);
  expect(side).toEqual(["Units\\Undead\\Banshee\\Banshee.mdx"]);
  expect(IMPORTED_MODEL_FILES.some(({ entry }) => entry === VALKYR_MODEL)).toBe(false);
});
