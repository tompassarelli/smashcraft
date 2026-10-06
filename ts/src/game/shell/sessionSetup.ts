// Developer chat commands that set up a match at fighter selection without
// the menus' pointer targets, so native bot and integrity sessions are driven
// by commands and receipts rather than clicks and screen reading:
//   -dev slots HUMANS COMPUTERS   fighter slot masks, as menu receipts print them
//   -dev fighter P NAME           player P's fighter (a computer's, or the typist's own)
//   -dev stocks N, -dev time MINUTES, -dev auto-rematch on|off
//   -dev stage ID                 a stage catalog id, at fighter or stage selection
// Each applies the menus' own rule for the player who typed it, so a command
// can do only what that player's clicks could. The developer receipt's SETUP
// line (journalFiles.ts) reports the resulting state; automation confirms a
// command by the receipt counter, then checks that state. The spellings are a
// protocol shared with smashcraft:ts/scripts/integrity/journey.ts.
import { parseDecimal } from "../netcode/journal/decimal";
import { PARTICIPANT_SLOTS, isParticipantMask, isParticipantSlot } from "../input/participants";
import {
  type MatchState, Phase, computerActive, cycleSlotMode, humanActive, humanFighterActive, selectCharacter, selectCpuCharacter, setAutomaticRematch,
  setStocks, setTimeLimit,
} from "../match/rules";
import { selectableStage } from "../menu/stageCatalog";
import type { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";

export const SLOTS_COMMAND = "-dev slots ";
export const FIGHTER_COMMAND = "-dev fighter ";
export const STOCKS_COMMAND = "-dev stocks ";
export const TIME_COMMAND = "-dev time ";
export const AUTO_REMATCH_COMMAND = "-dev auto-rematch ";
export const STAGE_COMMAND = "-dev stage ";

/** Digits exactly as I2S would print them. */
function integer(text: string): number | undefined {
  const value = parseDecimal(text);
  return value !== undefined && `${value}` === text ? value : undefined;
}

function characterNamed(name: string): Character | undefined {
  const wanted = name.toLowerCase();
  for (const character of SELECTABLE_CHARACTERS) if (fighterName(character).toLowerCase() === wanted) return character;
  return undefined;
}

/** Cycles each slot's tag (HMN, CPU, EMPTY) as its owner's clicks would until the masks hold. */
function setSlots(game: MatchState, actor: number, humans: number, computers: number): boolean {
  if (!isParticipantMask(humans) || (computers !== 0 && !isParticipantMask(computers)) || (humans & computers) !== 0) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    const bit = 1 << slot;
    for (let cycle = 0; cycle < 3; cycle++) {
      if (humanFighterActive(game, slot) === ((humans & bit) !== 0) && computerActive(game, slot) === ((computers & bit) !== 0)) break;
      if (!cycleSlotMode(game, actor, slot)) return false;
    }
  }
  return game.humanFighterMask === humans && game.computerMask === computers;
}

/**
 * Applies a session setup command typed by `actor` and returns its
 * confirmation, "refused" when the menus' rules don't allow it; undefined
 * for any other message.
 */
export function applySetupCommand(game: MatchState, actor: number, message: string): string | undefined {
  const refused = (what: string) => `dev: ${what} refused`;
  if (message.startsWith(SLOTS_COMMAND)) {
    const [humansText, computersText, extra] = message.substring(SLOTS_COMMAND.length).split(" ");
    const humans = integer(humansText ?? "");
    const computers = integer(computersText ?? "");
    if (humans === undefined || computers === undefined || extra !== undefined || !setSlots(game, actor, humans, computers)) return refused("slots");
    return `dev: slots human-fighters=${humans} computers=${computers}`;
  }
  if (message.startsWith(FIGHTER_COMMAND)) {
    const rest = message.substring(FIGHTER_COMMAND.length);
    const space = rest.indexOf(" ");
    const player = integer(space < 0 ? rest : rest.substring(0, space));
    const character = space < 0 ? undefined : characterNamed(rest.substring(space + 1));
    const slot = player === undefined ? -1 : player - 1;
    if (character === undefined || !isParticipantSlot(slot)) return refused("fighter");
    if (computerActive(game, slot)) selectCpuCharacter(game, actor, slot, character);
    else if (slot === actor) selectCharacter(game, slot, character);
    if (game.characterChoices[slot] !== character || !game.characterReadiness[slot]) return refused("fighter");
    return `dev: player ${player} plays ${fighterName(character)}`;
  }
  if (message.startsWith(STOCKS_COMMAND)) {
    const count = integer(message.substring(STOCKS_COMMAND.length));
    if (count === undefined) return refused("stocks");
    setStocks(game, actor, count);
    return game.stockCount === count ? `dev: ${count} stocks` : refused("stocks");
  }
  if (message.startsWith(TIME_COMMAND)) {
    const minutes = integer(message.substring(TIME_COMMAND.length));
    if (minutes === undefined) return refused("time");
    setTimeLimit(game, actor, minutes);
    return game.timeLimitMinutes === minutes ? `dev: ${minutes} minutes` : refused("time");
  }
  if (message.startsWith(AUTO_REMATCH_COMMAND)) {
    const value = message.substring(AUTO_REMATCH_COMMAND.length);
    if (value !== "on" && value !== "off") return refused("automatic rematch");
    setAutomaticRematch(game, actor, value === "on");
    return game.automaticRematch === (value === "on") ? `dev: automatic rematch ${value}` : refused("automatic rematch");
  }
  if (message.startsWith(STAGE_COMMAND)) {
    const stage = integer(message.substring(STAGE_COMMAND.length));
    // The stage menu's own choice, made early: any player here may choose, at either menu.
    if (stage === undefined || !selectableStage(stage) || !humanActive(game, actor) || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return refused("stage");
    game.stageChoice = stage;
    return `dev: stage ${stage}`;
  }
  return undefined;
}
