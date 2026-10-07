// Lua debug upvalues and native handle representations are the foreign boundary
// this census observes; Bun cannot execute its graph walk.
import { assertEquals, test } from "wisp/src/runtime/testing";
import { createBotStrategy, copyBotStrategy } from "../../src/game/match/botStrategy";
import { HabitChoice } from "../../src/game/match/botHabits";
import { HeadlessClient } from "wisp/src/headless/client";
import { HandleCensus, compactEmulator, reach } from "../../scripts/wisp/memoryCensus";

test("the map table census excludes opaque native identities and still counts matching domain records", () => {
  const first = { id: 1, kind: "effect" };
  const second = { id: 2, kind: "effect" };
  const retained: { value: number }[] = [];
  const state = { handles: [first], domain: { id: 3, kind: "effect" }, retained };
  const environment = new LuaTable<AnyNotNil, unknown>();
  environment.set("map", state);
  const baseline = reach(environment, [first], true);
  assertEquals(baseline.tables, 4);
  state.handles.push(second);
  assertEquals(reach(environment, [first, second], true).tables, baseline.tables);
  state.retained.push({ value: 4 });
  assertEquals(reach(environment, [first, second], true).tables, baseline.tables + 1);
  assertEquals(reach(environment, [first], true).tables, baseline.tables + 2);
});

test("emulator compaction drops sound event history while preserving live sounds and call checksums", () => {
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


test("copied bot reads add no reachable tables when reads appear after warmup", () => {
  const source = createBotStrategy();
  const snapshots = [createBotStrategy(), createBotStrategy(), createBotStrategy(), createBotStrategy()];
  const environment = new LuaTable<AnyNotNil, unknown>();
  environment.set("snapshots", snapshots);
  for (const snapshot of snapshots) copyBotStrategy(snapshot, source);
  const before = reach(environment, [], true).tables;
  source.readChoice = HabitChoice.shield;
  source.readExpectedFrame = 153;
  source.readExpires = 171;
  source.readConfidence = 100;
  for (let turn = 0; turn < 500; turn++) {
    source.readActive = !source.readActive;
    source.readActionFrame = turn;
    for (const snapshot of snapshots) copyBotStrategy(snapshot, source);
  }
  assertEquals(reach(environment, [], true).tables, before);
  source.readActive = true;
  for (const snapshot of snapshots) copyBotStrategy(snapshot, source);
  assertEquals(reach(environment, [], true).tables, before);
  for (const snapshot of snapshots) {
    assertEquals(snapshot.readChoice, HabitChoice.shield);
    assertEquals(snapshot.readExpectedFrame, 153);
    assertEquals(snapshot.readActionFrame, 499);
  }
});
