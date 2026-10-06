// Developer chat commands ("-dev rb 12", "-dev delay 2", "-dev batch 6",
// "-dev rematch 20", "-dev show", "-dev quick") arrive as synchronized
// player-chat events. A match reads the settings once at its start, so a
// command typed during a match applies from the next match on every client;
// "-dev quick" starts one at once. The receipts are read by the integrity
// harness, so their spellings are a protocol.
import { type FixedDelay, isFixedDelay } from "../netcode/fixedSchedule";
import { parseDecimal } from "../netcode/journal/decimal";
import { MAX_BATCH } from "../netcode/journal/transport";
import { PARTICIPANT_SLOTS } from "../input/participants";
import {
  type MatchState, Phase, createMatchState, firstHumanSlot, humanFighterActive, humanPresent, requestStageSelect, requestStart, returnToCharacters,
  selectCharacter, selectStage, setStocks,
} from "../match/rules";
import { selectableStage } from "../menu/stageCatalog";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";

export interface DevSettings {
  rollback: number;
  delay: FixedDelay;
  /** Callbacks per synchronized input message, 1 to MAX_BATCH. */
  batch: number;
  /**
   * Seconds a result shows before the automatic rematch. Captures that
   * export a match's evidence at its result need longer than players do.
   */
  rematchSeconds: number;
}

/** The longest automatic-rematch countdown a developer command sets, in seconds. */
const MAX_REMATCH_SECONDS = 60;

function describeDevSettings({ rollback, delay, batch }: Readonly<DevSettings>): string {
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
    if (value === undefined || value < 1 || value > MAX_BATCH) return `dev: batch must be 1-${MAX_BATCH}`;
    settings.batch = value;
    return describeDevSettings(settings);
  }
  if (message.startsWith("-dev rematch ")) {
    const value = commandInteger(message.substring(13));
    if (value === undefined || value < 1 || value > MAX_REMATCH_SECONDS) return `dev: rematch must be 1-${MAX_REMATCH_SECONDS}`;
    settings.rematchSeconds = value;
    return `dev: automatic rematch after ${value} s`;
  }
  return undefined;
}

/** Starts a match with no menu navigation, for the fresh-match loop. */
export const QUICK_MATCH_COMMAND = "-dev quick";

/** A winter arena match for the native presentation capture. */
export const FROZEN_THRONE_QUICK_COMMAND = "-dev quick frozen-throne";

/** Native scenery acceptance can start each named stage from the menus. */
export function quickMatchStage(message: string): number | undefined {
  if (message === QUICK_MATCH_COMMAND) return 0;
  if (message === FROZEN_THRONE_QUICK_COMMAND) return 2;
  if (!message.startsWith("-dev quick stage ")) return undefined;
  const stage = commandInteger(message.substring(17));
  return stage !== undefined && selectableStage(stage) ? stage : undefined;
}

/** Desynchronizes the game on purpose, to check that the host names what diverged. */
export const DESYNC_COMMAND = "-dev desync";

/**
 * Readies every present human with their slot's default fighter and starts
 * a one-stock match on the default stage, from either menu. False, with no match
 * started, when the menus could not start one.
 */
export function prepareQuickMatch(game: MatchState, stage = 0): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return false;
  returnToCharacters(game, first);
  const defaults = createMatchState().characterChoices;
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanFighterActive(game, slot) && humanPresent(game, slot)) selectCharacter(game, slot, defaults[slot]);
  }
  setStocks(game, first, 1);
  if (!requestStageSelect(game, first)) return false;
  selectStage(game, first, stage);
  return requestStart(game, first);
}
