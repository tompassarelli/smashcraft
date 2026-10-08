import { assertEquals, test } from "wisp/src/runtime/testing";
import { CPU_PROFILES, cpuProfile } from "./cpuProfiles";
import { calibrationFailures, collectCalibrationRow } from "./cpuCalibration";
import { sweep } from "../../runtime/sweep";

// The suite measures one row; every named profile's row runs as a sweep.
for (const profile of CPU_PROFILES) {
  sweep(`calibration ${profile.opponent}/${profile.tier}: 100 eligible decisions, zero early reactions/reversals/replay differences [spec #186]`, () => {
    const row = collectCalibrationRow(profile);
    assertEquals(calibrationFailures(row).join("; "), "");
  });
}

test("calibration rejects insufficient decisions instead of calling an empty sample coverage [spec #186]", () => {
  const row = collectCalibrationRow(cpuProfile("wren", "expert"), 1);
  assertEquals(calibrationFailures(row).some(failure => failure.includes("10/100 eligible decisions")), true);
});
