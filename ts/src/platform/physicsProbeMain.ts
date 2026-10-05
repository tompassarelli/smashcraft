// Diagnostic map entry for issue #9. It executes the same production
// simulation fixtures as Bun and Lua32, then exports the native gate report.
import { AssertionFailure, registeredTests } from "waygate/src/runtime/testing";
import "../game/sim/physicsPrecisionState.tests";
import "../game/sim/physicsPrecisionScalar.tests";
import "../game/sim/physicsPrecisionMotion.tests";

const GROUPS = [
  "GROUNDED_BINARY32_EXACT_PASS",
  "SHIELD_REGEN_BINARY32_EXACT_PASS",
  "SHIELD_DAMAGE_BINARY32_EXACT_PASS",
  "SHIELD_STUN_BINARY32_EXACT_PASS",
  "SHIELD_CONTACT_SUM_BINARY32_EXACT_PASS",
  "RECORDED_FALL_TEN_FRAMES_BINARY32_EXACT_PASS",
  "AIR_DECREMENT_BINARY32_EXACT_PASS",
  "SIGNED_ZERO_SCALARS_EXACT_PASS",
  "HITSTUN_BOUNDARIES_EXACT_PASS",
  "AIR_CUTOFF_BINARY32_EXACT_PASS",
  "GROUND_MOTION_BINARY32_EXACT_PASS",
  "LAUNCH_MAGNITUDE_BINARY32_EXACT_PASS",
  "HITLAG_SCALARS_EXACT_PASS",
  "ANALOG_SHIELD_BINARY32_EXACT_PASS",
  "DIRECTIONAL_INFLUENCE_BINARY32_EXACT_PASS",
  "CAPSULE_SHIELD_CLASSIFICATION_PASS",
] as const;

const output: string[] = [];

function message(line: string): void {
  output.push(line);
  BJDebugMsg(line);
}

function runProbe(source: string): void {
  let failures = 0;
  let launchFailures = 0;
  let diFailures = 0;
  let diDiscreteFailures = 0;
  for (const passMessage of GROUPS) {
    const group = passMessage.slice(0, passMessage.length - 5);
    const fixtures = registeredTests.filter(({ name }) => name === `#9 ${passMessage}`);
    if (fixtures.length === 0) {
      failures++;
      message(`${group}_FAIL`);
      continue;
    }
    let groupFailures = 0;
    for (const fixture of fixtures) {
      try {
        fixture.run();
      } catch (error) {
        groupFailures++;
        failures++;
        if (group === "LAUNCH_MAGNITUDE_BINARY32_EXACT") launchFailures++;
        if (group === "DIRECTIONAL_INFLUENCE_BINARY32_EXACT") {
          diFailures++;
          diDiscreteFailures++;
        }
        const detail = error instanceof AssertionFailure ? error.message : String(error);
        message(`${group}_CASE_FAIL=${detail.slice(0, 160)}`);
      }
    }
    if (groupFailures === 0) message(passMessage);
    else message(`${group}_FAIL`);
  }

  // The legacy report includes these two per-corpus diagnostics in addition
  // to the sixteen group results. A failed fixture is reported above.
  message(`LAUNCH_MAGNITUDE_MISMATCH_COUNT=${launchFailures}`);
  message(`DIRECTIONAL_INFLUENCE_MISMATCH_COUNT=${diFailures}`);
  message(`DIRECTIONAL_INFLUENCE_DISCRETE_MISMATCH_COUNT=${diDiscreteFailures}`);

  PreloadGenClear();
  PreloadGenStart();
  Preload(`SOURCE ${source}`);
  for (const line of output) Preload(line);
  Preload(`MESSAGES ${output.length}`);
  Preload(failures === 0 && output.length === 19 ? "NATIVE_PHYSICS_COMPLETED" : "NATIVE_PHYSICS_FAIL");
  PreloadGenEnd("smashcraft-native-physics-precision.txt");
}

export function start(source: string): void {
  // The report is written after map initialization, matching the existing native capture timing.
  TimerStart(CreateTimer(), 0.009999999776482582, false, () => runProbe(source));
}
