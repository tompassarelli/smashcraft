import { floorDiv } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantMask, isParticipantSlot, participantActive } from "../input/participants";
import { Character } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";

/** Phase numbers are part of the canonical replay checksum. */
export const Phase = { characterMenu: 0, stageMenu: 1, match: 2, result: 3 } as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
export const MATCH_TICKS_PER_SECOND = 60;

export interface MatchState {
  phase: Phase;
  readonly characterChoices: Slots<Character>;
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
  remainingFrames: number;
  /** Frames this match has run; moving decks follow their paths by it. */
  matchFrame: number;
  timedOut: boolean;
  practice: boolean;
}

export function createMatchState(): MatchState {
  return {
    phase: Phase.characterMenu, characterChoices: [0, 1, 2, 0],
    characterReadiness: [false, false, false, false], rematchReadiness: [false, false, false, false],
    departedMask: 0, interrupted: false, humanMask: 1, humanFighterMask: 1, humanCount: 1, computerMask: 0,
    stageChoice: 0, winner: undefined, stockCount: 3, timeLimitMinutes: 7,
    remainingFrames: 7 * 60 * MATCH_TICKS_PER_SECOND, matchFrame: 0, timedOut: false, practice: false,
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
  target.remainingFrames = source.remainingFrames;
  target.matchFrame = source.matchFrame;
  target.timedOut = source.timedOut;
  target.practice = source.practice;
  for (const slot of PARTICIPANT_SLOTS) {
    target.characterChoices[slot] = source.characterChoices[slot];
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
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !humanPresent(game, slot) || !humanFighterActive(game, slot) || (choice !== 0 && choice !== 1 && choice !== 2)) return;
  game.characterChoices[slot] = choice;
  game.characterReadiness[slot] = true;
}

export function selectCpuCharacter(game: MatchState, actor: number, slot: number, choice: number): void {
  if (game.phase !== Phase.characterMenu || !isParticipantSlot(slot) || !canChooseComputer(game, actor, slot) || (choice !== 0 && choice !== 1 && choice !== 2)) return;
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
  if (game.phase === Phase.stageMenu && humanActive(game, slot) && choice >= 0 && choice <= 1) game.stageChoice = choice;
}

export function requestStageSelect(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.characterMenu || !humanActive(game, slot) || !allCharactersReady(game)) return false;
  game.phase = Phase.stageMenu;
  return true;
}

export function returnToCharacters(game: MatchState, slot: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot)) game.phase = Phase.characterMenu;
}

export function setStocks(game: MatchState, slot: number, count: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot) && count >= 1 && count <= 9) game.stockCount = count;
}

export function setTimeLimit(game: MatchState, slot: number, minutes: number): void {
  if (game.phase === Phase.stageMenu && humanActive(game, slot) && minutes >= 0 && minutes <= 10) game.timeLimitMinutes = minutes;
}

export const remainingSeconds = (game: Readonly<MatchState>): number => floorDiv(game.remainingFrames + MATCH_TICKS_PER_SECOND - 1, MATCH_TICKS_PER_SECOND);

export function requestStart(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.stageMenu || !humanActive(game, slot) || !allCharactersReady(game)) return false;
  game.winner = undefined;
  game.interrupted = false;
  game.departedMask = 0;
  game.timedOut = false;
  game.practice = practiceSelected(game);
  game.remainingFrames = game.practice ? 0 : game.timeLimitMinutes * 60 * MATCH_TICKS_PER_SECOND;
  game.matchFrame = 0;
  game.phase = Phase.match;
  return true;
}

export function leavePractice(game: MatchState, slot: number): boolean {
  if (game.phase !== Phase.match || !game.practice || slot !== firstHumanSlot(game)) return false;
  game.phase = Phase.characterMenu;
  game.practice = false;
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
  if (game.phase === Phase.match && !game.practice) resolveRemaining(game, world);
}

export function advanceClock(game: MatchState, world: Roster): void {
  if (game.phase !== Phase.match || game.practice || game.timeLimitMinutes === 0) return;
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
