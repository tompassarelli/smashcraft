


import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { ELEMENTS, IMMOLATE_SOUNDS, elementLook } from "../src/game/presentation/elementLooks";






const LABELS = new Set((await Bun.file(new URL("fixtures/stock-sound-labels.txt", import.meta.url)).text()).split("\n").filter((line) => line !== ""));

test("every element shows a stock model on its victim and plays a stock sound [k4 reference native]", () => {
  const victims = ELEMENTS.flatMap((element) => elementLook(element).victim ?? []);
  expect(new Set(victims).size).toBe(victims.length);
  expect(victims.filter((model) => MODEL_FACTS[model] === undefined)).toEqual([]);
  const sounds = [...ELEMENTS.flatMap((element) => elementLook(element).sound ?? []), ...Object.values(IMMOLATE_SOUNDS)];
  expect(sounds.filter((label) => !LABELS.has(label))).toEqual([]);
});
