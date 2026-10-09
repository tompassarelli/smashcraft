import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { SMASHCRAFT_SCENE } from "../scripts/wisp/playerView";



test("the model facts table holds exactly the models the scene names [native]", () => {
  const named = new Set(SMASHCRAFT_SCENE.kinds.flatMap((kind) => kind.models).filter((model) => model !== ""));
  const missing = [...named].filter((model) => !(model in MODEL_FACTS));
  const extra = Object.keys(MODEL_FACTS).filter((model) => !named.has(model));
  expect({ missing, extra }).toEqual({ missing: [], extra: [] });
});
