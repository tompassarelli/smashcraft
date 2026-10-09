import { scheduleMatchItems } from "../match/centreItem";
import { scheduleMeterDrops } from "../match/meterDrops";






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
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { SELECTABLE_CHARACTERS, fighterName } from "../sim/heroes/registry";
import { isScenario, type Scenario } from "./build";

export interface DevSettings {

  stageChoice?: number | undefined;
  rollback: number;
  delay: FixedDelay;

  batch: number;




  rematchSeconds: number;
}


const MAX_REMATCH_SECONDS = 60;

function describeDevSettings({ rollback, delay, batch }: Readonly<DevSettings>): string {
  return `dev: next match rb=${rollback} delay=${delay} batch=${batch}`;
}


function commandInteger(text: string): number | undefined {
  const value = parseDecimal(text);
  return value !== undefined && `${value}` === text ? value : undefined;
}


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
    if (value === undefined || !isFixedDelay(value)) return "dev: delay must be 0 to 8";
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


export const QUICK_MATCH_COMMAND = "-dev quick";


export const FROZEN_THRONE_QUICK_COMMAND = "-dev quick frozen-throne";


export function quickMatchStage(message: string): number | undefined {
  return quickStageSettings(message)?.stage;
}

export interface QuickStageSettings {
  readonly stage: number;
  lighting?: "stock" | "stage";
  backdrop?: "on" | "off";
  view?: "near" | "far" | "off";

  fog?: "on" | "off";
}

export function quickStageSettings(message: string): QuickStageSettings | undefined {
  if (message === QUICK_MATCH_COMMAND) return { stage: 0 };
  if (message === FROZEN_THRONE_QUICK_COMMAND) return { stage: 2 };
  if (!message.startsWith("-dev quick stage ")) return undefined;
  const words = message.substring(17).split(" ");
  const stage = commandInteger(words[0] ?? "");
  if (stage === undefined || !selectableStage(stage)) return undefined;
  const settings: QuickStageSettings = { stage };
  for (let index = 1; index < words.length; index += 2) {
    const option = words[index];
    const value = words[index + 1];
    if (option === "lighting" && (value === "stock" || value === "stage")) settings.lighting = value;
    else if (option === "backdrop" && (value === "on" || value === "off")) settings.backdrop = value;
    else if (option === "view" && (value === "near" || value === "far" || value === "off")) settings.view = value;
    else if (option === "fog" && (value === "on" || value === "off")) settings.fog = value;
    else return undefined;
  }
  return settings;
}


export const QUICK_HERO_COMMAND = "-dev quick hero ";

const QUICK_STOCKS_SUFFIX = " stocks ";

export function quickMatchStocks(message: string): number {
  const at = message.indexOf(QUICK_STOCKS_SUFFIX);
  if (at < 0) return 1;
  const stocks = commandInteger(message.substring(at + QUICK_STOCKS_SUFFIX.length));
  return stocks !== undefined && stocks >= 1 && stocks <= 9 ? stocks : 1;
}

export function quickMatchHero(message: string): Character | undefined {
  const at = message.indexOf(QUICK_STOCKS_SUFFIX);
  return heroAfter(at < 0 ? message : message.substring(0, at), QUICK_HERO_COMMAND);
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







export const RESET_COMMAND = "-dev reset";
/** Sets every fighter's super meter, for ultimate captures (#382). */
export const METER_COMMAND = "-dev meter ";


export const DESYNC_COMMAND = "-dev desync";







export function prepareQuickMatch(game: MatchState, stage = 0, character?: Character | readonly Character[], stocks = 1): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return false;
  returnToCharacters(game, first);
  const defaults = createMatchState().characterChoices;
  if (game.humanCount === 1 && game.humanFighterMask === game.humanMask && game.computerMask === 0) {
    const partner = PARTICIPANT_SLOTS.find(slot => !humanFighterActive(game, slot));
    if (partner !== undefined) prepareQuickCpu(game, { opponent: "wren", tier: "rookie" }, typeof character === "number" ? character : character?.[partner] ?? defaults[partner]);
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanFighterActive(game, slot) && humanPresent(game, slot)) selectCharacter(game, slot, typeof character === "number" ? character : character?.[slot] ?? defaults[slot]);
  }
  setStocks(game, first, stocks);
  if (!requestStageSelect(game, first)) return false;
  selectStage(game, first, stage);
  if (!requestStart(game, first)) return false;

  game.startHold = 0;
  scheduleMatchItems(game);
  scheduleMeterDrops(game);
  return true;
}


export const CLASSIC_COMMAND = "-dev classic ";

export function classicDevRequest(message: string): { readonly character: Character; readonly boss: boolean } | undefined {
  const boss = heroAfter(message, `${CLASSIC_COMMAND}boss `);
  if (boss !== undefined) return { character: boss, boss: true };
  const character = heroAfter(message, CLASSIC_COMMAND);
  return character === undefined ? undefined : { character, boss: false };
}


export const LORE_COMMAND = "-dev lore ";

export function loreDevRequest(message: string, battles: number): number | undefined {
  if (!message.startsWith(LORE_COMMAND)) return undefined;
  const battle = commandInteger(message.substring(LORE_COMMAND.length));
  return battle !== undefined && battle >= 1 && battle <= battles ? battle : undefined;
}


export const LORE_WIN_COMMAND = "-dev lore win";

export function winLoreBattle(game: MatchState, world: Roster): boolean {
  const { run } = game;
  if (!game.lore || !run.active || game.phase !== Phase.match) return false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (slot === run.player || !isActive(world, slot)) continue;
    const { status } = fighterAt(world, slot);
    status.stocks = 0;
    status.out = true;
  }
  run.boss.health = 0;
  return true;
}


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


export function quickMatchCpuHero(message: string): Character | undefined {
  const marker = message.indexOf(" hero ", QUICK_CPU_COMMAND.length);
  return message.startsWith(QUICK_CPU_COMMAND) && marker >= 0 ? heroAfter(message, message.substring(0, marker + 6)) : undefined;
}


export function prepareQuickCpu(game: MatchState, profile: QuickCpuProfile, character?: Character): void {
  const first = firstHumanSlot(game);
  if (first === undefined || game.phase !== Phase.characterMenu) return;
  const computer = PARTICIPANT_SLOTS.find(slot => !humanFighterActive(game, slot) && !computerActive(game, slot));
  if (computer === undefined) return;

  for (let step = 0; step < 2; step++) cycleSlotMode(game, first, computer);
  setCpuOpponent(game, first, computer, profile.opponent);
  setCpuTier(game, first, computer, profile.tier);
  if (character !== undefined) selectCpuCharacter(game, first, computer, character);
}

export function quickPromoRequest(message: string): { readonly stage: number; readonly pair: readonly [Character, Character] } | undefined {
  const prefix = "-dev quick promo stage ";
  if (!message.startsWith(prefix)) return undefined;
  const rest = message.substring(prefix.length);
  const marker = rest.indexOf(" pair ");
  if (marker < 0) return undefined;
  const stage = commandInteger(rest.substring(0, marker));
  const pair = quickMatchPair(`-dev quick pair ${rest.substring(marker + 6)}`);
  return stage === undefined || !selectableStage(stage) || pair === undefined ? undefined : { stage, pair };
}

export function prepareQuickPromo(game: MatchState, pair: readonly [Character, Character]): boolean {
  const first = firstHumanSlot(game);
  if (first === undefined || (game.phase !== Phase.characterMenu && game.phase !== Phase.stageMenu)) return false;
  returnToCharacters(game, first);
  for (const slot of PARTICIPANT_SLOTS) {
    const wanted = slot < 2;
    while (computerActive(game, slot) !== wanted || (!wanted && humanFighterActive(game, slot))) cycleSlotMode(game, first, slot);
    if (wanted) {
      setCpuOpponent(game, first, slot, "wren");
      setCpuTier(game, first, slot, "expert");
      selectCpuCharacter(game, first, slot, pair[slot === 0 ? 0 : 1]);
    }
  }
  setTraining(game, first, false);
  setHitAreas(game, first, false);
  return true;
}
