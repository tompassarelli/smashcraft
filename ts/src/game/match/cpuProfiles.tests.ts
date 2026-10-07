import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HabitChoice } from "./botHabits";
import { useMatchSeed } from "./botRandom";
import { createBotStrategy, learnBotHabit, prepareBotRead } from "./botStrategy";
import { CPU_OPPONENT_DEFAULT, CPU_OPPONENT_IDS, CPU_PROFILES, CPU_TIER_DEFAULT, CPU_TIERS, cpuProfile, isCpuOpponentChoice, isCpuTier, resolveCpuOpponent, stepCpuOpponent, stepCpuTier } from "./cpuProfiles";
import { Phase, copyMatchState, createMatchState, requestStart, setCpuOpponent, setCpuTier, setParticipants } from "./rules";

test("Flint changes a practiced strike read after fewer new shield events at each tier", () => {
  let earlier = 8001;
  for (const tier of CPU_TIERS) {
    const profile = cpuProfile("flint", tier);
    let total = 0;
    for (let seed = 0; seed < 10; seed++) for (let trial = 0; trial < 10; trial++) {
      const own = createFighter(Character.rifleman, 0.0, 1);
      const target = createFighter(Character.archer, 60.0, -1);
      const strategy = createBotStrategy();
      for (let event = 0; event < 20; event++) {
        const frame = event * 60;
        target.attack.style = AttackStyle.jab; target.attack.serial++;
        learnBotHabit(strategy, own, target, 1, frame, profile);
        target.attack.style = undefined;
        learnBotHabit(strategy, own, target, 1, frame + 8, profile);
      }
      useMatchSeed(seed);
      prepareBotRead(strategy, own, target, 1200 + trial, profile.reactionFrames, profile);
      let switched = 0;
      for (let event = 0; event < 80; event++) {
        const frame = 1260 + event * 60;
        target.shield.raised = true;
        learnBotHabit(strategy, own, target, 1, frame, profile);
        target.shield.raised = false;
        learnBotHabit(strategy, own, target, 1, frame + 8, profile);
        prepareBotRead(strategy, own, target, frame + profile.reactionFrames + 9, profile.reactionFrames, profile);
        if (strategy.read?.choice === HabitChoice.shield) { switched = event + 1; break; }
      }
      assertTrue(switched > 0);
      total += switched;
    }
    assertTrue(total < earlier);
    earlier = total;
  }
  useMatchSeed(0);
});

test("named opponents grow primary and secondary skills at five tiers while retaining different habits", () => {
  assertEquals(CPU_PROFILES.length, 30);
  for (const opponent of CPU_OPPONENT_IDS) for (let index = 0; index < CPU_TIERS.length; index++) {
    const tier = at(CPU_TIERS, index);
    const profile = cpuProfile(opponent, tier);
    assertEquals(profile.opponent, opponent);
    assertEquals(profile.tier, tier);
    assertTrue(profile.reactionFrames >= 12);
    assertTrue(profile.historyCapacity <= 32 && profile.historyStride >= 1);
    assertTrue(profile.guessPercent > 0 && profile.executionPercent < 100);
    if (index === 0) continue;
    const earlier = cpuProfile(opponent, at(CPU_TIERS, index - 1));
    assertTrue(profile.executionPercent > earlier.executionPercent);
    assertTrue(profile.judgmentPercent > earlier.judgmentPercent);
    assertTrue(profile.spacingPercent > earlier.spacingPercent);
    assertTrue(profile.reactionFrames < earlier.reactionFrames);
    assertTrue(profile.historyCapacity > earlier.historyCapacity);
    assertTrue(profile.repeatPercent < earlier.repeatPercent);
  }
  assertTrue(cpuProfile("rook", "expert").pressurePercent > cpuProfile("rook", "rookie").pressurePercent);
  assertTrue(cpuProfile("ember", "expert").readConfidence > cpuProfile("ember", "rookie").readConfidence);
  assertTrue(cpuProfile("rook", "expert").punishWeight > cpuProfile("ember", "expert").punishWeight);
  assertTrue(cpuProfile("kite", "expert").variancePercent > cpuProfile("vale", "expert").variancePercent);
  assertTrue(cpuProfile("flint", "expert").repeatPercent > cpuProfile("kite", "expert").repeatPercent);
});

test("opponent cycles include Random and tier stepping stops at its bounds", () => {
  assertEquals(stepCpuOpponent("rook", -1), "random");
  assertEquals(stepCpuOpponent("random", 1), "rook");
  assertEquals(stepCpuTier("rookie", -1), "rookie");
  assertEquals(stepCpuTier("expert", 1), "expert");
  assertTrue(isCpuOpponentChoice("random"));
  assertFalse(isCpuOpponentChoice("technician"));
  assertFalse(isCpuTier("gold"));
});

test("only the authorized human changes a CPU identity or tier during fighter selection", () => {
  const game = createMatchState();
  for (const slot of PARTICIPANT_SLOTS) {
    assertEquals(game.cpuOpponents[slot], CPU_OPPONENT_DEFAULT);
    assertEquals(game.cpuTiers[slot], CPU_TIER_DEFAULT);
  }
  setParticipants(game, 3, 4);
  setCpuOpponent(game, 1, 2, "ember");
  setCpuTier(game, 1, 2, "expert");
  assertEquals(game.cpuOpponents[2], "wren");
  assertEquals(game.cpuTiers[2], "intermediate");
  setCpuOpponent(game, 0, 2, "rook");
  setCpuTier(game, 0, 2, "advanced");
  assertEquals(game.cpuOpponents[2], "rook");
  assertEquals(game.cpuTiers[2], "advanced");
  setCpuOpponent(game, 0, 1, "kite");
  assertEquals(game.cpuOpponents[1], "wren");
  game.phase = Phase.match;
  setCpuOpponent(game, 0, 2, "kite");
  setCpuTier(game, 0, 2, "rookie");
  assertEquals(game.cpuOpponents[2], "rook");
  assertEquals(game.cpuTiers[2], "advanced");
});

test("Random resolves once at match start and survives a copied snapshot and rematch choice", () => {
  const game = createMatchState();
  setParticipants(game, 1, 2);
  game.characterReadiness[0] = true;
  setCpuOpponent(game, 0, 1, "random");
  setCpuTier(game, 0, 1, "beginner");
  game.phase = Phase.stageMenu;
  assertTrue(requestStart(game, 0));
  assertEquals(game.cpuResolvedOpponents[1], resolveCpuOpponent("random", 0, 1));
  const copy = createMatchState();
  copyMatchState(copy, game);
  assertEquals(copy.cpuOpponents[1], "random");
  assertEquals(copy.cpuTiers[1], "beginner");
  assertEquals(copy.cpuResolvedOpponents[1], game.cpuResolvedOpponents[1]);
  game.matchFrame = 120;
  game.phase = Phase.stageMenu;
  assertTrue(requestStart(game, 0));
  assertEquals(game.matchSeed, 1);
  assertEquals(game.cpuOpponents[1], "random");
  assertEquals(game.cpuResolvedOpponents[1], resolveCpuOpponent("random", 1, 1));
});

test("Random draws are replayable across slots and seeds and reach all six identities", () => {
  const seen: string[] = [];
  for (let seed = 0; seed < 150; seed++) for (const slot of PARTICIPANT_SLOTS) {
    const opponent = resolveCpuOpponent("random", seed, slot);
    assertEquals(resolveCpuOpponent("random", seed, slot), opponent);
    if (!seen.includes(opponent)) seen.push(opponent);
    assertEquals(resolveCpuOpponent("rook", seed, slot), "rook");
  }
  assertEquals(seen.length, CPU_OPPONENT_IDS.length);
});
