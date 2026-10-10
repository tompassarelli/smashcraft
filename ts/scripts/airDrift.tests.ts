import { expect, test } from "bun:test";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { authoredPhysics, melee } from "../src/game/sim/tuning";
import { AIR_ACCELERATION_BAND, AIR_SPEED_BAND } from "./airDrift";

test("every fighter's air speed and air acceleration sit inside the documented band [spec #190]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const p = authoredPhysics(character);
    const name = fighterName(character);
    expect([name, p.airSpeed >= melee(AIR_SPEED_BAND.min) && p.airSpeed <= melee(AIR_SPEED_BAND.max)]).toEqual([name, true]);
    expect([name, p.airAcceleration >= melee(AIR_ACCELERATION_BAND.min) && p.airAcceleration <= melee(AIR_ACCELERATION_BAND.max)]).toEqual([name, true]);
  }
});
