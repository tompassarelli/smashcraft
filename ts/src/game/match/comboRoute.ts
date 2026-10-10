





import { f32 } from "wisp/src/sim/f32";
import type { Character } from "../sim/codes";
import { type Scene, airborne, fighter, frameMasks, scene } from "./padScene";

export interface ComboSetup {
  readonly stage: number;
  readonly attacker: Character;
  readonly defender: Character;
  readonly attackerX: number;
  readonly defenderX: number;

  readonly facing: number;

  readonly attackerZ: number;
  readonly defenderZ: number;

  readonly percent: number;
}

export interface ComboRoute {
  readonly setup: ComboSetup;

  readonly held: readonly number[];
}


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

interface RouteResult {

  readonly damage: number;

  readonly stocksLost: number;
  readonly frames: number;
}


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

      if (defender.status.stocks === stocks) damage = defender.status.damage;
    }
  }
  return { damage: f32(damage - route.setup.percent), stocksLost: stocks - defender.status.stocks, frames };
}


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
