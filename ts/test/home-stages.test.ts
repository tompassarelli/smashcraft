import { expect, test } from "bun:test";
import { HOME_STAGES } from "../src/game/menu/homeStages";
import { SELECTABLE_CHARACTERS } from "../src/game/sim/heroes/registry";

test("every selectable fighter has exactly one home stage [spec docs/design/home-stages.md]", () => {
  expect(HOME_STAGES.map(entry => entry.character).sort((a, b) => a - b)).toEqual([...SELECTABLE_CHARACTERS].sort((a, b) => a - b));
});
