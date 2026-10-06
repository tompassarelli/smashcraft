// What the match calls out on each confirmed frame, and the tally the results
// screen shows. Both read confirmed state only: replayed and predicted frames
// never reach them, and nothing here feeds the simulation.
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots, isParticipantSlot } from "../input/participants";
import { type MatchState, Phase } from "../match/rules";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { fighterName } from "../sim/heroes/registry";
import { fighterLabel } from "../shell/messages";
import { MatchCue } from "./matchAudio";
import type { Character } from "../sim/codes";

/** Confirmed state a frame's cues compare against, captured before it runs. */
export interface CueObservation {
  phase: Phase;
  readonly out: Slots<boolean>;
}

export function createCueObservation(): CueObservation {
  return { phase: Phase.characterMenu, out: [false, false, false, false] };
}

export function observeForCues(observation: CueObservation, game: Readonly<MatchState>, world: Readonly<Roster>): void {
  observation.phase = game.phase;
  for (const slot of PARTICIPANT_SLOTS) observation.out[slot] = isActive(world, slot) && fighterAt(world, slot).status.out;
}

/** KOs credited to each fighter and stocks each lost, for the results. */
export interface MatchTally {
  readonly kos: Slots<number>;
  readonly falls: Slots<number>;
}

export function createMatchTally(): MatchTally {
  return { kos: [0, 0, 0, 0], falls: [0, 0, 0, 0] };
}

export function clearMatchTally(tally: MatchTally): void {
  tally.kos.fill(0);
  tally.falls.fill(0);
}

/**
 * The cues of one confirmed frame, in play order: knockouts first, then the
 * end of the match. Counts each knockout in `tally`; the last fighter to land
 * a hit takes the KO.
 */
export function confirmedFrameCues(before: Readonly<CueObservation>, game: Readonly<MatchState>, world: Readonly<Roster>, tally: MatchTally, cues: MatchCue[]): void {
  cues.length = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || before.out[slot]) continue;
    const fighter = fighterAt(world, slot);
    if (!fighter.status.out) continue;
    tally.falls[slot]++;
    const attacker = fighter.hits.lastAttacker;
    if (attacker !== undefined && attacker !== slot && isParticipantSlot(attacker)) tally.kos[attacker]++;
    cues.push(MatchCue.stockLost);
    if (!game.practice && !game.endless && fighter.status.stocks === 1) cues.push(MatchCue.lastStock);
  }
  if (before.phase === Phase.match && game.phase === Phase.result && !game.interrupted) cues.push(game.timedOut ? MatchCue.time : MatchCue.game);
}

/** One fighter's line on the results screen. */
export interface ResultRow {
  readonly slot: ParticipantSlot;
  readonly winner: boolean;
  readonly text: string;
}

const percent = (damage: number): string => `${Math.floor(damage)}%`;

/** Each fighter of the finished match, the winner first, then by slot. */
export function resultRows(game: Readonly<MatchState>, world: Readonly<Roster>, tally: Readonly<MatchTally>): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const winner = game.winner === slot;
    const stocks = game.endless ? "" : `Stocks ${fighter.status.stocks}  ·  `;
    const text = `${winner ? "WINNER  " : ""}${fighterLabel(game, slot)} · ${fighterName(fighter.character)}\n`
      + `${stocks}Damage ${percent(fighter.status.damage)}  ·  KOs ${tally.kos[slot]}  ·  Falls ${tally.falls[slot]}`;
    const row = { slot, winner, text };
    if (winner) rows.unshift(row);
    else rows.push(row);
  }
  return rows;
}

/** The menus as the last local frame showed them, for selection sounds. */
export interface MenuObservation {
  phase: Phase;
  stage: number;
  hover: number | undefined;
  readonly choices: Slots<number>;
  readonly ready: Slots<boolean>;
}

export function createMenuObservation(): MenuObservation {
  return { phase: Phase.characterMenu, stage: 0, hover: undefined, choices: [0, 0, 0, 0], ready: [false, false, false, false] };
}

/** What the menus' last change sounds like: a hover tick, a confirm, and each slot whose fighter was just confirmed. */
export interface MenuCues {
  hover: boolean;
  confirm: boolean;
  readonly fighters: ParticipantSlot[];
}

export function createMenuCues(): MenuCues {
  return { hover: false, confirm: false, fighters: [] };
}

/**
 * Compares the menus with the last frame's and records the change in `before`.
 * A fighter is confirmed when its slot becomes ready or changes fighter while
 * ready; `hover` is this client's pointer tile.
 */
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

/** A finished match as the results screen shows it: rows, and the winner's fighter and where it stood. */
export interface ResultsView {
  readonly rows: readonly ResultRow[];
  readonly winner: Character | undefined;
  readonly x: number;
  readonly z: number;
}

export function resultsView(game: Readonly<MatchState>, world: Readonly<Roster>, tally: Readonly<MatchTally>): ResultsView {
  const { winner } = game;
  const fighter = winner !== undefined && isActive(world, winner) ? fighterAt(world, winner) : undefined;
  return { rows: resultRows(game, world, tally), winner: fighter?.character, x: fighter?.motion.x ?? 0.0, z: fighter === undefined ? 0.0 : Math.max(0.0, fighter.motion.z) };
}
