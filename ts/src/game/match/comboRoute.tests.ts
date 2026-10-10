import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { type ComboRoute, comboScene, heldRuns, playComboRoute } from "./comboRoute";
import { fighter, frameMasks } from "./padScene";

const setup = { stage: 0, attacker: Character.blademaster, defender: Character.rifleman, attackerX: -20.0, defenderX: 20.0, facing: 1, attackerZ: 0.0, defenderZ: 0.0, percent: 0.0 };
const routes: readonly { readonly route: ComboRoute; readonly damage: number; readonly stocksLost: number }[] = [
  { route: { setup, held: [128, 0, 1, 0, 0, 6, 8, 2, 1, 0, 2, 25, 16418, 2, 1, 0, 2, 19, 0, 0, 4] }, damage: 15.295852661132812, stocksLost: 0 },
  { route: { setup: { ...setup, percent: 140.0 }, held: [128, 0, 1, 0, 0, 6, 8, 2, 1, 0, 2, 23, 2048, 2, 1, 0, 2, 62] }, damage: 19.961883544921875, stocksLost: 1 },
  { route: { setup: { ...setup, attackerZ: 100.0 }, held: [2048, 0, 1, 0, 0, 9, 0, 2, 12, 0, 0, 4] }, damage: 8.78322982788086, stocksLost: 0 },
];




test(" searched combo routes match Bun in Lua32 and preserve pad-frame damage and stock loss [k4 reference lua32]", () => {
  for (const recorded of routes) {
    const { route } = recorded;
    const match = comboScene(route.setup);
    const defender = fighter(match, 1);
    const stocks = defender.status.stocks;
    const first: number[] = [];
    const second: number[] = [];
    let damage = defender.status.damage;
    for (let run = 0; run < route.held.length; run += 3) {
      const a = route.held[run] ?? 0;
      const b = route.held[run + 1] ?? 0;
      const count = route.held[run + 2] ?? 0;
      for (let n = 0; n < count; n++) {
        first.push(a);
        second.push(b);
        frameMasks(match, (slot) => slot === 0 ? a : b);
        if (defender.status.stocks === stocks) damage = defender.status.damage;
      }
    }
    const actual = playComboRoute({ setup: route.setup, held: heldRuns(first, second) });
    assertEquals(actual.damage, f32(damage - route.setup.percent));
    assertEquals(actual.stocksLost, stocks - defender.status.stocks);
    assertEquals(actual.frames, first.length);
    assertEquals(actual.damage, recorded.damage);
    assertEquals(actual.stocksLost, recorded.stocksLost);
    assertTrue(actual.damage > 0.0);
  }
});
