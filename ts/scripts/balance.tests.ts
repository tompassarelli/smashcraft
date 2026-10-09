import { Effect } from "effect";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { BALANCE_SPEC, DISADVANTAGE_FRAMES, PUNISH_RESET_FRAMES, SCORE_WEIGHTS, optimizerScore, withinWinTarget, scoreIntervalCritical, type Measured, balanceGate, balanceScore, parseProfile, readProfiles } from "./balance";
import { SPECIAL_MOVE, moveVariety, playCpuMatch, reportedMove } from "./cpuField";

import recordedBaseline from "./balanceBaseline.json";
import { currentRosterKits } from "./balanceKit";
import { optimizeRound, tuningVerdict, kitFailures, kitCandidates, acceptCandidate, completeFieldFailures, freezePlay, type Baseline, type FrozenPlay, type TuningField } from "./balanceOptimizer";

const doc = readFileSync(join(import.meta.dir, "../../docs/design/balance.md"), "utf8");

test("[spec docs/design/balance.md] the gate, punish and score constants are the doc's initial values", () => {
  // Changing a threshold changes this test, the constant and the doc together (Tom, 8 Oct).
  expect(BALANCE_SPEC).toEqual({ winLow: 0.45, winHigh: 0.55, winTarget: 0.5, matchupLow: 0.3, matchupHigh: 0.7, matchupMatches: 400, kitFraction: 0.25, kitFrames: 3, killFraction: 0.15, confidenceZ: 1.96, gradientFraction: 0.01, gradientFrames: 1, feelMaxPercent: 300, feelFlightFrames: 360, spamMax: 0.45, topMoveMax: 0.4, varietyFloor: 0.55, slippiOpeningsLow: 3, slippiOpeningsHigh: 4, openingsLow: 2, openingsHigh: 3, oneHitWarn: 0.5 });
  expect([PUNISH_RESET_FRAMES, DISADVANTAGE_FRAMES]).toEqual([45, 30]);
  expect(SCORE_WEIGHTS).toEqual({ win: 1, profile: 0.5, variety: 1, spam: 1, probe: 1, openings: 10, recovery: 1 });
  for (const text of ["45% to 55%", "at most 45%", "at most 40%", "**45 frames**", "**30 frames**", "Slippi count: 3-4", "pokes excluded: 2-3", "above 50%", "0.55 by default", "| 0.5 |", "| 10 |", "400 matches a pair", "30% to 70%", "±25%", "±3 frames", "±15%", "1.96", "360 frames", "0–300%", "one frame or 1%"]) expect(doc).toContain(text);
});

const fighter: Measured = {
  fighter: "f", winRate: 0.5, topMove: "back-air", topDamageShare: 0.3, aerials: {}, airShare: 0.3, approachShare: 0.5, rangedShare: 0.1, specials: {}, variety: 0.7, spamWinRate: 0.3,
};

test("[spec docs/design/balance.md] balanced needs the win band, a spam probe at most 45% and no move over 40% but the signature", () => {
  expect(balanceGate(fighter, undefined)).toEqual({ fighter: "f", balanced: true, failures: [], measured: true });
  expect(balanceGate({ ...fighter, winRate: 0.61 }, undefined).failures).toEqual(["win rate 61%"]);
  expect(balanceGate({ ...fighter, spamWinRate: 0.46 }, undefined).failures).toEqual(["back-air spam wins 46%"]);
  expect(balanceGate({ ...fighter, topDamageShare: 0.41 }, undefined).failures).toEqual(["back-air deals 41% of damage (limit 40%)"]);
  const signature = parseProfile("fighter: f\napproach: 0-100\nranged: 0-100\nsignature: back-air 55\n", "doc");
  expect(balanceGate({ ...fighter, topDamageShare: 0.5 }, signature).balanced).toBe(true);
  expect(balanceGate({ ...fighter, topDamageShare: 0.56 }, signature).balanced).toBe(false);
  expect(balanceGate({ ...fighter, topMove: "forward-air", topDamageShare: 0.5 }, signature).balanced).toBe(false);
  const { spamWinRate: _, ...unprobed } = fighter;
  expect(balanceGate(unprobed, undefined)).toMatchObject({ balanced: false, failures: [], measured: false });
});

test("[spec docs/design/balance.md] the score adds weighted distances outside each target and nothing for unmeasured slots", () => {
  const profile = parseProfile("fighter: f\naerials: bair 0-20\napproach: 60-80\nvariety-floor: 0.8\n", "doc");
  const score = balanceScore({ ...fighter, winRate: 0.40, aerials: { "back-air": 0.3 }, topDamageShare: 0.45, spamWinRate: 0.5 }, profile);
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
  const record = playCpuMatch(Character.rifleman, Character.mountainKing, "sky-deck", 0, { stocks: 1, minutes: 1, spam: { rifleman: AttackStyle.upTilt } });
  const started = Object.keys(record?.sides[0].moves ?? {}).map(Number);
  expect(started).toContain(AttackStyle.upTilt);
  expect(started.filter((move) => move !== AttackStyle.upTilt && move !== SPECIAL_MOVE.up)).toEqual([]);
});


const profile355 = parseProfile("fighter: f\narchetype: rushdown\napproach: 55-85\n", "spec #355");
const profiles355 = new Map([["f", profile355], ["g", { ...profile355, fighter: "g" }]]);
const measured355 = (name: string): Measured => ({ ...fighter, fighter: name, decisiveMatches: 400, approachShare: 0.65, matchups: { [name === "f" ? "g" : "f"]: { rate: 0.5, matches: 400 } } });
const baseline355: Baseline = Object.fromEntries(["f", "g"].map(name => [name, { values: { "hit.damage": 20, startupFrames: 10, "hit.launchX": 1 }, play: "profile-calibrated", feel: { smash: { advantage: -8, killPercent: 100 } } }]));
const frozen355: FrozenPlay = { phase: "kit", computerCode: "human reaction computer", computerProfiles: "wren expert", play: { f: "profile-calibrated", g: "profile-calibrated" } };
const field355 = (): TuningField => ({ computerCode: "human reaction computer", computerProfiles: "wren expert", seeds: [100,101], seedPairs: { 100: { "f:g": 200 }, 101: { "f:g": 200 } }, fighters: [measured355("f"), measured355("g")], kits: structuredClone(baseline355), samples: { 100: [measured355("f"), measured355("g")], 101: [measured355("f"), measured355("g")] } });
const verdict355 = (field: TuningField, used: ReadonlySet<number> = new Set()) => tuningVerdict(field, baseline355, frozen355, profiles355, used, true);

test("[spec #355] kit rounds fail changed computer play and accept frozen play", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  expect(verdict355({ ...field, kits: { ...field.kits, f: { ...field.kits.f!, play: "plays badly to reach 50%" } } })).toContain("f computer play changed after freeze");
  expect(verdict355({ ...field, computerProfiles: "wren novice" })).toContain("computer behavior changed after freeze");
  expect(verdict355({ ...field, computerCode: "opponent-specific AI trick" })).toContain("computer behavior changed after freeze");
  expect(() => freezePlay({ ...field, fighters: [{ ...measured355("f"), approachShare: 0.4 }, measured355("g")] }, profiles355, ["f","g"])).toThrow("Gameplan phase incomplete");
});

test("[spec #355] 50% field average cannot hide a 29% matchup or fewer than 400 matches", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  const bad = { ...measured355("f"), matchups: { g: { rate: 0.29, matches: 400 } } };
  expect(verdict355({ ...field, fighters: [bad, measured355("g")] })).toContain("f matchup g 29% (30%-70%)");
  expect(verdict355({ ...field, fighters: [{ ...bad, matchups: { g: { rate: 0.5, matches: 399 } } }, measured355("g")] }).some(message => message.includes("399/400"))).toBe(true);
  for (const rate of [0.3,0.7]) expect(verdict355({ ...field, fighters: [{ ...bad, matchups: { g: { rate, matches: 400 } } }, measured355("g")] })).toEqual([]);
});

test("[spec #355] repeated rounds cannot drift past 25% damage or three frames from the fixed baseline", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  const kit = (damage: number, startup: number) => ({ ...field.kits.f!, values: { ...field.kits.f!.values, "hit.damage": damage, startupFrames: startup } });
  expect(verdict355({ ...field, kits: { ...field.kits, f: kit(25,13) } })).toEqual([]);
  expect(verdict355({ ...field, kits: { ...field.kits, f: kit(26,14) } }).filter(message => message.includes("outside baseline"))).toHaveLength(2);
});

test("[spec #355] defining archetype ranges fail a fighter while other profile ranges only score", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  expect(verdict355({ ...field, fighters: [{ ...measured355("f"), approachShare: 0.54 }, measured355("g")] })).toContain("f archetype approach 54% (55%-85%)");
  const profile = { ...profile355, airShare: { low: 0.7, high: 0.8 } };
  expect(balanceGate(measured355("f"), profile).balanced).toBe(true);
  expect(balanceScore(measured355("f"), profile).profile).toBeGreaterThan(0);
});

test("[spec #355] feel and fresh-seed locks reject flipped block sign, kill drift and reused confirmation seeds", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  const feel = (advantage: number, killPercent: number) => ({ ...field.kits.f!, feel: { smash: { advantage, killPercent } } });
  expect(verdict355({ ...field, kits: { ...field.kits, f: feel(1,116) } }).filter(message => message.includes("feel"))).toHaveLength(2);
  expect(verdict355({ ...field, kits: { ...field.kits, f: feel(-1,115) } })).toEqual([]);
  expect(verdict355(field,new Set([100]))).toContain("confirmation reused optimizer seeds");
});

test("[spec #355] all 26 recorded kits stay inside fixed bounds and out-of-bound values fail", () => {
  const fixed: Baseline = recordedBaseline;
  const current = currentRosterKits();
  expect(Object.keys(fixed).sort()).toEqual(SELECTABLE_CHARACTERS.map(fighterSlug).sort());
  expect(Object.keys(fixed)).toHaveLength(26);
  for (const [name, kit] of Object.entries(current)) {
    const before = fixed[name]!.values;
    expect(kitFailures(kit.values, before)).toEqual([]);
    const damage = Object.keys(before).find(path => path.endsWith(".damage") && before[path]! > 0)!;
    const frames = Object.keys(before).find(path => path.endsWith(".startupFrames"))!;
    expect(kitFailures({ ...kit.values, [damage]: before[damage]! * 1.26, [frames]: before[frames]! + 4 }, before)).toHaveLength(2);

  }
});

test("[spec #355] the optimizer rejects partial fields and noise and keeps the smallest passing kit change", () => {
  const before = field355();
  const sample = (winRate: number) => [100,101].reduce((out,seed) => ({ ...out, [seed]: [{ ...measured355("f"), winRate }, measured355("g")] }), {});
  const candidate = (damage: number, rate: number): TuningField => ({ ...before, samples: sample(rate), kits: { ...before.kits, f: { ...before.kits.f!, values: { ...before.kits.f!.values, "hit.damage": damage } } } });
  const poor: TuningField = { ...before, samples: sample(0.4) };
  const accepted = acceptCandidate("f", [{ before: poor, field: candidate(23,0.5) }, { before: poor, field: candidate(21,0.5) }], baseline355, frozen355, profiles355, new Set());
  expect(accepted?.after["hit.damage"]).toBe(21);
  expect(accepted?.beforeScore).toBeCloseTo(10);
  expect(accepted?.afterScore).toBe(0);
  expect(acceptCandidate("f", [{ before, field: candidate(21,0.5) }], baseline355,frozen355,profiles355,new Set())).toBeUndefined();
  expect(completeFieldFailures({ ...before, seedPairs: { 100: { "f:g": 400 } } }, ["f","g"]).some(message => message.includes("seed 101 missing pair"))).toBe(true);
  const variableBefore = { ...poor, samples: { 100: [{ ...measured355("f"), winRate: 0.39 }, measured355("g")], 101: [{ ...measured355("f"), winRate: 0.41 }, measured355("g")] } };
  expect(scoreIntervalCritical(2)).toBe(12.706);
  expect(acceptCandidate("f", [{ before: variableBefore, field: candidate(21,0.5) }], baseline355,frozen355,profiles355,new Set())).toBeUndefined();
  expect(kitCandidates(before.kits.f!.values, baseline355.f!.values).every(candidate => kitFailures(candidate, baseline355.f!.values).length === 0)).toBe(true);
  expect(kitFailures({ ...before.kits.f!.values, "hit.launchX": 0.8 }, baseline355.f!.values)).toHaveLength(1);
});


test("[spec #355] a descent round measures every candidate and records only an unused-seed confirmed improvement", async () => {
  const calls: number[][] = [];
  const written: string[] = [];
  const run = (values: Readonly<Record<string,number>>, seeds: readonly number[]): TuningField => {
    const winRate = values["hit.damage"]! > 20 ? 0.48 : 0.4;
    const fighters = [{ ...measured355("f"), winRate }, measured355("g")];
    return { ...field355(), seeds, seedPairs: Object.fromEntries(seeds.map(seed => [seed,{ "f:g": 200 }])), fighters, samples: Object.fromEntries(seeds.map(seed => [seed,fighters])), kits: { ...field355().kits, f: { ...baseline355.f!, values } } };
  };
  const result = await Effect.runPromise(optimizeRound({
    fighter: "f", current: run(baseline355.f!.values,[0,1]), baseline: baseline355, frozen: frozen355, profiles: profiles355,
    usedSeeds: new Set(), heldOutSeeds: [100,101], confirmationSeeds: [200,201],
    evaluate: async (values,seeds) => { calls.push([...seeds]); return run(values,seeds); },
    record: (_change,row) => Effect.sync(() => { written.push(row); }),
  }));
  expect(result.kept?.after["hit.damage"]).toBeCloseTo(20.2,5);
  expect(calls.filter(seeds => seeds[0] === 0)).toHaveLength(4);
  expect(calls.filter(seeds => seeds[0] === 100)).toHaveLength(2);
  expect(calls.filter(seeds => seeds[0] === 200)).toHaveLength(2);
  expect(written).toEqual([result.record]);
  expect(result.record).toContain("held-out seeds 100,101");
  expect(result.record).toContain("confirmation seeds 200,201");
});


test("[spec #355] tuning aims at 50 and stops on the measured 95% interval without tightening the 45–55 gate", async () => {
  const inside = { ...measured355("f"), winRate: 0.509, decisiveMatches: 10000 };
  const outside = { ...inside, winRate: 0.512 };
  expect(withinWinTarget(inside)).toBe(true);
  expect(withinWinTarget(outside)).toBe(false);
  expect(balanceGate({ ...outside, winRate: 0.54 }, profile355).balanced).toBe(true);
  expect(optimizerScore({ ...inside, winRate: 0.52 }, profile355)).toBeCloseTo(2);
  const before = field355();
  const poor = { ...before, samples: Object.fromEntries(before.seeds.map(seed => [seed,[{ ...measured355("f"), winRate: 0.4 }, measured355("g")]])) };
  const candidate = (damage: number, rate: number): TuningField => ({ ...before, fighters: [{ ...measured355("f"), winRate: rate }, measured355("g")], samples: Object.fromEntries(before.seeds.map(seed => [seed,[{ ...measured355("f"), winRate: rate }, measured355("g")]])), kits: { ...before.kits, f: { ...before.kits.f!, values: { ...before.kits.f!.values, "hit.damage": damage } } } });
  expect(acceptCandidate("f",[{ before: poor, field: candidate(21,0.48) },{ before: poor, field: candidate(23,0.5) }],baseline355,frozen355,profiles355,new Set())?.after["hit.damage"]).toBe(23);
  const current = { ...before, seedPairs: { 100: { "f:g": 5000 }, 101: { "f:g": 5000 } }, fighters: [{ ...inside, matchups: { g: { rate: 0.509, matches: 10000 } } }, { ...measured355("g"), decisiveMatches: 10000, matchups: { f: { rate: 0.491, matches: 10000 } } }] };
  const result = await Effect.runPromise(optimizeRound({ fighter: "f", current, baseline: baseline355, frozen: frozen355, profiles: profiles355, usedSeeds: new Set(), heldOutSeeds: [200,201], confirmationSeeds: [300,301], evaluate: () => { throw new Error("A stopped fighter must not run a candidate"); }, record: () => { throw new Error("A stopped fighter has no kept change"); } }));
  expect(result.trainingFields).toBe(0);
  expect(result.kept).toBeUndefined();
});
