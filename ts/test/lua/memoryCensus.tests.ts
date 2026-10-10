

import { assertEquals, test } from "wisp/src/runtime/testing";
import { createBotStrategy, copyBotStrategy } from "../../src/game/match/botStrategy";
import { fighterBodyEnvelope } from "../../src/game/presentation/fighterPlacement";
import { createFighter } from "../../src/game/sim/fighter";
import { Character } from "../../src/game/sim/codes";
import { applyDirectionalInfluence, influenceOperands } from "../../src/game/sim/knockback";
import { setMeleeKnockback } from "../../src/game/sim/motion";
import { neutralControls } from "../../src/game/sim/roster";
import { HabitChoice } from "../../src/game/match/botHabits";
import { reach } from "../../scripts/wisp/memoryCensus";

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
