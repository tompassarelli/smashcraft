import { expect, test } from "bun:test";
import { drawnModels } from "../scripts/wisp/cueBudget";

test("the widest list names only drawn effects: a parked model (scale 0, under the floor) is dropped, a drawn one kept [invariant]", () => {
  expect(drawnModels([
    { model: "Abilities\\Spells\\Human\\StormBolt\\StormBolt.mdl", alpha: 255, scale: 1, flat: false },
    { model: "Abilities\\Spells\\Orc\\Parked\\Parked.mdl", alpha: 255, scale: 0, flat: false },
    { model: "Abilities\\Spells\\Undead\\Hidden\\Hidden.mdl", alpha: 0, scale: 1, flat: false },
  ])).toEqual(["StormBolt.mdl"]);
});
