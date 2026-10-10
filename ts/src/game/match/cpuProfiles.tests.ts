import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { HabitChoice } from "./botHabits";
import { useMatchSeed } from "./botRandom";
import { createBotStrategy, learnBotHabit, prepareBotRead } from "./botStrategy";
import { CPU_OPPONENT_IDS, CPU_PROFILES, CPU_TIERS, cpuProfile, resolveCpuOpponent } from "./cpuProfiles";
import { Phase, copyMatchState, createMatchState, requestStart, setCpuOpponent, setCpuTier, setParticipants } from "./rules";

test("Flint changes a practiced strike read after fewer new shield events at each tier at the human response deadline [k3 measure #186]", () => {
  let earlier = 8001;
  for (const tier of CPU_TIERS) {
    const profile = cpuProfile("flint", tier);
    let total = 0;
    for (let seed = 0; seed < 10; seed++) for (let trial = 0; trial < 10; trial++) {
      const own = createFighter(Character.rifleman, 0.0, 1);
      const target = createFighter(Character.rifleman, 60.0, -1);
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

        prepareBotRead(strategy, own, target, frame + 40, profile.reactionFrames, profile);
        if (strategy.readActive && strategy.readChoice === HabitChoice.shield) { switched = event + 1; break; }
      }
      assertTrue(switched > 0);
      total += switched;
    }
    if (total >= earlier) throw new Error(`${tier}: ${total} shield events, previous tier ${earlier}`);
    earlier = total;
  }
  useMatchSeed(0);
});

test("named opponents grow primary and secondary skills at five tiers while retaining different habits [k3 measure #184]", () => {
  assertEquals(CPU_PROFILES.length, CPU_OPPONENT_IDS.length * CPU_TIERS.length);
  for (const opponent of CPU_OPPONENT_IDS) for (let index = 0; index < CPU_TIERS.length; index++) {
    const tier = at(CPU_TIERS, index);
    const profile = cpuProfile(opponent, tier);
    assertEquals(profile.opponent, opponent);
    assertEquals(profile.tier, tier);
    assertTrue(profile.reactionFrames >= 14);
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

test("Random draws are replayable across slots and seeds and reach all six identities [k2 property]", () => {
  const seen: string[] = [];
  for (let seed = 0; seed < 150; seed++) for (const slot of PARTICIPANT_SLOTS) {
    const opponent = resolveCpuOpponent("random", seed, slot);
    assertEquals(resolveCpuOpponent("random", seed, slot), opponent);
    if (!seen.includes(opponent)) seen.push(opponent);
    assertEquals(resolveCpuOpponent("rook", seed, slot), "rook");
  }
  assertEquals(seen.length, CPU_OPPONENT_IDS.length);
});
