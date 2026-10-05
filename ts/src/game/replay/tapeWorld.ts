// Recorded-tape fixtures shared by the replay contracts, the soak and tape
// runners: Wurst ReplayHistoryTests' TapeWorld and runRecordedTape. Every
// rule still runs through the production frame executor and history.
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue } from "../../runtime/testing";
import { floorMod } from "../../sim/intMath";
import { attackBuffer, clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { type FrameControls, createFrameControls } from "../match/controls";
import { type MatchFrameInput, captureFrame, createMatchFrameInput, executeMatchFrame, resetMatchFrameInput } from "../match/frameInput";
import { Phase, createMatchState, setHumanCount } from "../match/rules";
import { createReplayRuntimeState } from "../match/runtime";
import { Character } from "../sim/codes";
import { type Fighter, createFighter } from "../sim/fighter";
import { projectileCount } from "../sim/projectiles";
import { createRoster, fighterAt, neutralControls } from "../sim/roster";
import { firstStateDifference } from "./difference";
import { ReplayHistory } from "./history";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";

export interface TapeWorldOptions {
  stocks: number;
  /** Connected humans in slots 0 upward, set before the match starts. */
  humans?: number;
  first?: Fighter;
  second?: Fighter;
}

/** A live two-fighter match and storage to capture it into. */
export interface TapeWorld {
  readonly live: ReplayState;
  readonly snapshot: ReplayState;
}

/**
 * Two fighters in a running match without a time limit, by default an archer
 * at 0 facing right and a rifleman at 100 facing left. Their command buffers
 * keep four grace frames.
 */
export function createTapeWorld({ stocks, humans = 1, first = createFighter(Character.archer, 0.0, 1), second = createFighter(Character.rifleman, 100.0, -1) }: TapeWorldOptions): TapeWorld {
  const match = createMatchState();
  setHumanCount(match, humans);
  match.phase = Phase.match;
  match.timeLimitMinutes = 0;
  match.stockCount = stocks;
  first.status.stocks = stocks;
  second.status.stocks = stocks;
  const controls = createFrameControls();
  controls.commands[0] = attackBuffer(4);
  controls.commands[1] = attackBuffer(4);
  return {
    live: { world: createRoster(3, [first, second]), match, controls, runtime: createReplayRuntimeState() },
    snapshot: createReplaySnapshot(),
  };
}

/** Copies the live match into the tape's snapshot storage and returns it. */
export function captureTape(tape: TapeWorld): ReplayState {
  copyReplayState(tape.snapshot, tape.live);
  return tape.snapshot;
}

/** Runs a recorded row on the live match; the row's frame must come next. */
export function executeTapeRow(tape: TapeWorld, row: MatchFrameInput): boolean {
  const { match, world, controls, runtime } = tape.live;
  return row.frame !== undefined && executeMatchFrame(row, match, world, controls, runtime, row.frame);
}

/**
 * Wurst runRecordedTape: a deterministic input tape runs in one world and,
 * through the history with rollbacks every rollbackStride frames and over the
 * last 63 frames every 64, in another; they must agree on every frame.
 */
export function runRecordedTape(frames: number, rollbackStride: number, startingStocks: number): void {
  const canonical = createTapeWorld({ stocks: startingStocks });
  const replayed = createTapeWorld({ stocks: startingStocks });
  const history = new ReplayHistory();
  const row = createMatchFrameInput();
  const firstInput = neutralControls();
  const secondInput = neutralControls();
  const firstRequests = attackBuffer(0);
  const secondRequests = attackBuffer(0);
  const produced: FrameControls = { inputs: [firstInput, secondInput, neutralControls(), neutralControls()], commands: [firstRequests, secondRequests, attackBuffer(0), attackBuffer(0)] };
  const reused: FrameControls = { inputs: [firstInput, firstInput, neutralControls(), neutralControls()], commands: [secondRequests, firstRequests, attackBuffer(0), attackBuffer(0)] };
  const first = fighterAt(canonical.live.world, 0);
  const second = fighterAt(canonical.live.world, 1);
  assertTrue(history.beginEpoch(1, 1));
  let sawShieldStun = false;
  let sawHitRegistry = false;
  let sawProjectile = false;
  let sawHitlag = false;
  let sawDamage = false;
  let sawRespawn = false;
  for (let frame = 1; frame <= frames; frame++) {
    // A deterministic input tape, independent of either world's evolving state.
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
    // Stock loss and respawn through recorded input, whatever the combat before it produced.
    if (frame >= 3000 && frame < 3300) {
      secondInput.direction = 1;
      clearAttackBuffer(secondRequests);
    }
    assertTrue(captureFrame(row, frame, 3, produced, canonical.live.runtime));
    assertTrue(history.save(1, row, replayed.live));
    assertTrue(executeTapeRow(canonical, row));
    assertTrue(executeTapeRow(replayed, row));
    // Reuse producer storage before rollback; the history keeps its own row.
    resetMatchFrameInput(row);
    firstInput.direction = 1;
    firstInput.shield = true;
    assertTrue(captureFrame(row, frame, 3, reused, canonical.live.runtime));
    firstInput.shield = false;
    if (floorMod(frame, rollbackStride) === 0) assertTrue(history.replay(1, Math.max(1, frame - 5), frame, replayed.live));
    if (floorMod(frame, 64) === 0) assertTrue(history.replay(1, frame - 63, frame, replayed.live));
    const difference = firstStateDifference(captureTape(canonical), captureTape(replayed));
    if (difference !== undefined) assertEquals(difference, undefined, `frame ${frame}`);
    sawDamage ||= second.status.damage > 0;
    sawRespawn ||= second.status.stocks < startingStocks && !second.status.out && second.status.invincible > 0;
    sawShieldStun ||= second.shield.stun > 0;
    sawHitRegistry ||= second.hits.lastAttacker === 0;
    sawProjectile ||= projectileCount(first) > 0;
    sawHitlag ||= first.launch.hitlag > 0 || second.launch.hitlag > 0;
  }
  assertTrue(sawShieldStun);
  assertTrue(sawHitRegistry);
  assertTrue(sawProjectile);
  assertTrue(sawHitlag);
  assertGreaterThan(first.attack.serial, 1);
  assertTrue(sawDamage);
  if (frames >= 4096) {
    assertLessThan(second.status.stocks, startingStocks);
    assertTrue(sawRespawn);
  }
  assertEquals(canonical.live.match.phase, Phase.match);
}
