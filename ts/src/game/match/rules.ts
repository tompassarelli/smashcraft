import { isSelectableCharacter } from "../sim/heroes/registry";
import { selectableStage } from "../menu/stageCatalog";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type MatchCamera, createMatchCamera, copyMatchCamera } from "../sim/matchCamera";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantMask, isParticipantSlot, participantActive } from "../input/participants";
import { Character } from "../sim/codes";
import { CPU_LEVEL_DEFAULT, isCpuLevel, nextMatchSeed } from "./cpuLevel";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { PARTNER_BEHAVIOURS, PARTNER_DAMAGE_MAX, PARTNER_DAMAGE_STEP, PARTNER_ESCAPES, PARTNER_TECHS, TRAINING_SPEEDS, type TrainingState, clearTrainingReadout, copyTrainingState, createTrainingState } from "./trainingState";

/** Phase numbers are part of the canonical replay checksum. */
export const Phase = { characterMenu: 0, stageMenu: 1, match: 2, result: 3 } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
export const MATCH_TICKS_PER_SECOND = 60;

export interface MatchState {
  readonly camera: MatchCamera;
  phase: Phase;
  readonly characterChoices: Slots<Character>;
  /** Each computer slot's difficulty, 1-9 (cpuLevel.ts). */
  readonly cpuLevels: Slots<number>;
  readonly characterReadiness: Slots<boolean>;
  readonly rematchReadiness: Slots<boolean>;
  departedMask: number;
  interrupted: boolean;
  /** Connected players own menus and senders, independently of fighter mode. */
  humanMask: number;
  humanFighterMask: number;
  humanCount: number;
  computerMask: number;
  stageChoice: number;
  winner: ParticipantSlot | undefined;
  stockCount: number;
  timeLimitMinutes: number;
  /** Knockouts and the clock never end the match; a player leaves it from the pause. */
  endless: boolean;
  /** After a result, the same fighters play again on the same stage once rematchCountdown runs out. */
  automaticRematch: boolean;
  /** Frames until the automatic rematch starts; 0 while none counts down. */
  rematchCountdown: number;
  remainingFrames: number;
  /** Every computer choice draws under it, so each match plays differently; the next match after a result takes the next seed. */
  matchSeed: number;
  /** Frames at the start that hold every fighter for "3, 2, 1, GO!"; 0 in practice, training and test matches. */
  startHold: number;
  /** Frames this match has run; moving decks follow their paths by it. */
  matchFrame: number;
  timedOut: boolean;
  practice: boolean;
  /** Training (#120): no clock or lost stocks, computers play the partner set in trainer. */
  training: boolean;
  readonly trainer: TrainingState;
}

export function createMatchState(): MatchState {
  return {
    camera: createMatchCamera(),
    phase: Phase.characterMenu, characterChoices: [0, 1, 2, 0], cpuLevels: [CPU_LEVEL_DEFAULT, CPU_LEVEL_DEFAULT, CPU_LEVEL_DEFAULT, CPU_LEVEL_DEFAULT], matchSeed: 0,
    characterReadiness: [false, false, false, false], rematchReadiness: [false, false, false, false],
    departedMask: 0, interrupted: false, humanMask: 1, humanFighterMask: 1, humanCount: 1, computerMask: 0,
    stageChoice: 2, winner: undefined, stockCount: 3, timeLimitMinutes: 7, endless: false, automaticRematch: false, rematchCountdown: 0,
    remainingFrames: 7 * 60 * MATCH_TICKS_PER_SECOND, startHold: 0, matchFrame: 0, timedOut: false, practice: false,
    training: false, trainer: createTrainingState(),
  };
}

export const humanActive = (game: Readonly<MatchState>, slot: number): boolean => participantActive(game.humanMask, slot);
export const humanPresent = (game: Readonly<MatchState>, slot: number): boolean => humanActive(game, slot) && !participantActive(game.departedMask, slot);
export const humanFighterActive = (game: Readonly<MatchState>, slot: number): boolean => participantActive(game.humanFighterMask, slot);
export const computerActive = (game: Readonly<MatchState>, slot: number): boolean => participantActive(game.computerMask, slot);

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
  for (const slot of PARTICIPANT_SLOTS) {
    target.characterChoices[slot] = source.characterChoices[slot];
    target.cpuLevels[slot] = source.cpuLevels[slot];
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

export function selectCharacter(game: MatchState, slot: number, choice: number): void {
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !humanPresent(game, slot) || !humanFighterActive(game, slot) || !isSelectableCharacter(choice)) return;
  game.characterChoices[slot] = choice;
  game.characterReadiness[slot] = true;
}

export function selectCpuCharacter(game: MatchState, actor: number, slot: number, choice: number): void {
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !canChooseComputer(game, actor, slot) || !isSelectableCharacter(choice)) return;
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
  if (game.phase === Phase.stageMenu && humanActive(game, slot) && selectableStage(choice)) game.stageChoice = choice;
}

export function requestStageSelect(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.characterMenu || !humanActive(game, slot) || !allCharactersReady(game)) return false;
  game.phase = Phase.stageMenu;
  return true;
}

export function returnToCharacters(game: MatchState, slot: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) game.phase = Phase.characterMenu;
}

/** Any player sets the match rules at fighter selection. */
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
  if (settingRules(game, slot)) game.training = training;
}

const cycle = (value: number, count: number, direction: number): number => floorMod(value + direction, count);

/** Training's partner choices step through their options in either direction. */
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

/** Steps training's speed through full, half and quarter. */
export function stepTrainingSpeed(game: MatchState, slot: number, direction: number): void {
  if (!settingRules(game, slot)) return;
  const index = TRAINING_SPEEDS.indexOf(game.trainer.speed);
  game.trainer.speed = TRAINING_SPEEDS[cycle(index < 0 ? 0 : index, TRAINING_SPEEDS.length, direction)] ?? 1;
}

export function setHitAreas(game: MatchState, slot: number, shown: boolean): void {
  if (settingRules(game, slot)) game.trainer.showHitAreas = shown;
}

/** At fighter selection, whoever may choose a computer's fighter sets its level. */
export function setCpuLevel(game: MatchState, actor: number, computer: number, level: number): void {
  if (game.phase === Phase.characterMenu && isParticipantSlot(computer) && canChooseComputer(game, actor, computer) && isCpuLevel(level)) game.cpuLevels[computer] = level;
}

export function setAutomaticRematch(game: MatchState, slot: number, automatic: boolean): void {
  if (settingRules(game, slot)) game.automaticRematch = automatic;
}

/** Whether the match clock runs: practice, endless and training matches have none. */
export const timedMatch = (game: Readonly<MatchState>): boolean => !game.practice && !game.endless && !game.training && game.timeLimitMinutes > 0;

/** Knockouts cost no stock: practice, endless and training. */
export const keepsStocks = (game: Readonly<MatchState>): boolean => game.practice || game.endless || game.training;

export const remainingSeconds = (game: Readonly<MatchState>): number => floorDiv(game.remainingFrames + MATCH_TICKS_PER_SECOND - 1, MATCH_TICKS_PER_SECOND);

/** Brawl and Ultimate count "3, 2, 1, GO!" over about three seconds; Melee holds 84 frames for "Ready... GO!" (docs/design/match-flow.md). */
export const START_HOLD_FRAMES = 3 * MATCH_TICKS_PER_SECOND;

/** Whether this match frame still holds the fighters for the countdown: GO! is frame startHold + 1. */
export const holdingStart = (game: Readonly<MatchState>): boolean => game.phase === Phase.match && game.startHold > 0 && game.matchFrame <= game.startHold;

function beginMatch(game: MatchState): void {
  game.winner = undefined;
  game.interrupted = false;
  game.departedMask = 0;
  game.timedOut = false;
  game.rematchCountdown = 0;
  game.practice = !game.training && practiceSelected(game);
  clearTrainingReadout(game.trainer);
  game.remainingFrames = timedMatch(game) ? game.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND : 0;
  // A match has run since the boot: this one plays the next seed.
  if (game.matchFrame > 0) game.matchSeed = nextMatchSeed(game.matchSeed);
  game.startHold = game.practice || game.training ? 0 : START_HOLD_FRAMES;
  game.matchFrame = 0;
  game.phase = Phase.match;
}

/** Whether `slot`'s start press at stage selection may start the match. */
export const canRequestStart = (game: Readonly<MatchState>, slot: number): boolean =>
  game.phase === Phase.stageMenu && humanActive(game, slot) && allCharactersReady(game);

export function requestStart(game: MatchState, slot: number): boolean {
  if (!canRequestStart(game, slot)) return false;
  beginMatch(game);
  return true;
}

/**
 * Leaving from the pause: the first human ends practice, and any player here
 * ends an endless match. Both return to fighter selection.
 */
export function leaveMatch(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.match || !(game.practice ? slot === firstHumanSlot(game) : (game.endless || game.training) && humanPresent(game, slot))) return false;
  game.phase = Phase.characterMenu;
  game.practice = false;
  return true;
}

/** Seconds a result shows before the automatic rematch starts. */
export const REMATCH_COUNTDOWN_SECONDS = 5;

/** At a result, the automatic rematch counts down `seconds`; none after a player left. */
export function beginRematchCountdown(game: MatchState, seconds: number): void {
  game.rematchCountdown = game.phase === Phase.result && game.automaticRematch && !game.interrupted ? seconds * MATCH_TICKS_PER_SECOND : 0;
}

/** Any player's press during the countdown stops the automatic rematch; true when one was counting. */
export function cancelRematchCountdown(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.result || game.rematchCountdown === 0 || !humanPresent(game, slot)) return false;
  game.rematchCountdown = 0;
  return true;
}

/**
 * One callback of the countdown. When it runs out, the same fighters play
 * again on the same stage with the same rules; true when that match starts.
 */
export function tickRematchCountdown(game: MatchState): boolean {
  if (game.phase !== Phase.result || game.rematchCountdown === 0) return false;
  game.rematchCountdown--;
  if (game.rematchCountdown > 0 || !allCharactersReady(game)) return false;
  game.rematchReadiness.fill(false);
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
