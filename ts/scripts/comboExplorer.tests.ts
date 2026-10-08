import { expect, test } from "bun:test";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { produceComputerInput } from "../src/game/match/botPlay";
import { Phase, createMatchState, setParticipants } from "../src/game/match/rules";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { captureReplaySnapshot, createReplaySnapshot } from "../src/game/replay/snapshot";
import { Character } from "../src/game/sim/codes";
import { canStartAttack } from "../src/game/sim/conditions";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, fighterAt } from "../src/game/sim/roster";
import { exploreFrom } from "./comboExplorer";

test("[invariant] the explorer finds the true follow-up played in a seeded Wren match", () => {
  const game = createMatchState();
  setParticipants(game, 0, 3);
  game.characterChoices[0] = Character.blademaster;
  game.characterChoices[1] = Character.rifleman;
  game.phase = Phase.match;
  game.stageChoice = 0;
  game.timeLimitMinutes = 0;
  game.matchSeed = 11;
  for (const slot of [0, 1] as const) {
    game.cpuOpponents[slot] = "wren";
    game.cpuResolvedOpponents[slot] = "wren";
    game.cpuTiers[slot] = "expert";
  }
  const world = createRoster(3, [createFighter(Character.blademaster, matchSpawnX(0), 1), createFighter(Character.rifleman, matchSpawnX(1), -1)]);
  initializeMatchFighters(game, world);
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const snapshot = createReplaySnapshot();
  const attacker = fighterAt(world, 0);
  const defender = fighterAt(world, 1);
  let root: { damage: number; hits: number; stocks: number; serial: number } | undefined;
  let found = false;
  for (let n = 1; n <= 1800; n++) {
    const beforeLag = defender.launch.hitlag;
    for (const slot of [0, 1] as const) {
      clearAttackBuffer(produced.commands[slot]);
      produceComputerInput(game, world, runtime, slot, n, produced.inputs[slot], produced.commands[slot]);
    }
    expect(captureFrame(row, n, world.mask, produced, runtime)).toBe(true);
    expect(executeMatchFrame(row, game, world, controls, runtime, n)).toBe(true);
    if (root !== undefined && (canStartAttack(defender) || defender.status.stocks !== root.stocks)) root = undefined;
    if (root !== undefined && defender.visuals.hit > root.hits && defender.status.damage > root.damage && attacker.attack.serial !== root.serial) {
      const setup = { stage: 0, attacker: Character.blademaster, defender: Character.rifleman, attackerX: attacker.motion.x, defenderX: defender.motion.x, facing: attacker.facing, attackerZ: attacker.motion.z, defenderZ: defender.motion.z, percent: root.damage };
      const actual = defender.status.damage - root.damage;
      const explored = exploreFrom(setup, snapshot);
      expect(explored.damage).toBeGreaterThanOrEqual(actual);
      console.log(`seed 11 frame ${n}: actual follow-up ${actual}%, explorer ${explored.damage}%`);
      found = true;
      break;
    }
    if (beforeLag > 0 && defender.launch.hitlag === 0 && defender.launch.hitstun > 0 && root === undefined) {
      captureReplaySnapshot(snapshot, world, game, controls, runtime);
      root = { damage: defender.status.damage, hits: defender.visuals.hit, stocks: defender.status.stocks, serial: attacker.attack.serial };
    }
  }
  expect(found).toBe(true);
});
