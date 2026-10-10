import { assertEquals, test } from "wisp/src/runtime/testing";
import { executeNext, testMatch } from "../match/testMatch";
import { Character, SpecialAction } from "./codes";
import { TURNAROUND_SPECIAL_WINDOW_FRAMES } from "./fighter";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { type Controls, copyControls, fighterAt } from "./roster";
import { controls } from "./testWorld";

const back = controls({ direction: -1 });
const neutralB = controls({ specialPressed: true });

interface Outcome { readonly facing: number; readonly action: number; readonly direction: number }

function play(character: Character, airborne: boolean, script: readonly Readonly<Controls>[]): Outcome {
  const match = testMatch(3, character);
  const fighter = fighterAt(match.world, 0);
  fighterAt(match.world, 1).motion.x = 900.0;
  fighter.motion.x = -300.0;
  for (let frame = 0; frame < 3; frame++) {
    copyControls(match.inputs.inputs[0], controls());
    executeNext(match);
  }
  if (airborne) {
    fighter.motion.grounded = false;
    fighter.motion.surface = undefined;
    fighter.motion.z = 700.0;
    fighter.motion.vz = 0.0;
    fighter.motion.vx = 0.0;
  }
  fighter.facing = 1;
  for (const input of script) {
    copyControls(match.inputs.inputs[0], input);
    executeNext(match);
  }
  return { facing: fighter.facing, action: fighter.special.action, direction: fighter.special.direction };
}

function name(character: Character): string {
  for (const [key, value] of Object.entries(Character)) if (value === character) return key;
  return `${character}`;
}

function assertTurned(character: Character, label: string, outcome: Outcome): void {
  const where = `${name(character)} ${label}`;
  assertEquals(outcome.action !== SpecialAction.none, true, `${where}: no special started`);
  assertEquals(outcome.facing, -1, `${where}: facing`);
  assertEquals(outcome.direction, -1, `${where}: special direction`);
}

/** A one-frame flick back, `gap` neutral frames, then B: B lands `gap + 1` input frames after the flick. */
function flickThen(gap: number, press: Readonly<Controls>): Readonly<Controls>[] {
  const script = [back];
  for (let frame = 0; frame < gap; frame++) script.push(controls());
  script.push(press);
  return script;
}

test("every fighter's airborne neutral special turns to a flick back within the window, and only within it [k3 measure #187]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    assertTurned(character, "air neutral, B with the flick", play(character, true, flickThen(0, neutralB)));
    assertTurned(character, "air neutral, B at the window's end", play(character, true, flickThen(TURNAROUND_SPECIAL_WINDOW_FRAMES - 1, neutralB)));
    const late = play(character, true, flickThen(TURNAROUND_SPECIAL_WINDOW_FRAMES, neutralB));
    assertEquals(late.action !== SpecialAction.none, true, `${name(character)} late air neutral: no special started`);
    assertEquals(late.facing, 1, `${name(character)} late air neutral: facing`);
    assertEquals(play(character, true, [neutralB]).facing, 1, `${name(character)} air neutral without a flick: facing`);
  }
});

