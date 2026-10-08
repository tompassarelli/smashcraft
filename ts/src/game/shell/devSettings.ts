import { scheduleMatchItems } from "../match/centreItem";
// Developer chat commands ("-dev rb 12", "-dev delay 2", "-dev batch 6",
// "-dev rematch 20", "-dev show", "-dev quick", "-dev quick hero NAME", "-dev quick cpu OPPONENT DIFFICULTY") arrive as synchronized
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
  selectCharacter, selectCpuCharacter, selectStage, setStocks, computerActive, cycleSlotMode, setCpuOpponent, setCpuTier, setHitAreas, setPartnerDamage, setTraining, stepPartnerBehaviour,
} from "../match/rules";
import { isCpuOpponentChoice, isCpuTier, type CpuOpponentChoice, type CpuTier } from "../match/cpuProfiles";
import { PartnerBehaviour } from "../match/trainingState";
import { selectableStage } from "../menu/stageCatalog";
import { REPLAY_MAX_CORRECTION_FRAMES } from "../replay/limits";
import type { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { isScenario, type Scenario } from "./build";

export interface DevSettings {
  /** An explicit setup choice made before the stage menu opens. */
  stageChoice?: number | undefined;
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

/** `-dev quick hero NAME`: a quick match in which every present human plays NAME (a selectable fighter's name, any case), such as `-dev quick hero mountain king`. */
export const QUICK_HERO_COMMAND = "-dev quick hero ";

export function quickMatchHero(message: string): Character | undefined {
  return heroAfter(message, QUICK_HERO_COMMAND);
}

export function quickMatchPair(message: string): readonly [Character, Character] | undefined {
  const prefix = "-dev quick pair ";
  if (!message.startsWith(prefix)) return undefined;
  const names = message.substring(prefix.length).split(" / ");
  if (names.length !== 2) return undefined;
  const first = heroAfter(`${QUICK_HERO_COMMAND}${names[0]}`, QUICK_HERO_COMMAND);
  const second = heroAfter(`${QUICK_HERO_COMMAND}${names[1]}`, QUICK_HERO_COMMAND);
  return first === undefined || second === undefined ? undefined : [first, second];
}

/** Starts a named fighter tumbling above the floor, for recovery captures. */
export const QUICK_RECOVERY_HERO_COMMAND = "-dev quick recovery hero ";

export function quickRecoveryHero(message: string): Character | undefined {
  return heroAfter(message, QUICK_RECOVERY_HERO_COMMAND);
}

export function quickOffstageHero(message: string): Character | undefined {
  return heroAfter(message, "-dev quick offstage hero ");
}

export function quickPainHero(message: string): { readonly character: Character; readonly scenario: Scenario } | undefined {
  const words = message.split(" ");
  if (words[0] !== "-dev" || words[1] !== "pain") return undefined;
  const scenario = `pain-${words[2]}-${words[3]}`;
  if (!isScenario(scenario)) return undefined;
  const character = heroAfter(`${QUICK_HERO_COMMAND}${words.slice(4).join(" ")}`, QUICK_HERO_COMMAND);
  return character === undefined ? undefined : { character, scenario };
}

function heroAfter(message: string, prefix: string): Character | undefined {
  if (!message.startsWith(prefix)) return undefined;
  const wanted = message.substring(prefix.length).toLowerCase();
  for (const character of SELECTABLE_CHARACTERS) if (fighterName(character).toLowerCase() === wanted) return character;
  return undefined;
}

/**
 * `-dev reset`: ends any match and puts every client back at fighter
 * selection exactly as the map started it, so the next `-dev quick` match
 * equals the first match of a new game (seed, rules and confirmed state).
 * A native pad batch types it between scripts instead of starting a new game.
 */
export const RESET_COMMAND = "-dev reset";

/** Desynchronizes the game on purpose, to check that the host names what diverged. */
export const DESYNC_COMMAND = "-dev desync";

/**
 * Readies every present human with `character`, else their slot's default
 * fighter, and starts
 * a one-stock match on the default stage, from either menu. False, with no match
 * started, when the menus could not start one.
 */
export function prepareQuickMatch(game: MatchState, stage = 0, character?: Character | readonly Character[], stocks = 1): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return false;
  returnToCharacters(game, first);
  const defaults = createMatchState().characterChoices;
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanFighterActive(game, slot) && humanPresent(game, slot)) selectCharacter(game, slot, typeof character === "number" ? character : character?.[slot] ?? defaults[slot]);
  }
  setStocks(game, first, stocks);
  if (!requestStageSelect(game, first)) return false;
  selectStage(game, first, stage);
  if (!requestStart(game, first)) return false;
  // A developer's quick match skips the countdown: tests and captures drive it from its first frame.
  game.startHold = 0;
  scheduleMatchItems(game);
  return true;
}

/** Classic's native route check (#284): `-dev classic NAME` starts that fighter's run, `-dev classic boss NAME` its final battle. */
export const CLASSIC_COMMAND = "-dev classic ";

export function classicDevRequest(message: string): { readonly character: Character; readonly boss: boolean } | undefined {
  const boss = heroAfter(message, `${CLASSIC_COMMAND}boss `);
  if (boss !== undefined) return { character: boss, boss: true };
  const character = heroAfter(message, CLASSIC_COMMAND);
  return character === undefined ? undefined : { character, boss: false };
}

/** Lore Battles' native check (#305): `-dev lore N` starts battle N of the list, from 1. */
export const LORE_COMMAND = "-dev lore ";

export function loreDevRequest(message: string, battles: number): number | undefined {
  if (!message.startsWith(LORE_COMMAND)) return undefined;
  const battle = commandInteger(message.substring(LORE_COMMAND.length));
  return battle !== undefined && battle >= 1 && battle <= battles ? battle : undefined;
}

/** Training's native check (#120): a computer partner shielding at 40%, hit areas on, then the quick match. */
export const QUICK_TRAINING_COMMAND = "-dev quick training";

export function prepareQuickTraining(game: MatchState): void {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu) return;
  const partner = PARTICIPANT_SLOTS.find(slot => !humanFighterActive(game, slot) && !computerActive(game, slot));
  if (partner !== undefined) for (let step = 0; step < 2; step++) cycleSlotMode(game, first, partner);
  setTraining(game, first, true);
  setHitAreas(game, first, true);
  setPartnerDamage(game, first, 40);
  while (game.trainer.behaviour !== PartnerBehaviour.shield) stepPartnerBehaviour(game, first, 1);
}

/** A named computer in the first free slot, over three stocks for native captures. */
export const QUICK_CPU_COMMAND = "-dev quick cpu ";
export const QUICK_CPU_STOCKS = 3;

export interface QuickCpuProfile { readonly opponent: CpuOpponentChoice; readonly tier: CpuTier }

export function quickMatchCpuProfile(message: string): QuickCpuProfile | undefined {
  if (!message.startsWith(QUICK_CPU_COMMAND)) return undefined;
  const rest = message.substring(QUICK_CPU_COMMAND.length);
  const marker = rest.indexOf(" hero ");
  if (marker >= 0 && quickMatchCpuHero(message) === undefined) return undefined;
  const settings = marker < 0 ? rest : rest.substring(0, marker);
  const split = settings.indexOf(" ");
  if (split < 0) return undefined;
  const opponent = settings.substring(0, split);
  const tier = settings.substring(split + 1);
  return isCpuOpponentChoice(opponent) && isCpuTier(tier) ? { opponent, tier } : undefined;
}

/** A named CPU uses the menu's own selection rule, for roster parity batches. */
export function quickMatchCpuHero(message: string): Character | undefined {
  const marker = message.indexOf(" hero ", QUICK_CPU_COMMAND.length);
  return message.startsWith(QUICK_CPU_COMMAND) && marker >= 0 ? heroAfter(message, message.substring(0, marker + 6)) : undefined;
}

/** Fills the first free slot with a computer with `profile`, from fighter selection; the quick match follows. */
export function prepareQuickCpu(game: MatchState, profile: QuickCpuProfile, character?: Character): void {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu) return;
  const computer = PARTICIPANT_SLOTS.find(slot => !humanFighterActive(game, slot) && !computerActive(game, slot));
  if (computer === undefined) return;
  // An empty slot becomes a human fighter, then a computer.
  for (let step = 0; step < 2; step++) cycleSlotMode(game, first, computer);
  setCpuOpponent(game, first, computer, profile.opponent);
  setCpuTier(game, first, computer, profile.tier);
  if (character !== undefined) selectCpuCharacter(game, first, computer, character);
}
