// Every move's projectile missile (src/game/presentation/projectileArt.ts) is
// a model read from the game's own archives; projectileArt.tests.ts checks
// that each move names its own.
import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { allProjectileModels } from "../src/game/presentation/projectileArt";

test("every projectile missile is a model read from the game's archives", () => {
  const models = allProjectileModels();
  expect(models.length).toBeGreaterThan(5);
  expect(models.filter((model) => MODEL_FACTS[model] === undefined)).toEqual([]);
});
