

import { assertEquals, test } from "wisp/src/runtime/testing";
import { createBotStrategy, copyBotStrategy } from "../../src/game/match/botStrategy";
import { fighterBodyEnvelope } from "../../src/game/presentation/fighterPlacement";
import { createFighter } from "../../src/game/sim/fighter";
import { Character } from "../../src/game/sim/codes";
import { applyDirectionalInfluence, influenceOperands } from "../../src/game/sim/knockback";
import { setMeleeKnockback } from "../../src/game/sim/motion";
import { neutralControls } from "../../src/game/sim/roster";
import { HabitChoice } from "../../src/game/match/botHabits";
import { HeadlessClient } from "wisp/src/headless/client";
import { HandleCensus, compactEmulator, reach } from "../../scripts/wisp/memoryCensus";

test("emulator compaction drops sound event history while preserving live sounds and call checksums [invariant]", () => {
  const functions: readonly (readonly [string, string, number])[] = [["CreateSound", "sound", 7], ["StartSound", "void", 1]];
  const client = new HeadlessClient({ slot: 0, filePrefix: "sound-memory", humans: [0], declarations: { functions, constants: [], variables: [] }, localNatives: {}, network: [], screenWidth: 1280 });
  const census = new HandleCensus(client, functions);
  type Native = (this: void, ...args: unknown[]) => unknown;
  const isNative = (value: unknown): value is Native => typeof value === "function";
  const create = client.natives.CreateSound;
  const start = client.natives.StartSound;
  if (!isNative(create) || !isNative(start)) throw new Error("missing sound natives");
  const sound = create("sound.wav", false, false, false, 0, 0, "");
  for (let index = 0; index < 100; index++) start(sound);
  const checksum = client.checksum();
  assertEquals(client.soundLog.length, 101);
  compactEmulator(client, census.takeReleased());
  assertEquals(client.soundLog.length, 0);
  assertEquals(census.counts()[0]?.[0], "sound");
  assertEquals(census.counts()[0]?.[1], 1);
  assertEquals(client.checksum(), checksum);
});

test("1000 released sounds leave no retained client records or live handles [invariant]", () => {
  const functions: readonly (readonly [string, string, number])[] = [["CreateSound", "sound", 7], ["StartSound", "void", 1], ["KillSoundWhenDone", "void", 1]];
  const client = new HeadlessClient({ slot: 0, filePrefix: "sound-release", humans: [0], declarations: { functions, constants: [], variables: [] }, localNatives: {}, network: [], screenWidth: 1280 });
  const census = new HandleCensus(client, functions);
  type Native = (this: void, ...args: unknown[]) => unknown;
  const isNative = (value: unknown): value is Native => typeof value === "function";
  const create = client.natives.CreateSound;
  const start = client.natives.StartSound;
  const release = client.natives.KillSoundWhenDone;
  if (!isNative(create) || !isNative(start) || !isNative(release)) throw new Error("missing sound natives");
  const warmup = create("sound.wav", false, false, false, 0, 0, "");
  start(warmup);
  release(warmup);
  compactEmulator(client, census.takeReleased());
  const environment = new LuaTable<AnyNotNil, unknown>();
  environment.set("client", client);
  const baseline = reach(environment, [], false).tables;
  for (let index = 0; index < 1000; index++) {
    const sound = create("sound.wav", false, false, false, 0, 0, "");
    start(sound);
    release(sound);
  }
  const checksum = client.checksum();
  compactEmulator(client, census.takeReleased());
  assertEquals(census.counts()[0]?.[1], 0);
  assertEquals(client.soundLog.length, 0);
  assertEquals(client.missingNatives.length, 0);
  assertEquals(client.checksum(), checksum);
  assertEquals(reach(environment, [], false).tables, baseline);
});

test("copied bot reads add no reachable tables when reads appear after warmup [invariant]", () => {
  const source = createBotStrategy();
  const snapshots = [createBotStrategy(), createBotStrategy(), createBotStrategy(), createBotStrategy()];
  const environment = new LuaTable<AnyNotNil, unknown>();
  environment.set("snapshots", snapshots);
  for (const snapshot of snapshots) copyBotStrategy(snapshot, source);
  const before = reach(environment, []).tables;
  source.readChoice = HabitChoice.shield;
  source.readExpectedFrame = 153;
  source.readExpires = 171;
  source.readConfidence = 100;
  for (let turn = 0; turn < 500; turn++) {
    source.readActive = !source.readActive;
    source.readActionFrame = turn;
    for (const snapshot of snapshots) copyBotStrategy(snapshot, source);
  }
  assertEquals(reach(environment, []).tables, before);
  source.readActive = true;
  for (const snapshot of snapshots) copyBotStrategy(snapshot, source);
  assertEquals(reach(environment, []).tables, before);
  for (const snapshot of snapshots) {
    assertEquals(snapshot.readChoice, HabitChoice.shield);
    assertEquals(snapshot.readExpectedFrame, 153);
    assertEquals(snapshot.readActionFrame, 499);
  }
});

test("first hero rendering and nonzero DI use initialized records without adding reachable tables [invariant]", () => {
  const fighter = createFighter(Character.pitLord, 0.0, 1);
  const input = neutralControls();
  input.direction = -1;
  fighter.motion.grounded = false;
  setMeleeKnockback(fighter, 1.0, 1.0);
  const environment = new LuaTable<AnyNotNil, unknown>();
  environment.set("envelopes", fighterBodyEnvelope);
  environment.set("operands", influenceOperands);
  const baseline = reach(environment, []).tables;
  for (const character of Object.values(Character)) fighterBodyEnvelope(character);
  fighter.launch.diPending = true;
  applyDirectionalInfluence(fighter, input);
  assertEquals(reach(environment, []).tables, baseline);
});
