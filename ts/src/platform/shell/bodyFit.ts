// Developer-only native fixtures: a mirrored fighter pair at the unchanged
// ECB stopping positions, held for ten seconds so the native owner can capture.
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { Phase } from "../../game/match/rules";
import { Character } from "../../game/sim/codes";
import { startMatch } from "./matchStart";
import type { ShellState } from "./state";

export function startBodyFit(s: ShellState, message: string): string | undefined {
  const words = message.split(" ");
  if (words.length !== 4 || words[0] !== "-dev" || words[1] !== "fit") return undefined;
  const character = words[2] === "archer" ? Character.archer
    : words[2] === "rifleman" ? Character.rifleman
    : words[2] === "illidan" ? Character.demonHunter : undefined;
  const scenario = words[3] === "ceiling" ? "body-ceiling" : words[3] === "wall" ? "body-wall" : undefined;
  if (character === undefined || scenario === undefined) return "dev: fit needs archer, rifleman or illidan, then ceiling or wall";
  if (s.game.phase !== Phase.match) return "dev: start a quick match before fit";
  // A diagnostic restarts the live match with newly created matching renderers.
  for (const slot of PARTICIPANT_SLOTS) s.game.characterChoices[slot] = character;
  startMatch(s, scenario);
  return `dev: ${words[2]} ${words[3]} body fit, both facings, held for 10 s`;
}
