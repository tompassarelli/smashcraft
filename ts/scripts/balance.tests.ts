import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { BALANCE_SPEC, DISADVANTAGE_FRAMES, PUNISH_RESET_FRAMES, SCORE_WEIGHTS, type Measured, balanceGate, balanceScore, parseProfile, readProfiles } from "./balance";
import { SPECIAL_MOVE, moveVariety, playCpuMatch, reportedMove } from "./cpuField";

const doc = readFileSync(join(import.meta.dir, "../../docs/design/balance.md"), "utf8");

test("[spec docs/design/balance.md] the gate, punish and score constants are the doc's initial values", () => {
  // Changing a threshold changes this test, the constant and the doc together (Tom, 8 Oct).
  expect(BALANCE_SPEC).toEqual({ winLow: 0.4, winHigh: 0.6, spamMax: 0.45, topMoveMax: 0.4, varietyFloor: 0.55, openingsLow: 3, openingsHigh: 4 });
  expect([PUNISH_RESET_FRAMES, DISADVANTAGE_FRAMES]).toEqual([45, 30]);
  expect(SCORE_WEIGHTS).toEqual({ win: 1, profile: 0.5, variety: 1, spam: 1, probe: 1, openings: 10, recovery: 1 });
  for (const text of ["40% to 60%", "at most 45%", "at most 40%", "**45 frames**", "**30 frames**", "3-4 openings per kill", "0.55 by default", "| 0.5 |", "| 10 |"]) expect(doc).toContain(text);
});

const fighter: Measured = {
  fighter: "f", winRate: 0.5, topMove: "back-air", topDamageShare: 0.3, aerials: {}, airShare: 0.3, approachShare: 0.5, rangedShare: 0.1, specials: {}, variety: 0.7, spamWinRate: 0.3,
};

test("[spec docs/design/balance.md] balanced needs the win band, a spam probe at most 45% and no move over 40% but the signature", () => {
  expect(balanceGate(fighter, undefined)).toEqual({ fighter: "f", balanced: true, failures: [], measured: true });
  expect(balanceGate({ ...fighter, winRate: 0.61 }, undefined).failures).toEqual(["win rate 61%"]);
  expect(balanceGate({ ...fighter, spamWinRate: 0.46 }, undefined).failures).toEqual(["back-air spam wins 46%"]);
  expect(balanceGate({ ...fighter, topDamageShare: 0.41 }, undefined).failures).toEqual(["back-air deals 41% of damage (limit 40%)"]);
  const signature = parseProfile("fighter: f\nsignature: back-air 55\n", "doc");
  expect(balanceGate({ ...fighter, topDamageShare: 0.5 }, signature).balanced).toBe(true);
  expect(balanceGate({ ...fighter, topDamageShare: 0.56 }, signature).balanced).toBe(false);
  expect(balanceGate({ ...fighter, topMove: "forward-air", topDamageShare: 0.5 }, signature).balanced).toBe(false);
  const { spamWinRate: _, ...unprobed } = fighter;
  expect(balanceGate(unprobed, undefined)).toMatchObject({ balanced: false, failures: [], measured: false });
});

test("[spec docs/design/balance.md] the score adds weighted distances outside each target and nothing for unmeasured slots", () => {
  const profile = parseProfile("fighter: f\naerials: bair 0-20\napproach: 60-80\nvariety-floor: 0.8\n", "doc");
  const score = balanceScore({ ...fighter, winRate: 0.35, aerials: { "back-air": 0.3 }, topDamageShare: 0.45, spamWinRate: 0.5 }, profile);
  expect(score).toMatchObject({ openings: undefined, recovery: undefined, misses: ["back-air 30% (0%-20%)", "approach 50% (60%-80%)"] });
  for (const [term, want] of [["win", 5], ["profile", 20], ["variety", 10], ["spam", 5], ["probe", 5]] as const) expect(score[term]).toBeCloseTo(want, 6);
  expect(score.total).toBeCloseTo(5 + 0.5 * 20 + 10 + 5 + 5, 6);
  expect(balanceScore({ ...fighter, potentialOpeningsPerKill: 6 }, undefined).openings).toBe(2);
});

test("[spec docs/design/balance.md] every selectable fighter has one play-style profile in the design docs", () => {
  const profiles = readProfiles();
  expect(SELECTABLE_CHARACTERS.map(fighterSlug).filter((slug) => !profiles.has(slug))).toEqual([]);
});

test("[invariant] move variety is 0 for one move and 1 for even use of the whole kit", () => {
  expect(moveVariety(new Map([[AttackStyle.jab, 40]]))).toBe(0);
  expect(moveVariety(new Map(Array.from({ length: 18 }, (_, index) => [index, 3] as [number, number])))).toBeCloseTo(1, 9);
  expect(reportedMove(AttackStyle.jab3)).toBe(AttackStyle.jab);
});

test("[spec docs/design/balance.md] the spam probe attacks only with its move, recovering with the up special", () => {
  const record = playCpuMatch(Character.archer, Character.mountainKing, "sky-deck", 0, { stocks: 1, minutes: 1, spam: { archer: AttackStyle.upTilt } });
  const started = Object.keys(record?.sides[0].moves ?? {}).map(Number);
  expect(started).toContain(AttackStyle.upTilt);
  expect(started.filter((move) => move !== AttackStyle.upTilt && move !== SPECIAL_MOVE.up)).toEqual([]);
});
