import { test, assertEquals } from "wisp/src/runtime/testing";
import { FighterAgencyForecast } from "./fighterAgency";
import { Character, DownState } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, neutralControls } from "../sim/roster";
import { advanceFighterMotion } from "../sim/step";

test("locked input boundaries agree with the replay agency references in Lua32", () => {
  // Reference strings: smashcraft:ts/scripts/liveAgency.tests.ts's replay oracle.
  const references = [
    { name: "grounded buffer", letters: ".............AAAAAAAAAA" },
    { name: "freeze", letters: "..............AAAA" },
    { name: "forced stand", letters: ".....................................AAAAAAAAAAA" },
  ];
  const forecast = new FighterAgencyForecast();
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    for (const reference of references) {
      const fighter = createFighter(character, 0.0, 1);
      const world = createRoster(1, [fighter]);
      if (reference.name === "grounded buffer") fighter.launch.hitstun = 20;
      else if (reference.name === "freeze") fighter.status.frozenFrames = 15;
      else fighter.down.state = DownState.damage;
      let letters = "";
      for (let frame = 0; frame < reference.letters.length; frame++) {
        const agency = forecast.classify(world, 0, 0, frame);
        letters += agency === "none" ? "." : agency === "di" ? "d" : "A";
        advanceFighterMotion(world, 0, 0, frame + 1, neutralControls(), 0.0);
      }
      assertEquals(letters, reference.letters);
    }
  }
});
