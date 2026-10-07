import { expect, test } from "bun:test";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { authoredPhysics, melee } from "../src/game/sim/tuning";
import { AIR_ACCELERATION_BAND, AIR_SPEED_BAND, CROSS_UP_DASH_FRAMES, HELD_AFTER_TAKEOFF, crossUp, dashJump } from "./airDrift";

// Air drift and jump momentum (#190; smashcraft:docs/gameplay-design.md,
// "Air drift and jump momentum").

/** Fighters allowed to miss the dash -> jump -> aerial cross-up, each a deliberate design choice; none today. */
const CROSS_UP_EXCEPTIONS: readonly Character[] = [];

test("every fighter's air speed and air acceleration sit inside the documented band", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const p = authoredPhysics(character);
    const name = fighterName(character);
    expect([name, p.airSpeed >= melee(AIR_SPEED_BAND.min) && p.airSpeed <= melee(AIR_SPEED_BAND.max)]).toEqual([name, true]);
    expect([name, p.airAcceleration >= melee(AIR_ACCELERATION_BAND.min) && p.airAcceleration <= melee(AIR_ACCELERATION_BAND.max)]).toEqual([name, true]);
  }
});

// Melee's ground-jump rule: ground velocity × the momentum multiplier, plus the
// held direction × the jump's initial horizontal speed, capped. Illidan's
// immediate jump physics drift him one frame on takeoff.
test("a jump out of a dash or a run keeps its horizontal momentum by the shared rule on every fighter", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const p = authoredPhysics(character);
    for (const groundFrames of [CROSS_UP_DASH_FRAMES, 24]) {
      const { ground, takeoff, held } = dashJump(character, groundFrames);
      const name = `${fighterName(character)} after ${groundFrames} ground frames`;
      const rule = Math.min(p.jumpHorizontalCap, f32(f32(ground * p.jumpMomentum) + p.jumpHorizontalSpeed));
      const drift = character === Character.demonHunter ? p.airFriction : 0.0;
      expect([name, takeoff]).toEqual([name, f32(rule - drift)]);
      // Faster than the fighter could drift: the dash's speed carried into the air.
      expect([name, takeoff > p.airSpeed]).toEqual([name, true]);
      // Holding forward loses only the air friction a frame, never snapping to the air speed.
      expect([name, Math.abs(held - Math.max(p.airSpeed, takeoff - HELD_AFTER_TAKEOFF * p.airFriction)) < 1e-3]).toEqual([name, true]);
    }
  }
});

test("a dash, jump and aerial crosses over a shielding opponent and meets the shield from behind", () => {
  const missed = SELECTABLE_CHARACTERS.filter((character) => crossUp(character) === undefined);
  expect(missed.map(fighterName)).toEqual(CROSS_UP_EXCEPTIONS.map(fighterName));
  expect(SELECTABLE_CHARACTERS.length - missed.length).toBeGreaterThanOrEqual(10);
}, 60_000);
