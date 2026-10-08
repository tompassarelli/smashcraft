import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";

// Imported models are named by content hash, so a changed clip or build input
// renames its model and an unrefreshed table no longer holds it.
test("the model facts table holds exactly the models the scene names", () => {
  const named = new Set(SMASHCRAFT_SCENE.kinds.flatMap((kind) => kind.models).filter((model) => model !== ""));
  const missing = [...named].filter((model) => !(model in MODEL_FACTS));
  const extra = Object.keys(MODEL_FACTS).filter((model) => !named.has(model));
  expect({ missing, extra }).toEqual({ missing: [], extra: [] });
});
