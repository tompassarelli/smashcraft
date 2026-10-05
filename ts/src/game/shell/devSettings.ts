// Developer chat commands ("-dev rb 12", "-dev delay 2", "-dev batch 1",
// "-dev show", "-dev quick") arrive as synchronized player-chat events. A
// match reads the settings once at its start, so a command typed during a
// match applies from the next match on every client; "-dev quick" starts one
// at once. The receipts are read by the integrity harness, so their spellings
// are a protocol.
import { type FixedDelay, isFixedDelay } from "../netcode/fixedSchedule";
import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS } from "../input/participants";
import {
  type MatchState, Phase, createMatchState, firstHumanSlot, humanFighterActive, humanPresent, requestStageSelect, requestStart, returnToCharacters,
  selectCharacter, selectStage,
} from "../match/rules";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";

/** Journal packets carried by one synchronized message. */
export type BatchSize = 1 | 2;

export interface DevSettings {
  rollback: number;
  delay: FixedDelay;
  batch: BatchSize;
}

export function describeDevSettings({ rollback, delay, batch }: Readonly<DevSettings>): string {
  return `dev: next match rb=${rollback} delay=${delay} batch=${batch}`;
}

/** Digits exactly as I2S would print them, so "07" and "64x" are not numbers. */
function commandInteger(text: string): number | undefined {
  const value = parseDecimal(text);
  return value !== undefined && `${value}` === text ? value : undefined;
}

/** Applies a recognized command and returns its confirmation; undefined for any other message. */
export function applyDevCommand(settings: DevSettings, message: string): string | undefined {
  if (message === "-dev show") return describeDevSettings(settings);
  if (message.startsWith("-dev rb ")) {
    const value = commandInteger(message.substring(8));
    if (value === undefined || value < 1 || value > REPLAY_MAX_CORRECTION_FRAMES) return `dev: rb must be 1-${REPLAY_MAX_CORRECTION_FRAMES}`;
    settings.rollback = value;
    return describeDevSettings(settings);
  }
  if (message.startsWith("-dev delay ")) {
    const value = commandInteger(message.substring(11));
    if (value === undefined || !isFixedDelay(value)) return "dev: delay must be 0, 1, 2, 3 or 5";
    settings.delay = value;
    return describeDevSettings(settings);
  }
  if (message.startsWith("-dev batch ")) {
    const value = commandInteger(message.substring(11));
    if (value !== 1 && value !== 2) return "dev: batch must be 1 or 2";
    settings.batch = value;
    return describeDevSettings(settings);
  }
  return undefined;
}

/** Starts a match with no menu navigation, for the fresh-match loop. */
export const QUICK_MATCH_COMMAND = "-dev quick";

/**
 * Readies every present human with their slot's default fighter and starts
 * the match on the default stage, from either menu. False, with no match
 * started, when the menus could not start one.
 */
export function prepareQuickMatch(game: MatchState): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return false;
  returnToCharacters(game, first);
  const defaults = createMatchState().characterChoices;
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanFighterActive(game, slot) && humanPresent(game, slot)) selectCharacter(game, slot, defaults[slot]);
  }
  if (!requestStageSelect(game, first)) return false;
  selectStage(game, first, createMatchState().stageChoice);
  return requestStart(game, first);
}
