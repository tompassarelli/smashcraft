
import { Advantage, type TrainingState } from "../match/trainingState";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { floorDiv } from "wisp/src/sim/intMath";
import { MATCH_TICKS_PER_SECOND, Phase, type MatchState, humanFighterActive, humanPresent, practiceSelected } from "../match/rules";
import { DownState, ItemKind, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { SPECIAL_INPUTS, fighterKit, normalName, specialName } from "../sim/moveNames";
import { fighterName } from "../sim/heroes/registry";
import { classicResultHelp, classicResultMessage, tierName } from "../classic/classicText";
import { CPU_OPPONENT_DEFAULT, CPU_TIER_DEFAULT } from "../match/cpuProfiles";
import { loreBattle, loreResultHelp, loreResultMessage } from "../classic/loreBattles";


export type StartControl = "Start" | "Y";

export function fighterLabel(game: Readonly<MatchState>, slot: number): string {
  return humanFighterActive(game, slot) ? `Player ${slot + 1}` : "Computer";
}

export function cpuOpponentSummary(game: Readonly<MatchState>, slot: number): string {
  const opponent = game.cpuResolvedOpponents[slot] ?? CPU_OPPONENT_DEFAULT;
  const tier = game.cpuTiers[slot] ?? CPU_TIER_DEFAULT;
  return `CPU ${slot + 1} · ${opponent.charAt(0).toUpperCase()}${opponent.slice(1)} · ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
}

export function resultMessage(game: Readonly<MatchState>): string {
  if (game.run.active) return game.lore ? loreResultMessage(game) : classicResultMessage(game);
  const winner = game.winner === undefined ? undefined : fighterLabel(game, game.winner);
  if (game.interrupted) return winner === undefined ? "Match ended because a player left." : `${winner} wins by forfeit.`;
  if (winner !== undefined) return `${winner} wins!`;
  return game.timedOut ? "Time! Draw." : "Draw!";
}

const confirmControl = (start: StartControl) => (start === "Start" ? "A or Start" : "Y");

function rematchStatus(game: Readonly<MatchState>, start: StartControl): string {
  if (game.run.active) return game.lore ? loreResultHelp(game, confirmControl(start)) : classicResultHelp(game, confirmControl(start));
  if (game.rematchCountdown > 0) return "Press any button to stop the rematch.";
  const present = PARTICIPANT_SLOTS.filter(slot => humanPresent(game, slot));
  const ready = present.filter(slot => game.rematchReadiness[slot]);
  return `${ready.length}/${present.length} ready. Press ${confirmControl(start)} to choose your next match.`;
}


export function resultNotice(game: Readonly<MatchState>, result: string): string {
  const notice = game.rematchCountdown > 0 ? `${result}\nRematch in ${floorDiv(game.rematchCountdown + MATCH_TICKS_PER_SECOND - 1, MATCH_TICKS_PER_SECOND)}` : result;
  return notice;
}

export const stockSetting = (count: number) => (count === 1 ? "1 Stock" : `${count} Stocks`);
export const timeSetting = (minutes: number) => (minutes === 0 ? "No time limit" : `${minutes}:00`);
export const endlessSetting = (endless: boolean) => `Endless play: ${endless ? "On" : "Off"}`;
export const automaticRematchSetting = (automatic: boolean) => `Automatic rematch: ${automatic ? "On" : "Off"}`;
export const hazardsSetting = (on: boolean) => `Hazards: ${on ? "On" : "Off"}`;
export const dropsSetting = (on: boolean) => `Drops: ${on ? "On" : "Off"}`;
export const itemsSetting = (on: boolean) => `Items: ${on ? "On" : "Off"}`;
export const ultimatesSetting = (on: boolean) => `Ultimates: ${on ? "On" : "Off"}`;
export const itemKindSetting = (kind: ItemKind, on: boolean) => `${kind === ItemKind.speed ? "Speed" : "Heavy"} item: ${on ? "On" : "Off"}`;


export const modeSetting = (game: Readonly<MatchState>) => `Mode: ${game.lore ? "Lore Battles" : game.classic ? "Classic" : game.training ? "Training" : "Versus"}`;
const BEHAVIOUR_NAMES = ["Stand", "Shield", "Crouch", "Jump", "Attack", "Fight"];
const ESCAPE_NAMES = ["None", "Toward you", "Away", "Random"];
const TECH_NAMES = ["None", "In place", "Toward you", "Away", "Random"];
export const partnerBehaviourSetting = (code: number) => `Partner: ${BEHAVIOUR_NAMES[code] ?? ""}`;
export const partnerEscapeSetting = (code: number) => `Partner drift: ${ESCAPE_NAMES[code] ?? ""}`;
export const partnerTechSetting = (code: number) => `Partner tech: ${TECH_NAMES[code] ?? ""}`;
export const partnerDamageSetting = (damage: number) => `Partner damage: ${damage}%`;
export const hitAreasSetting = (shown: boolean) => `Hit areas: ${shown ? "On" : "Off"}`;
export const trainingSpeedSetting = (speed: number) => `Game speed: ${speed === 4 ? "Quarter" : speed === 2 ? "Half" : "Full"}`;


export function rulesSummary(game: Readonly<MatchState>): string {
  if (game.classic) return `Classic · starts at ${tierName(game.classicTier)}`;
  if (game.lore) return `Lore Battle · ${loreBattle(game.loreBattle)?.title ?? ""}`;
  if (game.training) return "Training · No time limit";
  if (practiceSelected(game)) return "Practice · No time limit";
  const rules = game.endless ? "Endless" : `${stockSetting(game.stockCount)}  ·  ${timeSetting(game.timeLimitMinutes)}`;
  return game.automaticRematch ? `${rules}  ·  Automatic rematch` : rules;
}

export const pausedMessage = (start: StartControl) => `Paused — press ${start} to resume.`;


export function waitingMessage(slots: number): string {
  const players = PARTICIPANT_SLOTS.filter(slot => participantActive(slots, slot)).map(slot => `${slot + 1}`);
  const last = players.pop() ?? "";
  return players.length === 0 ? `Waiting for Player ${last}` : `Waiting for Players ${players.join(", ")} and ${last}`;
}


export const KEYBOARD_FALLBACK_MESSAGE = "No controller found: use the keyboard.";


export function matchHelp(game: Readonly<MatchState>, paused: boolean, start: StartControl, local: Readonly<Fighter> | undefined, playing: boolean): string {
  if (playing && !paused && local !== undefined) {
    if (local.down.state === DownState.wait) return "Knocked down: Attack/Special to strike, Up/Jump/Shield to stand, Left/Right to roll.";
    if (local.ledge.state === LedgeState.hang) return "Ledge: Up or toward stage to climb; Jump to leap; Shield to roll; Attack to strike.\nDown or away from stage lets go.";
  }
  if (!playing) return rematchStatus(game, start);
  if (paused) return `PAUSED — Press ${start} to resume. Combat is frozen.${game.practice || game.endless || game.training ? "\nEscape: back to fighter selection." : ""}`;
  return `${start}: pause. Tap Shield before a hard landing to tech; hold Left/Right for a tech roll.\nShield + Special: EX special (one bar segment).\nAttack + Special (A + X): Ultimate (full bar).\nShield then Left/Right: roll; Down: dodge.`;
}


const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);


export function trainingReadout(state: Readonly<TrainingState>): string {
  const lines: string[] = [];
  if (state.moveSpecial >= 0) lines.push(`${specialName(state.moveCharacter, state.moveSpecial, state.moveForm)}: ${state.moveTotal} total`);
  else if (state.moveStyle >= 0) lines.push(`${normalName(state.moveStyle)}: hits on frame ${state.moveStartup} · ${state.moveActive} active · ${state.moveTotal} total`);
  if (state.advantageKind !== Advantage.none) lines.push(`${signed(state.advantage)} on ${state.advantageKind === Advantage.shield ? "shield" : "hit"}`);
  if (state.comboHits > 0) lines.push(`Combo: ${state.comboHits} ${state.comboHits === 1 ? "hit" : "hits"} · ${Math.floor(state.comboDamage)}%`);
  return lines.join("\n");
}


export function selectionModeLabel(game: Readonly<MatchState>): string {
  return game.lore ? "LORE BATTLES" : game.classic ? "CLASSIC" : game.training ? "TRAINING" : "VERSUS";
}
export const MOVES_HEADER = "MOVES";





export function movesPage(character: number, ultimates: boolean): { title: string; lines: string[] } {
  const kit = fighterKit(character);
  const lines: string[] = [];
  for (let slot = 0; slot < kit.specials.length; slot++) {
    const special = kit.specials[slot];
    if (special !== undefined) lines.push(`${SPECIAL_INPUTS[slot] ?? "Special"}: ${special.name}. ${special.description}`);
  }
  if (kit.trait !== undefined) lines.push(kit.trait);
  if (ultimates && kit.ultimate !== undefined) lines.push(`Ultimate: ${kit.ultimate.name}. ${kit.ultimate.description}`);
  return { title: `${fighterName(character).toUpperCase()} — MOVES`, lines };
}
