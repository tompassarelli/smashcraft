// A playtest request from the host (`bun wisp play`), once the player's
// controller helper is running: the computer opponents to add and their
// level, after which the match starts with every present human's default
// fighter on the default stage, with the menus' stock count and time limit.
// The request travels to every client as one synchronized line, so every
// client applies the same change; its spelling is a protocol shared with the
// host.
import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS, isParticipantMask, participantActive } from "../input/participants";
import {
  type MatchState, Phase, createMatchState, firstHumanSlot, humanFighterActive, humanPresent, requestStageSelect, requestStart, selectCharacter,
  selectStage, setCpuLevel, setParticipants,
} from "../match/rules";
import { isCpuLevel } from "../match/cpuLevel";

const PREFIX = "PLAY v=2 computers=";
const LEVEL = " level=";

export interface PlaytestRequest {
  /** The participant mask of the computers' slots. */
  readonly computers: number;
  /** Their level, 1-9. */
  readonly level: number;
}

/** The request line for computers at `level` in the slots of the participant mask `computers`. */
export const playtestRequest = (computers: number, level: number): string => `${PREFIX}${computers}${LEVEL}${level}`;

/** The computers and level a request line names; undefined for any other line. */
export function parsePlaytestRequest(line: string): PlaytestRequest | undefined {
  if (!line.startsWith(PREFIX)) return undefined;
  const rest = line.substring(PREFIX.length);
  const split = rest.indexOf(LEVEL);
  if (split < 0) return undefined;
  const computersText = rest.substring(0, split);
  const levelText = rest.substring(split + LEVEL.length);
  const computers = parseDecimal(computersText);
  const level = parseDecimal(levelText);
  if (computers === undefined || `${computers}` !== computersText || !isParticipantMask(computers)) return undefined;
  return level !== undefined && `${level}` === levelText && isCpuLevel(level) ? { computers, level } : undefined;
}

/**
 * Adds the computers and starts the match from fighter selection. False
 * outside fighter selection, without a human here, or when a computer would
 * take the slot of a human who is here.
 */
export function preparePlaytest(game: MatchState, { computers, level }: PlaytestRequest): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu || !isParticipantMask(computers) || !isCpuLevel(level)) return false;
  let humans = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const computer = participantActive(computers, slot);
    if (computer && humanPresent(game, slot)) return false;
    // Slots waiting for a human who isn't here are left empty.
    if (!computer && humanFighterActive(game, slot) && humanPresent(game, slot)) humans += 1 << slot;
  }
  if (!isParticipantMask(humans)) return false;
  setParticipants(game, humans, computers);
  for (const slot of PARTICIPANT_SLOTS) if (participantActive(computers, slot)) setCpuLevel(game, first, slot, level);
  const defaults = createMatchState();
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanFighterActive(game, slot) && humanPresent(game, slot)) selectCharacter(game, slot, defaults.characterChoices[slot]);
  }
  if (!requestStageSelect(game, first)) return false;
  selectStage(game, first, defaults.stageChoice);
  // The match starts once every client has loaded the stage (platform/shell/stageLoad.ts).
  return true;
}
