import type { PacingAndPresentation } from "../../game/match/pacingAndPresentation";
import { type MatchState, Phase } from "../../game/lobby/lobbyState";
import type { Roster } from "../../game/sim/roster";
import { type ShellState, activeRollback } from "./state";

export interface PresentedMatch {
  readonly game: MatchState;
  readonly world: Roster;
  readonly runtime: PacingAndPresentation;
  readonly playing: boolean;
}


export function presentedMatch(s: ShellState): PresentedMatch {
  const rollback = activeRollback(s);
  const confirmedPlaying = s.game.phase === Phase.match;
  if (s.build.presentation === "pool-predicted" && rollback !== undefined && confirmedPlaying) {
    const { speculative } = rollback;
    return { game: speculative.game, world: speculative.world, runtime: speculative.runtime, playing: speculative.game.phase === Phase.match };
  }
  return { game: s.game, world: s.world, runtime: s.runtime, playing: confirmedPlaying };
}


export function presentedFrame(s: ShellState): number {
  return presentedMatch(s).runtime.simulationFrame;
}
