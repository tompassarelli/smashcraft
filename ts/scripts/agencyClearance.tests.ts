// The agency forecast's clearance bound (src/game/presentation/agencyClearance.ts,
// #168) never changes a marker: computer matches on every stage, each
// fighter classified every frame by the bounded forecast and by one that
// simulates every frame of its window, must agree on every frame.
import { expect, test } from "bun:test";
import { clearAttackBuffer } from "../src/game/input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../src/game/input/participants";
import { createFrameControls } from "../src/game/match/controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "../src/game/match/frameInput";
import { createPacingAndPresentation } from "../src/game/match/pacingAndPresentation";
import { MATCH_TICKS_PER_SECOND, Phase, createMatchState, setParticipants } from "../src/game/match/rules";
import { initializeMatchFighters, matchSpawnX } from "../src/game/match/step";
import { produceComputerInput } from "../src/game/match/botPlay";
import { FighterAgencyForecast } from "../src/game/presentation/fighterAgency";
import { Character, DownState } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { copyControls, createRoster, fighterAt, neutralControls } from "../src/game/sim/roster";
import { FIELD_STAGES } from "./cpuField";

const PAIRS: readonly (readonly [Character, Character])[] = [
  [Character.mountainKing, Character.blademaster],
  [Character.demonHunter, Character.rifleman],
  [Character.pitLord, Character.lich],
];
const FRAMES = 2400;

test("the bounded agency forecast agrees with the full one on every frame of computer matches on every stage", () => {
  const bounded = new FighterAgencyForecast();
  const full = new FighterAgencyForecast(false);
  let compared = 0;
  let tumbling = 0;
  const mismatches: string[] = [];
  for (const [stageName, stage] of Object.entries(FIELD_STAGES)) {
    for (const [seed, [a, b]] of PAIRS.entries()) {
      const match = createMatchState();
      setParticipants(match, 0, 3);
      match.characterChoices[0] = a;
      match.characterChoices[1] = b;
      match.stageChoice = stage;
      match.matchSeed = seed;
      match.stockCount = 99;
      match.timeLimitMinutes = 4;
      match.remainingFrames = 4 * 60 * MATCH_TICKS_PER_SECOND;
      match.phase = Phase.match;
      const world = createRoster(3, [createFighter(a, matchSpawnX(0), 1), createFighter(b, matchSpawnX(1), -1)]);
      const controls = createFrameControls();
      const produced = createFrameControls();
      const runtime = createPacingAndPresentation();
      const row = createMatchFrameInput();
      initializeMatchFighters(match, world);
      for (let frame = 1; frame <= FRAMES && match.phase === Phase.match; frame++) {
        for (const slot of PARTICIPANT_SLOTS) {
          copyControls(produced.inputs[slot], neutralControls());
          clearAttackBuffer(produced.commands[slot]);
          if (slot <= 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
        }
        if (!captureFrame(row, frame, world.mask, produced, runtime) || !executeMatchFrame(row, match, world, controls, runtime, frame)) throw new Error(`frame ${frame} refused`);
        for (const slot of [0, 1]) {
          const want = full.classify(world, slot, stage, match.matchFrame);
          const got = bounded.classify(world, slot, stage, match.matchFrame);
          compared++;
          if (fighterAt(world, slot).down.state === DownState.tumble) tumbling++;
          if (want !== got) mismatches.push(`${stageName} seed ${seed} frame ${frame} p${slot}: ${got}, simulated ${want}`);
        }
      }
    }
  }
  expect(mismatches).toEqual([]);
  // The comparison saw the tumbles the bound shortens.
  expect(tumbling).toBeGreaterThan(500);
  expect(compared).toBeGreaterThan(50000);
}, 600_000);
