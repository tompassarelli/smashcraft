// Grabs against jump out of shield (#107), through the match step for every
// pair of selectable fighters: a grab started on the frame a shielding
// opponent jumps catches it early in its ascent, and a grab that arrives
// after the early-ascent window misses the jumper above it.
// smashcraft:docs/gameplay-design.md ("Throw roles").
import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { beginFighterAttack, resolveAttacks } from "../sim/attacks";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { EARLY_ASCENT_GRAB_FRAMES, attackStartupFrames } from "../sim/moves";
import { type Controls, type Roster, copyControls, createRoster, fighterAt, neutralControls } from "../sim/roster";
import { SHIELD_MIN_HOLD_FRAMES } from "../sim/shield";
import { controls } from "../sim/testWorld";
import { type FrameControls, createBufferedFrameControls } from "./controls";
import { type MatchState, Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";

/** Centres 40 apart: inside every standing grab's reach. */
const GAP = 40.0;

interface Duel {
  readonly game: MatchState;
  readonly world: Roster;
  readonly controls: FrameControls;
  frame: number;
}

/** The grabber in slot 0 facing the defender in slot 1, which holds a raised shield. */
function duel(grabber: Character, defender: Character): Duel {
  const game = createMatchState();
  game.phase = Phase.match;
  const shielding = createFighter(defender, f32(GAP / 2), -1);
  shielding.shield.raised = true;
  shielding.shield.heldFrames = SHIELD_MIN_HOLD_FRAMES;
  return { game, world: createRoster(3, [createFighter(grabber, f32(-GAP / 2), 1), shielding]), controls: createBufferedFrameControls(), frame: 0 };
}

function play(d: Duel, defender: Readonly<Controls>): void {
  d.frame++;
  copyControls(d.controls.inputs[0], neutralControls());
  copyControls(d.controls.inputs[1], defender);
  stepMatch(d.game, d.world, d.controls, d.frame);
}

const shield = (): Controls => controls({ shield: true, shieldTriggerActive: true, shieldStrength: 1.0 });
/** Jump pressed out of the held shield, then held: a full hop. */
const jumpOutOfShield = (): Controls => controls({ ...shield(), jumpPressed: true, jumpHeld: true });
const holdJump = (): Controls => controls({ jumpHeld: true });

test("a grab started as a shielding opponent jumps catches it early in the ascent", () => {
  for (const grabber of SELECTABLE_CHARACTERS) {
    for (const defender of SELECTABLE_CHARACTERS) {
      const d = duel(grabber, defender);
      const jumper = fighterAt(d.world, 1);
      queueAttack(d.controls.commands[0], { style: AttackStyle.grab, facing: 0, frame: d.frame + 1, mayCharge: false });
      play(d, jumpOutOfShield());
      for (let frame = 0; frame < 20 && jumper.grab.owner === undefined; frame++) play(d, holdJump());
      const pair = `${fighterName(grabber)} grabbing ${fighterName(defender)}`;
      assertEquals(jumper.grab.owner, 0, pair);
      // Caught in the jump squat or within the window, never later.
      assertEquals(jumper.jump.ascent <= EARLY_ASCENT_GRAB_FRAMES, true, pair);
    }
  }
});

test("the early-ascent window ends after its last frame, so a late grab misses the jumper", () => {
  for (const grabber of SELECTABLE_CHARACTERS) {
    for (const defender of SELECTABLE_CHARACTERS) {
      for (const lastFrame of [true, false]) {
        const d = duel(grabber, defender);
        const jumper = fighterAt(d.world, 1);
        const owner = fighterAt(d.world, 0);
        play(d, jumpOutOfShield());
        // Through the last window frame, or one frame past it.
        while (jumper.jump.squat > 0 || jumper.jump.ascent < EARLY_ASCENT_GRAB_FRAMES) play(d, holdJump());
        if (!lastFrame) play(d, holdJump());
        const pair = `${fighterName(grabber)} grabbing ${fighterName(defender)} ${lastFrame ? "on" : "after"} the window's last frame`;
        assertEquals(jumper.jump.ascent > 0, lastFrame, pair);
        beginFighterAttack(d.world, 0, AttackStyle.grab, false);
        owner.attack.frame = attackStartupFrames(AttackStyle.grab, owner.tuning.moves);
        resolveAttacks(d.world);
        assertEquals(jumper.grab.owner === 0, lastFrame, pair);
      }
    }
  }
});
