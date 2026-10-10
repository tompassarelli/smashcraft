


import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantSlot } from "../input/participants";
import { MATCH_TICKS_PER_SECOND, type MatchState, Phase, humanFighterActive, keepsStocks } from "../match/rules";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { fighterName } from "../sim/heroes/registry";
import { cpuOpponentSummary, fighterLabel } from "../shell/messages";
import { MatchCue } from "./matchAudio";
import { ROSTER_MANA } from "../sim/mana";
import type { Character } from "../sim/codes";
import { type CombatObservation, type CombatTally, clearCombatTally, createCombatObservation, createCombatTally, observeCombat, tallyCombat } from "./combatStats";


export interface CueObservation {
  phase: Phase;
  readonly out: Slots<boolean>;
  readonly meter: Slots<number>;
  readonly combat: CombatObservation;
}

export function createCueObservation(): CueObservation {
  return { phase: Phase.characterMenu, out: [false, false, false, false], meter: [0, 0, 0, 0], combat: createCombatObservation() };
}

export function observeForCues(observation: CueObservation, game: Readonly<MatchState>, world: Readonly<Roster>): void {
  observation.phase = game.phase;
  for (const slot of PARTICIPANT_SLOTS) observation.out[slot] = isActive(world, slot) && fighterAt(world, slot).status.out;
  for (const slot of PARTICIPANT_SLOTS) observation.meter[slot] = isActive(world, slot) ? fighterAt(world, slot).mana.points : 0;
  observeCombat(observation.combat, world);
}


export interface MatchTally {
  readonly kos: Slots<number>;
  readonly falls: Slots<number>;
  readonly combat: CombatTally;
}

export function createMatchTally(): MatchTally {
  return { kos: [0, 0, 0, 0], falls: [0, 0, 0, 0], combat: createCombatTally() };
}

export function clearMatchTally(tally: MatchTally): void {
  tally.kos.fill(0);
  tally.falls.fill(0);
  clearCombatTally(tally.combat);
}





export function countdownCue(game: Readonly<MatchState>): MatchCue | undefined {
  const { startHold, matchFrame } = game;
  if (game.phase !== Phase.match || startHold === 0) return undefined;
  if (matchFrame === startHold + 1) return MatchCue.go;
  if (matchFrame < 1 || matchFrame > startHold || floorMod(matchFrame - 1, MATCH_TICKS_PER_SECOND) !== 0) return undefined;
  switch (floorDiv(startHold - matchFrame + 1 + MATCH_TICKS_PER_SECOND - 1, MATCH_TICKS_PER_SECOND)) {
    case 3: return MatchCue.three;
    case 2: return MatchCue.two;
    case 1: return MatchCue.one;
    default: return undefined;
  }
}






export function confirmedFrameCues(before: Readonly<CueObservation>, game: Readonly<MatchState>, world: Readonly<Roster>, tally: MatchTally, cues: MatchCue[]): void {
  cues.length = 0;
  const countdown = countdownCue(game);
  if (countdown !== undefined) cues.push(countdown);
  tallyCombat(before.combat, world, tally.combat);
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(world, slot) && before.meter[slot] < ROSTER_MANA.max && fighterAt(world, slot).mana.points >= ROSTER_MANA.max) cues.push(MatchCue.meterReady);
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || before.out[slot]) continue;
    const fighter = fighterAt(world, slot);
    if (!fighter.status.out) continue;
    tally.falls[slot]++;
    const attacker = fighter.hits.lastAttacker;
    if (attacker !== undefined && attacker !== slot && isParticipantSlot(attacker)) tally.kos[attacker]++;
    cues.push(MatchCue.stockLost);
    if (!keepsStocks(game) && fighter.status.stocks === 1) cues.push(MatchCue.lastStock);
  }
  if (before.phase === Phase.match && game.phase === Phase.result && !game.interrupted) cues.push(game.timedOut ? MatchCue.time : MatchCue.game);
}


interface ResultRow {
  readonly slot: ParticipantSlot;
  readonly winner: boolean;
  readonly text: string;
}

const percent = (damage: number): string => `${Math.floor(damage)}%`;


function resultRows(game: Readonly<MatchState>, world: Readonly<Roster>, tally: Readonly<MatchTally>): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const winner = game.winner === slot;
    const stocks = game.endless ? "" : `Stocks ${fighter.status.stocks}  ·  `;
    const label = humanFighterActive(game, slot) ? fighterLabel(game, slot) : cpuOpponentSummary(game, slot);
    const text = `${winner ? "WINNER  " : ""}${label} · ${fighterName(fighter.character)}\n`
      + `${stocks}Damage ${percent(fighter.status.damage)}  ·  KOs ${tally.kos[slot]}  ·  Falls ${tally.falls[slot]}`;
    const row = { slot, winner, text };
    if (winner) rows.unshift(row);
    else rows.push(row);
  }
  return rows;
}


interface MenuObservation {
  phase: Phase;
  stage: number;
  hover: number | undefined;
  readonly choices: Slots<number>;
  readonly ready: Slots<boolean>;
}

export function createMenuObservation(): MenuObservation {
  return { phase: Phase.characterMenu, stage: 0, hover: undefined, choices: [0, 0, 0, 0], ready: [false, false, false, false] };
}


interface MenuCues {
  hover: boolean;
  confirm: boolean;
  readonly fighters: ParticipantSlot[];
}

export function createMenuCues(): MenuCues {
  return { hover: false, confirm: false, fighters: [] };
}






export function menuFrameCues(before: MenuObservation, game: Readonly<MatchState>, hover: number | undefined, cues: MenuCues): void {
  cues.hover = false;
  cues.confirm = false;
  cues.fighters.length = 0;
  const { phase } = game;
  if (phase === Phase.characterMenu && before.phase === Phase.characterMenu) {
    for (const slot of PARTICIPANT_SLOTS) {
      const ready = game.characterReadiness[slot];
      if (ready && (!before.ready[slot] || before.choices[slot] !== game.characterChoices[slot])) cues.fighters.push(slot);
    }
    if (hover !== undefined && hover !== before.hover) cues.hover = true;
  }
  if (phase === Phase.stageMenu && before.phase === Phase.stageMenu && game.stageChoice !== before.stage) cues.hover = true;
  if (phase === Phase.stageMenu && before.phase === Phase.characterMenu) cues.confirm = true;
  before.phase = phase;
  before.stage = game.stageChoice;
  before.hover = hover;
  for (const slot of PARTICIPANT_SLOTS) {
    before.choices[slot] = game.characterChoices[slot];
    before.ready[slot] = game.characterReadiness[slot];
  }
}


export interface ResultsView {
  readonly rows: readonly ResultRow[];
  readonly winner: Character | undefined;

  readonly winnerSlot: ParticipantSlot | undefined;
  readonly x: number;
  readonly z: number;
}

export function resultsView(game: Readonly<MatchState>, world: Readonly<Roster>, tally: Readonly<MatchTally>): ResultsView {
  const { winner } = game;
  const fighter = winner !== undefined && isActive(world, winner) ? fighterAt(world, winner) : undefined;
  return { rows: resultRows(game, world, tally), winner: fighter?.character, winnerSlot: fighter === undefined ? undefined : winner, x: fighter?.motion.x ?? 0.0, z: fighter === undefined ? 0.0 : Math.max(0.0, fighter.motion.z) };
}
