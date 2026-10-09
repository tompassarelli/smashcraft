import { CLASSIC_CHARACTERS, classicRoute } from "../classic/routes";
import { type StagePool, createStagePool, copyStagePool, nextPoolStage, consumePoolStage, togglePoolMode, togglePoolStage } from "../menu/stagePool";
import { PLAYABLE_CHARACTERS, isSelectableCharacter, nextCharacterIn } from "../sim/heroes/registry";
import { RANDOM_STAGE, selectableStageChoice } from "../menu/stageCatalog";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type MatchCamera, createMatchCamera, copyMatchCamera } from "../sim/matchCamera";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantMask, isParticipantSlot, participantActive } from "../input/participants";
import { Character, ItemKind, itemBit } from "../sim/codes";
import { scheduleMatchItems } from "./centreItem";
import { nextMatchSeed } from "./botRandom";
import { CPU_OPPONENT_DEFAULT, CPU_TIERS, CPU_TIER_DEFAULT, type CpuOpponentChoice, type CpuOpponentId, type CpuTier, isCpuOpponentChoice, isCpuTier, resolveCpuOpponent } from "./cpuProfiles";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { type MatchItems, copyMatchItems, createMatchItems } from "./items";
import { STAGE_AT_REST } from "../sim/stage";

import { type ConfiguredRun, copyConfiguredRun, createConfiguredRun } from "../classic/runState";
import { PARTNER_BEHAVIOURS, PARTNER_DAMAGE_MAX, PARTNER_DAMAGE_STEP, PARTNER_ESCAPES, PARTNER_TECHS, TRAINING_SPEEDS, type TrainingState, clearTrainingReadout, copyTrainingState, createTrainingState } from "./trainingState";


export const Phase = { characterMenu: 0, stageMenu: 1, match: 2, result: 3 } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
export const MATCH_TICKS_PER_SECOND = 60;

export const CLASSIC_TIER_DEFAULT = 1;

export interface MatchState {
  readonly camera: MatchCamera;
  phase: Phase;
  readonly characterChoices: Slots<Character>;
  readonly cpuOpponents: Slots<CpuOpponentChoice>;
  readonly cpuTiers: Slots<CpuTier>;

  readonly cpuResolvedOpponents: Slots<CpuOpponentId>;
  readonly characterReadiness: Slots<boolean>;
  readonly rematchReadiness: Slots<boolean>;
  departedMask: number;
  interrupted: boolean;

  humanMask: number;
  humanFighterMask: number;
  humanCount: number;
  computerMask: number;
  stageChoice: number;
  stageResolved: boolean;
  readonly stagePool: StagePool;

  hazards: boolean;

  winner: ParticipantSlot | undefined;
  stockCount: number;
  timeLimitMinutes: number;

  endless: boolean;

  automaticRematch: boolean;

  rematchCountdown: number;
  remainingFrames: number;

  matchSeed: number;

  startHold: number;

  matchFrame: number;
  timedOut: boolean;
  practice: boolean;

  training: boolean;
  readonly trainer: TrainingState;

  readonly items: MatchItems;

  classic: boolean;
  classicTier: number;

  lore: boolean;
  loreBattle: number;

  readonly run: ConfiguredRun;
}


const defaultChoice = (index: number): Character => PLAYABLE_CHARACTERS[floorMod(index, PLAYABLE_CHARACTERS.length)] ?? Character.rifleman;

export function createMatchState(): MatchState {
  return {
    camera: createMatchCamera(),
    phase: Phase.characterMenu, characterChoices: [defaultChoice(0), defaultChoice(1), defaultChoice(2), defaultChoice(0)], matchSeed: 0,
    cpuOpponents: [CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT],
    cpuTiers: [CPU_TIER_DEFAULT, CPU_TIER_DEFAULT, CPU_TIER_DEFAULT, CPU_TIER_DEFAULT],
    cpuResolvedOpponents: [CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT, CPU_OPPONENT_DEFAULT],
    characterReadiness: [false, false, false, false], rematchReadiness: [false, false, false, false],
    departedMask: 0, interrupted: false, humanMask: 1, humanFighterMask: 1, humanCount: 1, computerMask: 0,
    stageChoice: 2, hazards: true, stageResolved: false, stagePool: createStagePool(), winner: undefined, stockCount: 3, timeLimitMinutes: 7, endless: false, automaticRematch: false, rematchCountdown: 0,

    remainingFrames: 7 * 60 * MATCH_TICKS_PER_SECOND, startHold: 0, matchFrame: 0, timedOut: false, practice: false,
    training: false, trainer: createTrainingState(), items: createMatchItems(),
    classic: false, classicTier: CLASSIC_TIER_DEFAULT, lore: false, loreBattle: 0, run: createConfiguredRun(),
  };
}


export const humanActive = (game: Readonly<MatchState>, slot: number): boolean => {
  const mask = game.humanMask;
  return mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;
};
export const humanPresent = (game: Readonly<MatchState>, slot: number): boolean => humanActive(game, slot) && !participantActive(game.departedMask, slot);
export const humanFighterActive = (game: Readonly<MatchState>, slot: number): boolean => {
  const mask = game.humanFighterMask;
  return mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;
};
export const computerActive = (game: Readonly<MatchState>, slot: number): boolean => {
  const mask = game.computerMask;
  return mask > 0 && mask < 16 && slot >= 0 && slot < 4 && (mask & (1 << slot)) !== 0;
};

export function firstHumanSlot(game: Readonly<MatchState>): ParticipantSlot | undefined {
  return PARTICIPANT_SLOTS.find(slot => humanActive(game, slot));
}

export function cpuSlot(game: Readonly<MatchState>): ParticipantSlot | undefined {
  return PARTICIPANT_SLOTS.find(slot => computerActive(game, slot));
}

export function canChooseComputer(game: Readonly<MatchState>, actor: number, computer: number): boolean {
  return humanPresent(game, actor) && (actor === firstHumanSlot(game) || actor === computer) && computerActive(game, computer);
}

export function fighterMask(game: Readonly<MatchState>): number {
  return game.practice && game.phase === Phase.match ? game.humanFighterMask : game.humanFighterMask + game.computerMask;
}

export const fighterActive = (game: Readonly<MatchState>, slot: number): boolean => participantActive(fighterMask(game), slot);

export function updateConnectedHumans(game: MatchState, humans: number): void {
  if (!isParticipantMask(humans) || game.phase === Phase.match) return;
  game.humanMask = humans;
  game.departedMask = 0;
  game.interrupted = false;
  game.humanCount = PARTICIPANT_SLOTS.filter(slot => humanActive(game, slot)).length;
}

export function setParticipants(game: MatchState, humans: number, computers: number): void {
  if (!isParticipantMask(humans) || computers < 0 || computers >= 16 || game.phase === Phase.match || (humans & computers) !== 0) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (humanActive(game, slot) !== participantActive(humans, slot) || computerActive(game, slot) !== participantActive(computers, slot)) game.characterReadiness[slot] = false;
    if (participantActive(computers, slot)) game.characterReadiness[slot] = true;
    game.rematchReadiness[slot] = false;
  }
  game.humanFighterMask = humans;
  game.computerMask = computers;
  updateConnectedHumans(game, humans);
}

export function canCycleSlotMode(game: Readonly<MatchState>, actor: number, slot: number): boolean {
  return game.phase === Phase.characterMenu && humanPresent(game, actor) && isParticipantSlot(slot) && (actor === slot || actor === firstHumanSlot(game));
}

export function cycleSlotMode(game: MatchState, actor: number, slot: number): boolean {
  if (!isParticipantSlot(slot) || !canCycleSlotMode(game, actor, slot)) return false;
  const bit = 1 << slot;
  if (humanFighterActive(game, slot)) {
    game.humanFighterMask -= bit;
    game.computerMask += bit;
    game.characterReadiness[slot] = true;
  } else if (computerActive(game, slot)) {
    game.computerMask -= bit;
    game.characterReadiness[slot] = false;
  } else {
    game.humanFighterMask += bit;
    game.characterReadiness[slot] = false;
  }
  return true;
}

export function hasUnassignedHuman(game: Readonly<MatchState>): boolean {
  return PARTICIPANT_SLOTS.some(slot => humanFighterActive(game, slot) && !humanPresent(game, slot));
}

export function setHumanMask(game: MatchState, mask: number): void { setParticipants(game, mask, 0); }
export function setHumanCount(game: MatchState, count: number): void {
  if (count >= 1 && count <= 4) setHumanMask(game, (1 << count) - 1);
}

export function copyMatchState(target: MatchState, source: Readonly<MatchState>): void {
  copyMatchCamera(target.camera, source.camera);
  target.phase = source.phase;
  target.humanMask = source.humanMask;
  target.humanFighterMask = source.humanFighterMask;
  target.computerMask = source.computerMask;
  target.departedMask = source.departedMask;
  target.interrupted = source.interrupted;
  target.humanCount = source.humanCount;
  target.stageChoice = source.stageChoice;
  target.stageResolved = source.stageResolved;
  copyStagePool(target.stagePool, source.stagePool);
  target.hazards = source.hazards;

  target.winner = source.winner;
  target.stockCount = source.stockCount;
  target.timeLimitMinutes = source.timeLimitMinutes;
  target.endless = source.endless;
  target.automaticRematch = source.automaticRematch;
  target.rematchCountdown = source.rematchCountdown;
  target.remainingFrames = source.remainingFrames;
  target.matchSeed = source.matchSeed;
  target.startHold = source.startHold;
  target.matchFrame = source.matchFrame;
  target.timedOut = source.timedOut;
  target.practice = source.practice;
  target.training = source.training;
  copyTrainingState(target.trainer, source.trainer);
  copyMatchItems(target.items, source.items);
  target.classic = source.classic;
  target.classicTier = source.classicTier;
  target.lore = source.lore;
  target.loreBattle = source.loreBattle;
  copyConfiguredRun(target.run, source.run);
  for (const slot of PARTICIPANT_SLOTS) {
    target.characterChoices[slot] = source.characterChoices[slot];
    target.cpuOpponents[slot] = source.cpuOpponents[slot];
    target.cpuTiers[slot] = source.cpuTiers[slot];
    target.cpuResolvedOpponents[slot] = source.cpuResolvedOpponents[slot];
    target.characterReadiness[slot] = source.characterReadiness[slot];
    target.rematchReadiness[slot] = source.rematchReadiness[slot];
  }
}

export function characterFor(game: Readonly<MatchState>, slot: number): Character | undefined {
  return isParticipantSlot(slot) ? game.characterChoices[slot] : undefined;
}

export function characterReady(game: Readonly<MatchState>, slot: number): boolean {
  return isParticipantSlot(slot) && fighterActive(game, slot) && game.characterReadiness[slot] && (computerActive(game, slot) || humanPresent(game, slot));
}

export function selectableMatchCharacter(game: Readonly<MatchState>, choice: number): choice is Character {
  return isSelectableCharacter(choice) && (!game.classic || classicRoute(choice) !== undefined);
}

export function nextMatchCharacter(game: Readonly<MatchState>, current: number | undefined, direction: number): Character {
  return nextCharacterIn(game.classic ? CLASSIC_CHARACTERS.filter(character => PLAYABLE_CHARACTERS.includes(character)) : PLAYABLE_CHARACTERS, current, direction);
}

export function selectCharacter(game: MatchState, slot: number, choice: number): void {
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !humanPresent(game, slot) || !humanFighterActive(game, slot) || !selectableMatchCharacter(game, choice)) return;
  game.characterChoices[slot] = choice;
  game.characterReadiness[slot] = true;
}

export function selectCpuCharacter(game: MatchState, actor: number, slot: number, choice: number): void {
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !canChooseComputer(game, actor, slot) || !selectableMatchCharacter(game, choice)) return;
  game.characterChoices[slot] = choice;
  game.characterReadiness[slot] = true;
}

export function practiceSelected(game: Readonly<MatchState>): boolean {
  return game.humanCount === 1 && game.humanFighterMask === game.humanMask && !PARTICIPANT_SLOTS.some(slot => computerActive(game, slot) && game.characterReadiness[slot]);
}

export function allCharactersReady(game: Readonly<MatchState>): boolean {
  if (fighterMask(game) === 0 || hasUnassignedHuman(game)) return false;
  return !PARTICIPANT_SLOTS.some(slot => fighterActive(game, slot) && !game.characterReadiness[slot] && !(practiceSelected(game) && computerActive(game, slot)));
}

export function unreadyCharacter(game: MatchState, slot: number): void {
  if (game.phase === Phase.characterMenu && isParticipantSlot(slot) && humanActive(game, slot)) game.characterReadiness[slot] = false;
}

export function recallCharacter(game: MatchState, actor: number, chip: number): void {
  if (game.phase !== Phase.characterMenu || !humanActive(game, actor) || !isParticipantSlot(chip)) return;
  if ((chip === actor && humanFighterActive(game, chip)) || canChooseComputer(game, actor, chip)) game.characterReadiness[chip] = false;
}

export function selectStage(game: MatchState, slot: number, choice: number): void {
  if (game.phase !== Phase.stageMenu || !humanActive(game, slot) || !selectableStageChoice(choice)) return;
  game.stageChoice = choice;
  game.stageResolved = false;
}

export function changeStagePoolMode(game: MatchState, slot: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) togglePoolMode(game.stagePool);
}

export function changeStagePoolStage(game: MatchState, slot: number, choice: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) togglePoolStage(game.stagePool, choice);
}


export function setHazards(game: MatchState, slot: number, on: boolean): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) game.hazards = on;
}


export const hazardsOn = (game: Readonly<MatchState>): boolean => game.hazards;





export const stageClock = (game: Readonly<MatchState>): number => game.hazards ? game.matchFrame : STAGE_AT_REST;

export function requestStageSelect(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.characterMenu || !humanActive(game, slot) || !allCharactersReady(game)) return false;
  game.stageChoice = RANDOM_STAGE;
  game.stageResolved = false;
  game.phase = Phase.stageMenu;
  return true;
}

export function returnToCharacters(game: MatchState, slot: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) game.phase = Phase.characterMenu;
}


const settingRules = (game: Readonly<MatchState>, slot: number): boolean => game.phase === Phase.characterMenu && humanActive(game, slot);

export function setStocks(game: MatchState, slot: number, count: number): void {
  if (settingRules(game, slot) && count >= 1 && count <= 9) game.stockCount = count;
}

export function setTimeLimit(game: MatchState, slot: number, minutes: number): void {
  if (settingRules(game, slot) && minutes >= 0 && minutes <= 10) game.timeLimitMinutes = minutes;
}

export function setEndless(game: MatchState, slot: number, endless: boolean): void {
  if (settingRules(game, slot)) game.endless = endless;
}

export function setTraining(game: MatchState, slot: number, training: boolean): void {
  if (!settingRules(game, slot)) return;
  game.training = training;
  if (training) {
    game.classic = false;
    game.lore = false;
  }
  if (!training) game.trainer.lesson = -1;
}


export function setTutorialLesson(game: MatchState, slot: number, lesson: number, lessons: number): void {
  if (settingRules(game, slot) && lesson >= -1 && lesson < lessons) game.trainer.lesson = lesson;
}


export function cycleMatchMode(game: MatchState, slot: number): void {
  if (!settingRules(game, slot)) return;
  if (game.lore) game.lore = false;
  else if (game.classic) {
    game.classic = false;
    game.lore = true;
  } else if (game.training) {
    game.training = false;
    game.classic = true;
    for (const player of PARTICIPANT_SLOTS) {
      if (classicRoute(game.characterChoices[player]) === undefined) {
        game.characterChoices[player] = nextMatchCharacter(game, undefined, 1);
        game.characterReadiness[player] = false;
      }
    }
  } else game.training = true;
}


export function stepClassicTier(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot) && game.classic) game.classicTier = Math.max(0, Math.min(CPU_TIERS.length - 1, game.classicTier + direction));
}


export function stepLoreBattle(game: MatchState, slot: number, direction: number, battles: number): void {
  if (settingRules(game, slot) && game.lore) game.loreBattle = floorMod(game.loreBattle + direction, battles);
}


export function endConfiguredRun(game: MatchState): void {
  const { run } = game;
  if (!run.active) return;
  run.active = false;
  run.current = undefined;
  game.humanFighterMask = run.savedHumanFighters;
  game.computerMask = run.savedComputers;
  game.stockCount = run.savedStocks;
  game.timeLimitMinutes = run.savedMinutes;
  game.hazards = run.savedHazards;
  game.items.on = run.savedItems;
  game.rematchReadiness.fill(false);
  for (const slot of PARTICIPANT_SLOTS) if (computerActive(game, slot)) game.characterReadiness[slot] = true;
  game.phase = Phase.characterMenu;
}

const cycle = (value: number, count: number, direction: number): number => floorMod(value + direction, count);


export function stepPartnerBehaviour(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot)) game.trainer.behaviour = cycle(game.trainer.behaviour, PARTNER_BEHAVIOURS, direction);
}

export function stepPartnerEscape(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot)) game.trainer.escape = cycle(game.trainer.escape, PARTNER_ESCAPES, direction);
}

export function stepPartnerTech(game: MatchState, slot: number, direction: number): void {
  if (settingRules(game, slot)) game.trainer.tech = cycle(game.trainer.tech, PARTNER_TECHS, direction);
}

export function setPartnerDamage(game: MatchState, slot: number, damage: number): void {
  if (settingRules(game, slot) && damage >= 0 && damage <= PARTNER_DAMAGE_MAX && floorMod(damage, PARTNER_DAMAGE_STEP) === 0) game.trainer.damage = damage;
}


export function stepTrainingSpeed(game: MatchState, slot: number, direction: number): void {
  if (!settingRules(game, slot)) return;
  const index = TRAINING_SPEEDS.indexOf(game.trainer.speed);
  game.trainer.speed = TRAINING_SPEEDS[cycle(index < 0 ? 0 : index, TRAINING_SPEEDS.length, direction)] ?? 1;
}

export function setHitAreas(game: MatchState, slot: number, shown: boolean): void {
  if (settingRules(game, slot)) game.trainer.showHitAreas = shown;
}

export function setCpuOpponent(game: MatchState, actor: number, computer: number, opponent: CpuOpponentChoice): void {
  if (game.phase === Phase.characterMenu && isParticipantSlot(computer) && canChooseComputer(game, actor, computer) && isCpuOpponentChoice(opponent)) game.cpuOpponents[computer] = opponent;
}

export function setCpuTier(game: MatchState, actor: number, computer: number, tier: CpuTier): void {
  if (game.phase === Phase.characterMenu && isParticipantSlot(computer) && canChooseComputer(game, actor, computer) && isCpuTier(tier)) game.cpuTiers[computer] = tier;
}

export function setAutomaticRematch(game: MatchState, slot: number, automatic: boolean): void {
  if (settingRules(game, slot)) game.automaticRematch = automatic;
}


export function setItemsOn(game: MatchState, slot: number, on: boolean): void {
  if (settingRules(game, slot)) game.items.on = on;
}


export function toggleItemKind(game: MatchState, slot: number, kind: ItemKind): void {
  if (settingRules(game, slot) && kind !== ItemKind.none) game.items.enabledMask ^= itemBit(kind);
}


export const timedMatch = (game: Readonly<MatchState>): boolean => !game.practice && !game.endless && !game.training && game.timeLimitMinutes > 0;


export const keepsStocks = (game: Readonly<MatchState>): boolean => game.practice || game.endless || game.training;

export const remainingSeconds = (game: Readonly<MatchState>): number => floorDiv(game.remainingFrames + MATCH_TICKS_PER_SECOND - 1, MATCH_TICKS_PER_SECOND);


export const START_HOLD_FRAMES = 3 * MATCH_TICKS_PER_SECOND;


export const holdingStart = (game: Readonly<MatchState>): boolean => game.phase === Phase.match && game.startHold > 0 && game.matchFrame <= game.startHold;

function beginMatch(game: MatchState): void {
  game.winner = undefined;
  game.interrupted = false;
  game.departedMask = 0;
  game.timedOut = false;
  game.rematchCountdown = 0;
  game.practice = !game.training && !game.run.active && practiceSelected(game);
  clearTrainingReadout(game.trainer);
  game.remainingFrames = timedMatch(game) ? game.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND : 0;

  if (game.matchFrame > 0) game.matchSeed = nextMatchSeed(game.matchSeed);
  resolveStageChoice(game, game.matchSeed);
  for (const slot of PARTICIPANT_SLOTS) game.cpuResolvedOpponents[slot] = resolveCpuOpponent(game.cpuOpponents[slot], game.matchSeed, slot);
  game.startHold = game.practice || game.training ? 0 : START_HOLD_FRAMES;
  game.matchFrame = 0;
  game.phase = Phase.match;
  scheduleMatchItems(game);
}


export const canRequestStart = (game: Readonly<MatchState>, slot: number): boolean =>
  game.phase === Phase.stageMenu && humanActive(game, slot) && allCharactersReady(game);


export function resolveStageChoice(game: MatchState, seed = game.matchSeed): void {
  if (game.stageResolved) return;
  if (game.stageChoice === RANDOM_STAGE) game.stageChoice = nextPoolStage(game.stagePool, seed);
  else consumePoolStage(game.stagePool, game.stageChoice);
  game.stageResolved = true;
}

export function requestStart(game: MatchState, slot: number): boolean {
  if (!canRequestStart(game, slot)) return false;
  resolveStageChoice(game);
  beginMatch(game);
  return true;
}





export function leaveMatch(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.match || !(game.practice ? slot === firstHumanSlot(game) : (game.endless || game.training) && humanPresent(game, slot))) return false;
  game.phase = Phase.characterMenu;
  game.practice = false;
  game.trainer.lesson = -1;
  return true;
}


export const REMATCH_COUNTDOWN_SECONDS = 5;


export function beginRematchCountdown(game: MatchState, seconds: number): void {
  game.rematchCountdown = game.phase === Phase.result && game.automaticRematch && !game.interrupted && !game.run.active ? seconds * MATCH_TICKS_PER_SECOND : 0;
}


export function cancelRematchCountdown(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.result || game.rematchCountdown === 0 || !humanPresent(game, slot)) return false;
  game.rematchCountdown = 0;
  return true;
}





export function tickRematchCountdown(game: MatchState): boolean {
  if (game.phase !== Phase.result || game.rematchCountdown === 0) return false;
  game.rematchCountdown--;
  if (game.rematchCountdown > 0 || !allCharactersReady(game)) return false;
  game.rematchReadiness.fill(false);
  game.stageChoice = RANDOM_STAGE;
  game.stageResolved = false;
  beginMatch(game);
  return true;
}

export function confirmRematch(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.result || !isParticipantSlot(slot) || !humanPresent(game, slot)) return false;
  game.rematchReadiness[slot] = true;
  if (PARTICIPANT_SLOTS.some(participant => humanPresent(game, participant) && !game.rematchReadiness[participant])) return false;
  game.rematchReadiness.fill(false);
  game.phase = Phase.characterMenu;
  return true;
}

export function participantLeft(game: MatchState, slot: number, world: Roster): void {
  if (!isParticipantSlot(slot) || !humanPresent(game, slot)) return;
  game.departedMask += 1 << slot;
  game.rematchReadiness[slot] = false;
  game.rematchCountdown = 0;
  if (game.phase !== Phase.match) return;
  game.interrupted = true;
  game.timedOut = false;
  game.winner = undefined;
  let contenders = 0;
  for (const fighter of PARTICIPANT_SLOTS) {
    if (isActive(world, fighter) && !participantActive(game.departedMask, fighter) && fighterAt(world, fighter).status.stocks > 0) {
      contenders++;
      game.winner = fighter;
    }
  }
  if (contenders !== 1) game.winner = undefined;
  game.phase = Phase.result;
}

function resolveRemaining(game: MatchState, world: Roster): void {
  let remaining = 0;
  let survivor: ParticipantSlot | undefined;
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(world, slot) && fighterAt(world, slot).status.stocks > 0) { remaining++; survivor = slot; }
  }
  if (remaining > 1) return;
  game.winner = survivor;
  game.phase = Phase.result;
}

export function resolveStocks(game: MatchState, world: Roster): void {
  if (game.phase === Phase.match && !keepsStocks(game)) resolveRemaining(game, world);
}

export function advanceClock(game: MatchState, world: Roster): void {
  if (game.phase !== Phase.match || !timedMatch(game) || holdingStart(game)) return;
  game.remainingFrames--;
  if (game.remainingFrames > 0) return;
  game.remainingFrames = 0;
  game.timedOut = true;
  let best: ParticipantSlot | undefined;
  let tied = false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    if (best === undefined) { best = slot; continue; }
    const leader = fighterAt(world, best);
    if (fighter.status.stocks > leader.status.stocks || (fighter.status.stocks === leader.status.stocks && fighter.status.damage < leader.status.damage)) {
      best = slot;
      tied = false;
    } else if (fighter.status.stocks === leader.status.stocks && fighter.status.damage === leader.status.damage) tied = true;
  }
  game.winner = tied ? undefined : best;
  game.phase = Phase.result;
}

export function forfeit(game: MatchState, losingSlot: number, world: Roster): void {
  if (!isActive(world, losingSlot)) return;
  const fighter = fighterAt(world, losingSlot);
  fighter.status.stocks = 0;
  fighter.status.out = true;
  resolveRemaining(game, world);
  game.rematchReadiness.fill(false);
}
