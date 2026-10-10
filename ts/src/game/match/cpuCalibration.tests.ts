import { assertEquals, test } from "wisp/src/runtime/testing";
import { CPU_PROFILES, cpuProfile } from "./cpuProfiles";
import { calibrationFailures, collectCalibrationRow } from "./cpuCalibration";
import { sweep } from "../../runtime/sweep";


for (const profile of CPU_PROFILES) {
  sweep(`calibration ${profile.opponent}/${profile.tier}: 100 eligible decisions, zero early reactions/reversals/replay differences [k3 measure #186]`, () => {
    const row = collectCalibrationRow(profile);
    assertEquals(calibrationFailures(row).join("; "), "");
  });
}

test("calibration rejects insufficient decisions instead of calling an empty sample coverage [k3 measure #186]", () => {
  const row = collectCalibrationRow(cpuProfile("wren", "expert"), 0);
  assertEquals(calibrationFailures(row).some(failure => failure.includes("0/100 eligible decisions")), true);
});
