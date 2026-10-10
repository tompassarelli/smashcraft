import { assertDefined, assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { HEIGHT_PROBE_OUT, REACH_PROBE_DEPTH, RECOVERY_BANDS, RECOVERY_PLANS, recovers, recoveryArchetype, upSpecialRoute } from "../../match/recoveryEnvelope";
import { mainDeckRight } from "../stage";

test("Blood Leap meets the heavy recovery floors and route ceilings at zero and full meter [repro #340] [spec #252] [spec #335]", () => {
  const band = assertDefined(RECOVERY_BANDS[recoveryArchetype(Character.grom)], "heavy band");
  const full = upSpecialRoute(Character.grom, 100);
  for (const mana of [100, 0]) {
    const route = mana === 100 ? full : upSpecialRoute(Character.grom, mana);
    assertEquals(route.rise >= band.riseMin && route.rise <= band.riseMax, true, `rise ${route.rise}, want ${band.riseMin}-${band.riseMax}`);
    assertEquals(route.reach >= band.reachMin && route.reach <= band.reachMax, true, `reach ${route.reach}, want ${band.reachMin}-${band.reachMax}`);
    assertEquals(route.rise, full.rise);
    assertEquals(route.reach, full.reach);
    const ledge = mainDeckRight(0);
    assertEquals(RECOVERY_PLANS.some((plan) => recovers(Character.grom, mana, f32(ledge + HEIGHT_PROBE_OUT), -band.heightMin, plan)), true, `mana ${mana}: height floor ${band.heightMin}`);
    assertEquals(RECOVERY_PLANS.some((plan) => recovers(Character.grom, mana, f32(ledge + band.envelopeReachMin), -REACH_PROBE_DEPTH, plan)), true, `mana ${mana}: reach floor ${band.envelopeReachMin}`);
  }
});
