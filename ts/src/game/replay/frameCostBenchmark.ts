import { floorMod } from "wisp/src/sim/intMath";
import { attackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { type FrameControls, createFrameControls } from "../match/controls";
import { type MatchFrameInput, captureFrame, createMatchFrameInput, executeMatchFrame } from "../match/frameInput";
import { createPacingAndPresentation } from "../match/pacingAndPresentation";
import { Phase, createMatchState } from "../match/rules";
import { createFighter } from "../sim/fighter";
import { createRoster } from "../sim/roster";
import { canonicalState, stateChecksum } from "./canonical";
import { copyReplayState, createReplaySnapshot } from "./snapshot";

const FRAME_COUNT = 4096;

interface FrameCostBenchmarkResult {
  readonly frames: number;
  readonly totalSeconds: number;
  readonly meanSecondsPerFrame: number;
  readonly initialChecksum: string;
  readonly finalChecksum: string;
  readonly finalState: string;
}


export function runFrameCostBenchmark(clock: () => number): FrameCostBenchmarkResult | undefined {
  const match = createMatchState();
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  match.stockCount = 99;
  const first = createFighter(1, 0.0, 1);
  const second = createFighter(1, 100.0, -1);
  first.status.stocks = 99;
  second.status.stocks = 99;
  const controls = createFrameControls();
  controls.commands[0] = attackBuffer(4);
  controls.commands[1] = attackBuffer(4);
  const live = { world: createRoster(3, [first, second]), match, controls, runtime: createPacingAndPresentation() };
  const snapshot = createReplaySnapshot();
  copyReplayState(snapshot, live);
  const initialChecksum = stateChecksum(snapshot);
  const inputs = createFrameControls();
  const firstInput = inputs.inputs[0];
  const secondInput = inputs.inputs[1];
  const firstRequests = attackBuffer(0);
  const secondRequests = attackBuffer(0);
  inputs.commands[0] = firstRequests;
  inputs.commands[1] = secondRequests;


  const rows: MatchFrameInput[] = [];
  for (let frame = 1; frame <= FRAME_COUNT; frame++) {
    const phase = floorMod(frame, 192);
    firstInput.direction = phase >= 96 && phase < 120 ? -1 : phase >= 144 && phase < 168 ? 1 : 0;
    secondInput.direction = 0 - firstInput.direction;
    firstInput.jumpPressed = phase === 128;
    firstInput.jumpHeld = phase >= 128 && phase < 142;
    secondInput.shield = frame <= 16;
    secondInput.techPressed = phase === 60;
    secondInput.sdiPulse = floorMod(phase, 3) === 0;
    secondInput.sdiX = floorMod(phase, 2) === 0 ? 1 : -1;
    clearAttackBuffer(firstRequests);
    clearAttackBuffer(secondRequests);
    if (frame === 1 || frame === 40) queueAttack(firstRequests, { style: 0, facing: 1, frame, mayCharge: false });
    if (phase >= 80 && floorMod(phase, 32) === 16) queueAttack(firstRequests, { style: 1, facing: 1, frame, mayCharge: false });
    if (phase === 160) queueAttack(secondRequests, { style: 6, facing: -1, frame, mayCharge: false });
    if (frame >= 3000 && frame < 3300) {
      secondInput.direction = 1;
      clearAttackBuffer(secondRequests);
    }

    const row = createMatchFrameInput();
    if (!captureFrame(row, frame, 3, inputs, live.runtime)) return undefined;
    rows.push(row);
  }

  const start = clock();
  for (let index = 0; index < FRAME_COUNT; index++) {
    const row = rows[index];
    if (row === undefined || !executeMatchFrame(row, live.match, live.world, live.controls, live.runtime, index + 1)) return undefined;
  }
  const totalSeconds = clock() - start;
  copyReplayState(snapshot, live);
  return { frames: FRAME_COUNT, totalSeconds, meanSecondsPerFrame: totalSeconds / FRAME_COUNT,
    initialChecksum, finalChecksum: stateChecksum(snapshot), finalState: canonicalState(snapshot) };
}
