import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { type ComboRoute, comboScene, heldRuns, playComboRoute } from "./comboRoute";
import { fighter, frameMasks } from "./padScene";

const setup = { stage: 0, attacker: Character.blademaster, defender: Character.rifleman, attackerX: -20.0, defenderX: 20.0, facing: 1, attackerZ: 0.0, defenderZ: 0.0, percent: 0.0 };
const routes: readonly ComboRoute[] = [
  { setup, held: [128, 0, 1, 0, 0, 6, 8, 2, 1, 0, 2, 25, 16418, 2, 1, 0, 2, 19, 0, 0, 4] },
  { setup: { ...setup, percent: 130.0 }, held: [128, 0, 1, 0, 0, 6, 8, 2, 1, 0, 2, 23, 2048, 2, 1, 0, 2, 59] },
  { setup: { ...setup, attackerZ: 100.0 }, held: [2048, 0, 1, 0, 0, 9, 0, 2, 12, 0, 0, 4] },
];

// Routes found by the explorer: up throw/forward tilt, up throw/forward smash,
// and forward air. Compare run-length playback against ordinary pad frames.
test("[invariant] searched combo routes preserve pad-frame damage and stock loss", () => {
  for (const route of routes) {
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
    assertTrue(actual.damage > 0.0);
  }
});
