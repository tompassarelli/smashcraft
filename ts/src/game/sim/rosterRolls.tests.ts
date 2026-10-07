import { assertGreaterThan, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { rollTravel } from "../physics/rollTravel";
import { Character, DownState } from "./codes";
import { DOWN_ROLL_FRAMES, TECH_ROLL_FRAMES } from "./down";
import { createFighter } from "./fighter";
import { heroBody } from "./heroes/heroBodies";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
import { GROUND_ROLL_FRAMES } from "./conditions";
import { advanceSolo, controls } from "./testWorld";
import { beginDownState } from "./transitions";

function forwardDistance(character: Character): number {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.surface = 0;
  const input = controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: 1 });
  for (let frame = 1; frame <= GROUND_ROLL_FRAMES; frame++) {
    advanceSolo(fighter, 0, input, 0.0);
    input.groundDodgePressed = false;
  }
  return fighter.motion.x;
}

for (const character of SELECTABLE_CHARACTERS) {
  test(`${fighterName(character)} forward-roll distance ${forwardDistance(character)} world units; every roll travels in both directions`, () => {
    for (const facing of [-1, 1]) {
      for (const direction of [-1, 1]) {
        const fighter = createFighter(character, 0.0, facing);
        fighter.motion.surface = 0;
        const input = controls({ shield: true, groundDodgePressed: true, groundDodgeDirection: direction });
        for (let frame = 1; frame <= GROUND_ROLL_FRAMES; frame++) {
          advanceSolo(fighter, 0, input, 0.0);
          input.groundDodgePressed = false;
        }
        assertGreaterThan(f32(fighter.motion.x * direction), 0.0);
        for (const state of [DownState.techRoll, DownState.roll]) {
          for (const faceUp of [false, true]) {
            const down = createFighter(character, 0.0, facing);
            down.motion.surface = 0;
            beginDownState(down, state, direction);
            down.down.faceUp = faceUp;
            const frames = state === DownState.techRoll ? TECH_ROLL_FRAMES : DOWN_ROLL_FRAMES;
            for (let frame = 1; frame <= frames; frame++) advanceSolo(down, 0, controls(), 0.0);
            assertGreaterThan(f32(down.motion.x * direction), 0.0);
          }
        }
      }
    }
  });
}

test("hero roll samples follow the body's run multiplier and Blademaster rolls farther than Mountain King", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const body = heroBody(character);
    if (body === undefined) continue;
    for (const kind of ["roll", "tech", "faceUpGetup", "faceDownGetup"] as const) {
      for (const direction of ["forward", "back"] as const) {
        for (let frame = 1; frame <= TECH_ROLL_FRAMES; frame++) {
          assertNear(rollTravel(character, kind, direction, frame), f32(rollTravel(Character.archer, kind, direction, frame) * body.run), 0.00009999999747378752);
        }
      }
    }
  }
  assertGreaterThan(forwardDistance(Character.blademaster), forwardDistance(Character.mountainKing));
});
