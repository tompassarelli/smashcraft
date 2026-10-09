import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";
import { allProjectileModels } from "../src/game/presentation/projectileArt";

test("every projectile missile is a stock model read from the game's archives, never an import Definitive can't resolve [native]", () => {
  const models = allProjectileModels();
  const imported = new Set(IMPORTED_MODEL_FILES.map(({ entry }) => entry));
  expect(models.length).toBeGreaterThan(5);
  expect(models.filter((model) => MODEL_FACTS[model] === undefined || imported.has(model))).toEqual([]);
});
