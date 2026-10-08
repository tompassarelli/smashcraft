// A combo route (smashcraft:docs/design/balance.md, "Combo potential"): a
// two-fighter setup and both controllers' held buttons on every frame, played
// from a new match through the match frame executor. The combo explorer
// (smashcraft:ts/scripts/comboExplorer.ts) finds routes by branching from
// saved states; replaying one from its setup must give the same damage in Bun
// and in 32-bit Lua.
import { f32 } from "wisp/src/sim/f32";
import type { Character } from "../sim/codes";
import { type Scene, airborne, fighter, frameMasks, scene } from "./padScene";

export interface ComboSetup {
  readonly stage: number;
  readonly attacker: Character;
  readonly defender: Character;
  readonly attackerX: number;
  readonly defenderX: number;
  /** The attacker's facing; the defender faces the other way. */
  readonly facing: number;
  /** Height above the deck; 0 stands on it. */
  readonly attackerZ: number;
  readonly defenderZ: number;
  /** The defender's damage before the first frame. */
  readonly percent: number;
}

export interface ComboRoute {
  readonly setup: ComboSetup;
  /** Runs of frames as triples: the attacker's held action mask, the defender's, and how many frames both are held. */
  readonly held: readonly number[];
}

/** The setup's match before its first frame: the attacker in slot 0, the defender in slot 1. */
export function comboScene(setup: ComboSetup): Scene {
  const match = scene(setup.stage, [
    { character: setup.attacker, x: setup.attackerX, facing: setup.facing },
    { character: setup.defender, x: setup.defenderX, facing: -setup.facing },
  ]);
  const attacker = fighter(match, 0);
  const defender = fighter(match, 1);
  if (setup.attackerZ > 0) airborne(attacker, setup.attackerX, setup.attackerZ);
  if (setup.defenderZ > 0) airborne(defender, setup.defenderX, setup.defenderZ);
  defender.status.damage = setup.percent;
  return match;
}

export interface RouteResult {
  /** The defender's damage gained over the route, until it lost a stock. */
  readonly damage: number;
  /** Stocks the defender lost. */
  readonly stocksLost: number;
  readonly frames: number;
}

/** Plays the route from its setup and reports what it did to the defender. */
export function playComboRoute(route: ComboRoute): RouteResult {
  const match = comboScene(route.setup);
  const defender = fighter(match, 1);
  const stocks = defender.status.stocks;
  const { held } = route;
  let frames = 0;
  let damage = defender.status.damage;
  for (let run = 0; run + 2 < held.length; run += 3) {
    const first = held[run] ?? 0;
    const second = held[run + 1] ?? 0;
    const count = held[run + 2] ?? 0;
    for (let n = 0; n < count; n++) {
      frameMasks(match, (slot) => (slot === 0 ? first : slot === 1 ? second : 0));
      frames++;
      // A lost stock resets the damage; the route's damage is what it dealt before.
      if (defender.status.stocks === stocks) damage = defender.status.damage;
    }
  }
  return { damage: f32(damage - route.setup.percent), stocksLost: stocks - defender.status.stocks, frames };
}

/** Run-length triples from per-frame attacker and defender masks. */
export function heldRuns(attacker: readonly number[], defender: readonly number[]): number[] {
  const runs: number[] = [];
  for (let n = 0; n < attacker.length; n++) {
    const a = attacker[n] ?? 0;
    const b = defender[n] ?? 0;
    const last = runs.length - 3;
    if (last >= 0 && runs[last] === a && runs[last + 1] === b) runs[last + 2] = (runs[last + 2] ?? 0) + 1;
    else runs.push(a, b, 1);
  }
  return runs;
}
