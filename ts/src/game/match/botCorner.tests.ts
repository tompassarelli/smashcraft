// Corner play (#386) belongs to Advanced and Expert; lower tiers keep playing the corner as neutral.
import { assertEquals, test } from "wisp/src/runtime/testing";
import { CPU_OPPONENT_IDS, CPU_TIERS } from "./cpuProfiles";
import { cpuSkill } from "./cpuSkill";
import { CORNER_BAND as MEASURED_BAND } from "./cornerScenarios";
import { CORNER_BAND, insideLip } from "./botCorner";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";

test("only Advanced and Expert computers edge-cancel, press and escape the corner [spec #386]", () => {
  for (const opponent of CPU_OPPONENT_IDS) {
    for (const tier of CPU_TIERS) assertEquals(cpuSkill(opponent, tier).cornerPlay, tier === "advanced" || tier === "expert");
  }
});

test("the corner measurement uses the computer's corner band and lip distance [invariant]", () => {
  assertEquals(MEASURED_BAND, CORNER_BAND);
  assertEquals(insideLip(0, mainDeckRight(0)), 0.0);
  assertEquals(insideLip(0, mainDeckLeft(0)), 0.0);
});
