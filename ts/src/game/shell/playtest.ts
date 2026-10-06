// A playtest request from the host (`bun wisp play`), once the player's
// controller helper is running: the computer opponents to add, after which
// the match starts with every present human's default fighter on the default
// stage, with the menus' stock count and time limit. The request travels to
// every client as one synchronized line, so every client applies the same
// change; its spelling is a protocol shared with the host.
import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS, isParticipantMask, participantActive } from "../input/participants";
import {
  type MatchState, Phase, createMatchState, firstHumanSlot, humanFighterActive, humanPresent, requestStageSelect, requestStart, selectCharacter,
  selectStage, setParticipants,
} from "../match/rules";

const PREFIX = "PLAY v=1 computers=";

/** The request line for computers in the slots of the participant mask `computers`. */
export const playtestRequest = (computers: number): string => `${PREFIX}${computers}`;

/** The computer mask a request line names; undefined for any other line. */
export function parsePlaytestRequest(line: string): number | undefined {
  if (!line.startsWith(PREFIX)) return undefined;
  const text = line.substring(PREFIX.length);
  const computers = parseDecimal(text);
  return computers !== undefined && `${computers}` === text && isParticipantMask(computers) ? computers : undefined;
}

/**
 * Adds the computers and starts the match from fighter selection. False
 * outside fighter selection, without a human here, or when a computer would
 * take the slot of a human who is here.
 */
export function preparePlaytest(game: MatchState, computers: number): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu || !isParticipantMask(computers)) return false;
  let humans = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const computer = participantActive(computers, slot);
    if (computer && humanPresent(game, slot)) return false;
    // Slots waiting for a human who isn't here are left empty.
    if (!computer && humanFighterActive(game, slot) && humanPresent(game, slot)) humans += 1 << slot;
  }
  if (!isParticipantMask(humans)) return false;
  setParticipants(game, humans, computers);
  const defaults = createMatchState();
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanFighterActive(game, slot) && humanPresent(game, slot)) selectCharacter(game, slot, defaults.characterChoices[slot]);
  }
  if (!requestStageSelect(game, first)) return false;
  selectStage(game, first, defaults.stageChoice);
  return requestStart(game, first);
}
