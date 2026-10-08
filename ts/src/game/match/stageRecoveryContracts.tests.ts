import { assertEquals } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { createFighter } from "../sim/fighter";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { copyControls, createRoster, neutralControls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight } from "../sim/stage";
import { chooseRecoveryInput } from "./botRecovery";
import { createFrameControls } from "./controls";
import { Phase, createMatchState } from "./rules";
import { stepMatch } from "./step";
import { sweep } from "../../runtime/sweep";

// Every main-deck profile (smashcraft:docs/design/stages.md, "Main-deck topology")
// must let every fighter back onto the stage from below either ledge.
sweep("every fighter recovers onto every stage's main deck from below either ledge [spec #115]", () => {
  for (const { id: stage, name } of STAGE_CATALOG) {
    for (const character of SELECTABLE_CHARACTERS) {
      for (const side of [-1, 1]) for (const [z, jumps] of [[-40.0, 0], [-120.0, 1]] as const) {
        const ledge = side < 0 ? mainDeckLeft(stage) : mainDeckRight(stage);
        const fighter = createFighter(character, ledge + side * 80.0, -side);
        const opponent = createFighter(character, 0.0, side);
        const game = createMatchState();
        game.phase = Phase.match;
        game.stageChoice = stage;
        fighter.motion.z = z;
        fighter.motion.vz = -4.0;
        fighter.motion.grounded = false;
        fighter.motion.surface = undefined;
        fighter.jump.remaining = jumps;
        const input = neutralControls();
        const controls = createFrameControls();
        for (let frame = 1; frame <= 300 && !fighter.motion.grounded; frame++) {
          input.direction = 0;
          input.jumpPressed = false;
          input.jumpHeld = false;
          chooseRecoveryInput(fighter, stage, frame, input);
          copyControls(controls.inputs[0], input);
          copyControls(controls.inputs[1], neutralControls());
          stepMatch(game, createRoster(3, [fighter, opponent]), controls, frame);
        }
        const where = `${name}: character ${character} from side ${side} at ${z} with ${jumps} jumps`;
        assertEquals(fighter.status.out, false, `${where} was knocked out`);
        assertEquals(fighter.motion.grounded, true, `${where} never landed`);
      }
    }
  }
});
