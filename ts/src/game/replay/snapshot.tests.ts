import { floorMod } from "wisp/src/sim/intMath";
import { at } from "wisp/src/runtime/lookup";
import { assertEquals, assertFalse, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { attackBuffer } from "../input/attackBuffer";
import { captureNetworkFrame, createMatchFrameInput, resetMatchFrameInput } from "../match/frameInput";
import { participantInputs } from "../input/participants";
import { matchSpawnX } from "../match/step";
import { Character, ProjectileKind } from "../sim/codes";
import { type Projectile, createFighter } from "../sim/fighter";
import { spawnProjectileMotion } from "../sim/projectiles";
import { createRoster, fighterAt } from "../sim/roster";
import { canonicalState, stateChecksum, stateHash } from "./canonical";
import { sameReplayState } from "./difference";
import { ReplayHistory } from "./history";
import { REPLAY_MAX_CORRECTION_FRAMES } from "./limits";
import { type ReplayState, copyReplayState, createReplaySnapshot } from "./snapshot";
import { type TapeWorld, createTapeWorld, executeTapeRow } from "./tapeWorld";

// The Lua test runner stops the collector for each test (test/lua/entry.ts), so the heap's growth is what a test allocated.
declare const collectgarbage: (this: void, opt: "count") => number;

const SLOTS = [0, 1, 2, 3] as const;
const FRAMES = 240;

function fourRiflemen(): TapeWorld {
  const tape = createTapeWorld({ stocks: 99, humans: 2 });
  const fighters = SLOTS.map(slot => createFighter(Character.rifleman, matchSpawnX(slot), floorMod(slot, 2) === 0 ? 1 : -1));
  const live = { ...tape.live, world: createRoster(15, fighters) };
  for (const slot of SLOTS) live.controls.commands[slot] = attackBuffer(4);
  return { live, snapshot: tape.snapshot };
}

function projectileTables(tape: TapeWorld): Readonly<Projectile>[] {
  const tables: Readonly<Projectile>[] = [];
  for (const slot of SLOTS) for (const projectile of fighterAt(tape.live.world, slot).projectiles) tables.push(projectile);
  return tables;
}

/**
 * Four Riflemen keep about 40 blasters in flight while history saves a
 * snapshot every frame. Returns the bytes Lua allocated per frame beyond the
 * same match played without snapshots (0 in Bun), and how many of the live
 * fighters' projectile tables were replaced.
 */
function snapshotCost(): { bytes: number; replaced: number; live: number } {
  const snapped = fourRiflemen();
  const plain = fourRiflemen();
  const before = projectileTables(snapped);
  const history = new ReplayHistory();
  assertTrue(history.beginEpoch(1, 1, REPLAY_MAX_CORRECTION_FRAMES));
  const inputs = participantInputs();
  const row = createMatchFrameInput();
  const lua = typeof collectgarbage === "function";
  const count = () => (lua ? collectgarbage("count") : 0.0);
  let snappedKb = 0.0;
  let plainKb = 0.0;
  let live = 0;
  for (let frame = 1; frame <= FRAMES; frame++) {
    if (floorMod(frame, 4) === 0) {
      for (const tape of [snapped, plain]) for (const slot of SLOTS) spawnProjectileMotion(fighterAt(tape.live.world, slot), ProjectileKind.blaster, slot < 2 ? 3.0 : -3.0, 0.0, 40, frame * 4 + slot);
    }
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, inputs, snapped.live.world, 3));
    let kb = count();
    assertTrue(history.save(1, row, snapped.live));
    assertTrue(executeTapeRow(snapped, row));
    snappedKb += count() - kb;
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, inputs, plain.live.world, 3));
    kb = count();
    assertTrue(executeTapeRow(plain, row));
    plainKb += count() - kb;
    live = Math.max(live, projectileTables(snapped).filter(projectile => projectile.life > 0).length);
  }
  const after = projectileTables(snapped);
  const replaced = before.filter((table, index) => after[index] !== table).length;
  return { bytes: (snappedKb - plainKb) * 1024 / FRAMES, replaced, live };
}

test("a rollback snapshot of fighters and projectiles copies fields into tables each fighter keeps, allocating no table per entity [invariant]", () => {
  const { bytes, replaced, live } = snapshotCost();
  assertLessThan(30, live);
  assertEquals(replaced, 0);
  // Copy-on-write projectiles allocated a ~600-byte table per live blaster after every snapshot (#400): about 22 KB a frame here.
  assertLessThan(bytes, 256);
});

/** Four Riflemen 30 frames into a match, with blasters in flight. */
function playedRiflemen(): TapeWorld {
  const played = fourRiflemen();
  const row = createMatchFrameInput();
  const inputs = participantInputs();
  for (let frame = 1; frame <= 30; frame++) {
    if (floorMod(frame, 4) === 0) for (const slot of SLOTS) spawnProjectileMotion(fighterAt(played.live.world, slot), ProjectileKind.blaster, 3.0, 0.0, 40, frame * 4 + slot);
    resetMatchFrameInput(row);
    assertTrue(captureNetworkFrame(row, frame, inputs, played.live.world, 3));
    assertTrue(executeTapeRow(played, row));
  }
  return played;
}

test("the per-frame state hash agrees with the canonical checksum on which states are equal [invariant]", () => {
  const played = playedRiflemen();
  const copy = createReplaySnapshot();
  copyReplayState(copy, played.live);
  assertEquals(stateHash(copy), stateHash(played.live));
  const changes: ((state: typeof copy) => void)[] = [
    state => { at(fighterAt(state.world, 2).projectiles, 3).x += 0.25; },
    state => { fighterAt(state.world, 1).motion.vx = -fighterAt(state.world, 1).motion.vx - 1.0; },
    state => { state.match.matchSeed++; },
    state => { state.runtime.botAttackDelays[0] += 1.5; },
  ];
  for (const change of changes) {
    copyReplayState(copy, played.live);
    change(copy);
    assertFalse(stateChecksum(copy) === stateChecksum(played.live));
    assertFalse(stateHash(copy) === stateHash(played.live));
  }
});

const HASH_MODULUS = 1_000_003;

test("#400 the state hash tells apart states that hashed equal: seeds a modulus apart, lore for classic, -0 for +0, a toggled computer decision [repro #400]", () => {
  const played = playedRiflemen();
  const first = createReplaySnapshot();
  const second = createReplaySnapshot();
  const differs = (change: (first: ReplayState, second: ReplayState) => void): boolean => {
    copyReplayState(first, played.live);
    copyReplayState(second, played.live);
    change(first, second);
    assertFalse(sameReplayState(first, second));
    return stateHash(first) !== stateHash(second);
  };
  // Any two seeds a multiple of the old modulus apart, across the 32-bit range.
  for (let index = 0; index < 16; index++) {
    const seed = floorMod(index * 1_234_567_891, 2_000_000_000) - 1_000_000_000;
    for (const multiple of [1, -1, 7]) assertEquals(differs((a, b) => { a.match.matchSeed = seed; b.match.matchSeed = seed + multiple * HASH_MODULUS; }), true, `seed ${seed} + ${multiple}`);
  }
  for (const value of [0, 1, 2, 5]) {
    assertEquals(differs((a, b) => { a.match.classic = true; a.match.classicTier = value; b.match.lore = true; b.match.loreBattle = value; }), true, `${value}`);
  }
  // Canonical text keeps folding signed zero and leaves decisions out; only the hash tells them apart.
  const textUnchanged = (change: (first: ReplayState, second: ReplayState) => void): boolean => {
    assertTrue(differs(change));
    return canonicalState(first) === canonicalState(second);
  };
  for (const slot of SLOTS) {
    assertEquals(textUnchanged((a, b) => { fighterAt(a.world, slot).motion.vx = 0.0; fighterAt(b.world, slot).motion.vx = -0.0; }), true, `${slot}`);
    assertEquals(textUnchanged((_, b) => { b.runtime.botDecisions[slot].decided = !b.runtime.botDecisions[slot].decided; }), true, `${slot}`);
    assertEquals(textUnchanged((_, b) => { b.runtime.observedLegal[slot] += HASH_MODULUS; }), true, `${slot}`);
  }
  // Presentation stays out: the sim never reads it.
  copyReplayState(first, played.live);
  copyReplayState(second, played.live);
  second.runtime.poses[0].clipTime += 1.5;
  assertEquals(stateHash(first), stateHash(second));
});
