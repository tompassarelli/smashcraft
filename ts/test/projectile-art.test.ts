// Every move's projectile missile (src/game/presentation/projectileArt.ts) is
// a model read from the game's own archives; projectileArt.tests.ts checks
// that each move names its own.
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

test("[repro #319] the Val'kyr draws the classic Banshee from an imported path, which HD clients cannot swap for the HD Banshee that drew long dark bars", () => {
  const side = heroProjectileArt(LICH_KING_SPECIALS).filter(({ slot }) => slot === "side").map(({ spec }) => spec.model);
  expect(side).toEqual([VALKYR_MODEL]);
  expect(VALKYR_MODEL.startsWith("war3mapImported\\")).toBe(true);
  expect(IMPORTED_MODEL_FILES.some(({ entry }) => entry === VALKYR_MODEL)).toBe(true);
  // The classic Banshee's 415 triangles in 5 geosets; the HD Banshee is one 182-bone skinned geoset.
  expect([MODEL_FACTS[VALKYR_MODEL]?.geosets, MODEL_FACTS[VALKYR_MODEL]?.triangles]).toEqual([5, 415]);
});
