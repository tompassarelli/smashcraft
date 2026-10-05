// The fighters standing on the stage: rebuilt from the selected roster
// whenever the selection changes and at the start of every match.
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { characterFor, fighterMask } from "../../game/match/rules";
import { matchSpawnX } from "../../game/match/step";
import { Character } from "../../game/sim/codes";
import { createFighter } from "../../game/sim/fighter";
import { copyControls, isActive, neutralControls } from "../../game/sim/roster";
import { createFighterBody, removeFighterBody } from "./fighterBody";
import { clearAllInputs } from "./inputs";
import type { ShellState } from "./state";
import { endFighter, layoutHuds, views } from "./ui";

const NEUTRAL = neutralControls();

/** Removes every fighter's unit and renderers and ends their effects. */
function removeFighters(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) {
    const participant = s.participants[slot];
    endFighter(s, slot);
    participant.pooled = false;
    if (participant.body === undefined) continue;
    removeFighterBody(participant.body);
    participant.body = undefined;
    s.world.fighters[slot] = undefined;
  }
  const ui = views(s);
  ui.frost.clear();
  ui.special.clear();
  ui.combat.clear();
}

/** Stands each selected fighter at its spawn, facing the middle of the stage. */
export function makePreview(s: ShellState): void {
  clearAllInputs(s);
  removeFighters(s);
  for (const slot of PARTICIPANT_SLOTS) copyControls(s.produced.inputs[slot], NEUTRAL);
  s.world.mask = fighterMask(s.game);
  layoutHuds(s);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot)) continue;
    const x = matchSpawnX(slot);
    const fighter = createFighter(characterFor(s.game, slot) ?? Character.archer, x, x < 0 ? 1 : -1);
    s.world.fighters[slot] = fighter;
    const body = createFighterBody(Player(slot), fighter, s.origin);
    s.participants[slot].body = body;
    SetUnitAnimation(body.unit, "stand");
  }
}
