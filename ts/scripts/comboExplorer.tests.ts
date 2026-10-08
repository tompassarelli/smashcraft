import { expect, test } from "bun:test";
import { copyAttackBuffer } from "../src/game/input/attackBuffer";
import { at } from "wisp/src/runtime/lookup";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { captureReplaySnapshot, createReplaySnapshot } from "../src/game/replay/snapshot";
import { Character } from "../src/game/sim/codes";
import { canStartAttack } from "../src/game/sim/conditions";
import { copyControls, fighterAt } from "../src/game/sim/roster";
import { exploreFrom } from "./comboExplorer";
import { FIXTURE, idleDamage, parseFollowUpFixture } from "./comboExplorerFixture";
import { comboScene } from "../src/game/match/comboRoute";
import { fighter, frameMasks } from "../src/game/match/padScene";
import { sweep } from "../test/sweep";

test("[invariant] the explorer finds a scripted up-throw follow-up through the match executor", () => {
  const setup = { stage: 0, attacker: Character.blademaster, defender: Character.rifleman, attackerX: -20.0, defenderX: 20.0, facing: 1, attackerZ: 0.0, defenderZ: 0.0, percent: 0.0 };
  const match = comboScene(setup);
  const defender = fighter(match, 1);
  for (const [first, second, count] of [[128, 0, 1], [0, 0, 6], [8, 2, 1], [0, 2, 25]]) {
    for (let n = 0; n < (count ?? 0); n++) frameMasks(match, (slot) => slot === 0 ? first ?? 0 : second ?? 0);
  }
  const snapshot = createReplaySnapshot();
  captureReplaySnapshot(snapshot, match.world, match.game, match.controls, match.runtime);
  const before = defender.status.damage;
  const explored = exploreFrom(setup, snapshot);
  let followed = false;
  for (let n = 0; n < 20; n++) {
    expect(canStartAttack(defender)).toBe(false);
    frameMasks(match, (slot) => slot === 0 ? n === 0 ? 16418 : 0 : 2);
    if (defender.status.damage > before) { followed = true; break; }
  }
  expect(followed).toBe(true);
  expect(explored.damage).toBeGreaterThanOrEqual(defender.status.damage - before);
});

sweep("[invariant] the explorer finds the true follow-up a Wren played, or a better one, from its recorded hitstun", async () => {
  const fixture = parseFollowUpFixture(await Bun.file(FIXTURE).text());
  expect(idleDamage(fixture.setup, fixture.state)).toBeLessThan(fixture.actual);
  const explored = exploreFrom(fixture.setup, fixture.state);
  // The recorded controls replayed from the same state still land the follow-up for the recorded damage.
  const { world, match, controls, runtime } = fixture.state;
  const defender = fighterAt(world, 1);
  const start = defender.status.damage;
  const row = createMatchFrameInput();
  const played = createFrameControls();
  fixture.frames.forEach(({ inputs, commands }, index) => {
    for (const slot of [0, 1] as const) {
      copyControls(played.inputs[slot], at(inputs, slot));
      copyAttackBuffer(played.commands[slot], at(commands, slot));
    }
    const n = fixture.rootFrame + 1 + index;
    expect(captureFrame(row, n, world.mask, played, runtime)).toBe(true);
    expect(executeMatchFrame(row, match, world, controls, runtime, n)).toBe(true);
  });
  expect(defender.status.damage - start).toBe(fixture.actual);
  expect(explored.damage).toBeGreaterThanOrEqual(fixture.actual);
});
