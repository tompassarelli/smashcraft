// Player-facing text of the match: announcements, results and help.
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type MatchState, humanFighterActive, humanPresent } from "../match/rules";
import { AttackStyle, DownState, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";

/** The control that starts, pauses and resumes: a controller's Start, or Y on a keyboard. */
export type StartControl = "Start" | "Y";

export function fighterLabel(game: Readonly<MatchState>, slot: number): string {
  return humanFighterActive(game, slot) ? `Player ${slot + 1}` : "Computer";
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

function rematchStatus(game: Readonly<MatchState>, start: StartControl): string {
  const present = PARTICIPANT_SLOTS.filter(slot => humanPresent(game, slot));
  const ready = present.filter(slot => game.rematchReadiness[slot]);
  return `${ready.length}/${present.length} ready. Press ${start === "Start" ? "A or Start" : "Y"} to choose your next match.`;
}

export const pausedMessage = (start: StartControl) => `Paused — press ${start} to resume.`;

/** The help line under the HUD during a match or its result. */
export function matchHelp(game: Readonly<MatchState>, paused: boolean, start: StartControl, local: Readonly<Fighter> | undefined, playing: boolean): string {
  if (playing && !paused && local !== undefined) {
    if (local.down.state === DownState.wait) return "Knocked down: Attack/Special to strike, Up/Jump/Shield to stand, Left/Right to roll.";
    if (local.ledge.state === LedgeState.hang) return "Ledge: Up or toward stage to climb; Jump to leap; Shield to roll; Attack to strike.\nDown or away from stage lets go.";
  }
  if (!playing) return rematchStatus(game, start);
  if (paused) return `PAUSED — Press ${start} to resume. Combat is frozen.`;
  return `${start}: pause. Tap Shield before a hard landing to tech; hold Left/Right for a tech roll.\nHold Shield on the ground, then tap Left/Right to roll or Down to dodge.`;
}
