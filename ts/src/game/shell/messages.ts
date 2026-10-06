// Player-facing text of the match: announcements, results and help.
import { Advantage, type TrainingState } from "../match/trainingState";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { floorDiv } from "wisp/src/sim/intMath";
import { MATCH_TICKS_PER_SECOND, type MatchState, humanFighterActive, humanPresent, keepsStocks, practiceSelected } from "../match/rules";
import { AttackStyle, DownState, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { SPECIAL_INPUTS, fighterKit, normalName, specialName } from "../sim/moveNames";
import { fighterName } from "../sim/heroes/registry";

/** The control that starts, pauses and resumes: a controller's Start, or Y on a keyboard. */
export type StartControl = "Start" | "Y";

export function fighterLabel(game: Readonly<MatchState>, slot: number): string {
  return humanFighterActive(game, slot) ? `Player ${slot + 1}` : "Computer";
}

/** A knockout as the match announces it, calling out a fighter down to its last stock. */
export function stockLossMessage(game: Readonly<MatchState>, slot: number, stocks: number): string {
  const label = fighterLabel(game, slot);
  if (keepsStocks(game)) return `${label} was knocked out!`;
  return stocks === 1 ? `${label} is on their last stock!` : `${label} lost a stock!`;
}

const AERIAL_NAMES: Partial<Readonly<Record<AttackStyle, string>>> = {
  [AttackStyle.neutralAir]: "Neutral air!",
  [AttackStyle.forwardAir]: "Forward air!",
  [AttackStyle.backAir]: "Back air!",
  [AttackStyle.upAir]: "Up air!",
  [AttackStyle.downAir]: "Down air!",
};

export function aerialName(style: AttackStyle): string | undefined {
  return AERIAL_NAMES[style];
}

export function resultMessage(game: Readonly<MatchState>): string {
  const winner = game.winner === undefined ? undefined : fighterLabel(game, game.winner);
  if (game.interrupted) return winner === undefined ? "Match ended because a player left." : `${winner} wins by forfeit.`;
  if (winner !== undefined) return `${winner} wins!`;
  return game.timedOut ? "Time! Draw." : "Draw!";
}

const confirmControl = (start: StartControl) => (start === "Start" ? "A or Start" : "Y");

function rematchStatus(game: Readonly<MatchState>, start: StartControl): string {
  if (game.rematchCountdown > 0) return "Press any button to stop the rematch.";
  const present = PARTICIPANT_SLOTS.filter(slot => humanPresent(game, slot));
  const ready = present.filter(slot => game.rematchReadiness[slot]);
  return `${ready.length}/${present.length} ready. Press ${confirmControl(start)} to choose your next match.`;
}

/** The result announcement, with the automatic rematch's countdown while it runs. */
export function resultNotice(game: Readonly<MatchState>, result: string): string {
  return game.rematchCountdown > 0 ? `${result}\nRematch in ${floorDiv(game.rematchCountdown + MATCH_TICKS_PER_SECOND - 1, MATCH_TICKS_PER_SECOND)}` : result;
}

export const stockSetting = (count: number) => (count === 1 ? "1 Stock" : `${count} Stocks`);
export const timeSetting = (minutes: number) => (minutes === 0 ? "No time limit" : `${minutes}:00`);
export const endlessSetting = (endless: boolean) => `Endless: ${endless ? "On" : "Off"}`;
export const cpuLevelSetting = (level: number) => `Level ${level}`;
export const automaticRematchSetting = (automatic: boolean) => `Automatic rematch: ${automatic ? "On" : "Off"}`;
export const trainingSetting = (training: boolean) => `Training: ${training ? "On" : "Off"}`;
const BEHAVIOUR_NAMES = ["Stand", "Shield", "Crouch", "Jump", "Attack", "Fight"];
const ESCAPE_NAMES = ["None", "Toward you", "Away", "Random"];
const TECH_NAMES = ["None", "In place", "Toward you", "Away", "Random"];
export const partnerBehaviourSetting = (code: number) => `Partner: ${BEHAVIOUR_NAMES[code] ?? ""}`;
export const partnerEscapeSetting = (code: number) => `Drift: ${ESCAPE_NAMES[code] ?? ""}`;
export const partnerTechSetting = (code: number) => `Tech: ${TECH_NAMES[code] ?? ""}`;
export const partnerDamageSetting = (damage: number) => `Partner damage: ${damage}%`;
export const hitAreasSetting = (shown: boolean) => `Hit areas: ${shown ? "On" : "Off"}`;
export const trainingSpeedSetting = (speed: number) => `Speed: ${speed === 4 ? "Quarter" : speed === 2 ? "Half" : "Full"}`;

/** The rules the next match plays by, as the stage screen shows them. */
export function rulesSummary(game: Readonly<MatchState>): string {
  if (game.training) return "Training · No time limit";
  if (practiceSelected(game)) return "Practice · No time limit";
  const rules = game.endless ? "Endless" : `${stockSetting(game.stockCount)}  ·  ${timeSetting(game.timeLimitMinutes)}`;
  return game.automaticRematch ? `${rules}  ·  Automatic rematch` : rules;
}

export const pausedMessage = (start: StartControl) => `Paused — press ${start} to resume.`;

/** The players a stalled match waits for, by the labels the HUD shows: "Waiting for Player 2". */
export function waitingMessage(slots: number): string {
  const players = PARTICIPANT_SLOTS.filter(slot => participantActive(slots, slot)).map(slot => `${slot + 1}`);
  const last = players.pop() ?? "";
  return players.length === 0 ? `Waiting for Player ${last}` : `Waiting for Players ${players.join(", ")} and ${last}`;
}

/** Shown to a player whose controller helper never reported ready, when the match starts on their keyboard. */
export const KEYBOARD_FALLBACK_MESSAGE = "No controller found: use the keyboard.";

/** The help line under the HUD during a match or its result. */
export function matchHelp(game: Readonly<MatchState>, paused: boolean, start: StartControl, local: Readonly<Fighter> | undefined, playing: boolean): string {
  if (playing && !paused && local !== undefined) {
    if (local.down.state === DownState.wait) return "Knocked down: Attack/Special to strike, Up/Jump/Shield to stand, Left/Right to roll.";
    if (local.ledge.state === LedgeState.hang) return "Ledge: Up or toward stage to climb; Jump to leap; Shield to roll; Attack to strike.\nDown or away from stage lets go.";
  }
  if (!playing) return rematchStatus(game, start);
  if (paused) return `PAUSED — Press ${start} to resume. Combat is frozen.${game.practice || game.endless || game.training ? "\nEscape: back to fighter selection." : ""}`;
  return `${start}: pause. Tap Shield before a hard landing to tech; hold Left/Right for a tech roll.\nHold Shield on the ground, then tap Left/Right to roll or Down to dodge.`;
}

/** Shown to the player who saved the last seconds of play for a bug report. */
export const MOMENT_SAVED_MESSAGE = "Moment saved";

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

/** Training's readout: the last move's frames, the advantage after the last hit or shielded hit, and the combo. */
export function trainingReadout(state: Readonly<TrainingState>): string {
  const lines: string[] = [];
  if (state.moveSpecial >= 0) lines.push(`${specialName(state.moveCharacter, state.moveSpecial, state.moveForm)}: ${state.moveTotal} total`);
  else if (state.moveStyle >= 0) lines.push(`${normalName(state.moveStyle)}: hits on frame ${state.moveStartup} · ${state.moveActive} active · ${state.moveTotal} total`);
  if (state.advantageKind !== Advantage.none) lines.push(`${signed(state.advantage)} on ${state.advantageKind === Advantage.shield ? "shield" : "hit"}`);
  if (state.comboHits > 0) lines.push(`Combo: ${state.comboHits} ${state.comboHits === 1 ? "hit" : "hits"} · ${Math.floor(state.comboDamage)}%`);
  return lines.join("\n");
}

/** The selection header's title: the match mode, or the Moves page while it is open. */
export function selectionModeLabel(training: boolean): string {
  return training ? "TRAINING" : "VERSUS";
}
export const MOVES_HEADER = "MOVES";

/**
 * The Moves page: a fighter's specials, passive and, while ultimates are on,
 * ultimate, one line each. Title first, then one line per move.
 */
export function movesPage(character: number, ultimates: boolean): { title: string; lines: string[] } {
  const kit = fighterKit(character);
  const lines: string[] = [];
  for (let slot = 0; slot < kit.specials.length; slot++) {
    const special = kit.specials[slot];
    if (special !== undefined) lines.push(`${SPECIAL_INPUTS[slot] ?? "Special"}: ${special.name}. ${special.description}`);
  }
  const { passive } = kit;
  lines.push(passive === undefined ? `No passive. ${kit.trait ?? ""}` : `Passive: ${passive.name}. ${passive.description}`);
  if (ultimates && kit.ultimate !== undefined) lines.push(`Ultimate: ${kit.ultimate.name}. ${kit.ultimate.description}`);
  return { title: `${fighterName(character).toUpperCase()} — MOVES`, lines };
}
