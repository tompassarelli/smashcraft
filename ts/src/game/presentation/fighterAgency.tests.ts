import { test, assertEquals } from "wisp/src/runtime/testing";
import { FighterAgencyForecast } from "./fighterAgency";
import { Character, DownState } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { createRoster, neutralControls } from "../sim/roster";
import { advanceFighterMotion } from "../sim/step";
import { STAGE_CATALOG } from "../menu/stageCatalog";

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

test("clearance shortcuts preserve full contact forecasts near stage geometry in Lua32", () => {
  const bounded = new FighterAgencyForecast();
  const full = new FighterAgencyForecast(false);
  const input = neutralControls();
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    for (const stage of STAGE_CATALOG) {
      for (const x of [-900.0, -200.0, 0.0, 200.0, 900.0]) {
        for (const z of [-100.0, 0.0, 20.0, 150.0, 600.0]) {
          for (const direction of [-1, 0, 1]) {
            const fighter = createFighter(character, x, 1);
            const world = createRoster(1, [fighter]);
            fighter.motion.z = z;
            fighter.motion.grounded = false;
            fighter.motion.surface = undefined;
            fighter.launch.hitstun = 60;
            fighter.launch.knockbackX = direction * 8.0;
            fighter.launch.knockbackZ = direction * 20.0;
            fighter.down.state = DownState.tumble;
            for (let frame = 0; frame < 3; frame++) {
              assertEquals(bounded.classify(world, 0, stage.id, frame), full.classify(world, 0, stage.id, frame), `${character} stage ${stage.id}, ${x}/${z}, ${direction}, frame ${frame}`);
              advanceFighterMotion(world, 0, stage.id, frame + 1, input, 0.0);
            }
          }
        }
      }
    }
  }
});
