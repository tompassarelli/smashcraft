import { Effect } from "effect";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../src/game/sim/heroes/registry";
import { BALANCE_SPEC, DISADVANTAGE_FRAMES, PUNISH_RESET_FRAMES, SCORE_WEIGHTS, withinWinTarget, type Measured, balanceGate, balanceScore, parseProfile, readProfiles } from "./balance";
import { SPECIAL_MOVE, moveVariety, playCpuMatch, reportedMove } from "./cpuField";

import recordedBaseline from "./balanceBaseline.json";
import { currentRosterKits } from "./balanceKit";
import { optimizeRound, tuningVerdict, kitFailures, freezePlay, type Baseline, type FrozenPlay, type TuningField } from "./balanceOptimizer";

const doc = readFileSync(join(import.meta.dir, "../../docs/design/balance.md"), "utf8");

const S = BALANCE_SPEC;
const pct = (n: number) => `${Math.round(100 * n)}%`;

test("[spec docs/design/balance.md] the doc states the gate, punish and score constants", () => {
  for (const text of [`${pct(S.winLow)} to ${pct(S.winHigh)}`, `at most ${pct(S.spamMax)}`, `at most ${pct(S.topMoveMax)}`, `**${PUNISH_RESET_FRAMES} frames**`, `**${DISADVANTAGE_FRAMES} frames**`,
    `Slippi count: ${S.slippiOpeningsLow}-${S.slippiOpeningsHigh}`, `pokes excluded: ${S.openingsLow}-${S.openingsHigh}`, `above ${pct(S.oneHitWarn)}`, `${S.varietyFloor} by default`,
    `| ${SCORE_WEIGHTS.profile} |`, `| ${SCORE_WEIGHTS.openings} |`, `${S.matchupMatches} matches a pair`, `${pct(S.matchupLow)} to ${pct(S.matchupHigh)}`, `±${pct(S.kitFraction)}`,
    `±${S.kitFrames} frames`, `±${pct(S.killFraction)}`, `${S.confidenceZ}`, `${S.feelFlightFrames} frames`, `0–${S.feelMaxPercent}%`, `one frame or ${pct(S.gradientFraction)}`]) expect(doc).toContain(text);
});

const fighter: Measured = {
  fighter: "f", winRate: S.winTarget, topMove: "back-air", topDamageShare: S.topMoveMax - 0.1, aerials: {}, airShare: 0.3, approachShare: 0.5, rangedShare: 0.1, specials: {}, variety: S.varietyFloor + 0.15, spamWinRate: S.spamMax - 0.15,
};

test("[spec docs/design/balance.md] balanced needs the win band, a spam probe within its limit and no move over its share but the signature", () => {
  expect(balanceGate(fighter, undefined)).toEqual({ fighter: "f", balanced: true, failures: [], measured: true });
  expect(balanceGate({ ...fighter, winRate: S.winHigh + 0.01 }, undefined).failures).toEqual([`win rate ${pct(S.winHigh + 0.01)}`]);
  expect(balanceGate({ ...fighter, spamWinRate: S.spamMax + 0.01 }, undefined).failures).toEqual([`back-air spam wins ${pct(S.spamMax + 0.01)}`]);
  expect(balanceGate({ ...fighter, topDamageShare: S.topMoveMax + 0.01 }, undefined).failures).toEqual([`back-air deals ${pct(S.topMoveMax + 0.01)} of damage (limit ${pct(S.topMoveMax)})`]);
  const signatureMax = Math.round(100 * S.topMoveMax) + 15;
  const signature = parseProfile(`fighter: f\napproach: 0-100\nranged: 0-100\nsignature: back-air ${signatureMax}\n`, "doc");
  expect(balanceGate({ ...fighter, topDamageShare: S.topMoveMax + 0.1 }, signature).balanced).toBe(true);
  expect(balanceGate({ ...fighter, topDamageShare: (signatureMax + 1) / 100 }, signature).balanced).toBe(false);
  expect(balanceGate({ ...fighter, topMove: "forward-air", topDamageShare: S.topMoveMax + 0.1 }, signature).balanced).toBe(false);
  const { spamWinRate: _, ...unprobed } = fighter;
  expect(balanceGate(unprobed, undefined)).toMatchObject({ balanced: false, failures: [], measured: false });
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
const measured355 = (name: string): Measured => ({ ...fighter, fighter: name, decisiveMatches: S.matchupMatches, approachShare: 0.65, matchups: { [name === "f" ? "g" : "f"]: { rate: S.winTarget, matches: S.matchupMatches } } });
const baseline355: Baseline = Object.fromEntries(["f", "g"].map(name => [name, { values: { "hit.damage": 20, startupFrames: 10, "hit.launchX": 1 }, play: "profile-calibrated", feel: { smash: { advantage: -8, killPercent: 100 } } }]));
const frozen355: FrozenPlay = { phase: "kit", computerCode: "human reaction computer", computerProfiles: "wren expert", play: { f: "profile-calibrated", g: "profile-calibrated" } };
const field355 = (): TuningField => ({ computerCode: "human reaction computer", computerProfiles: "wren expert", seeds: [100,101], seedPairs: { 100: { "f:g": S.matchupMatches / 2 }, 101: { "f:g": S.matchupMatches / 2 } }, fighters: [measured355("f"), measured355("g")], kits: structuredClone(baseline355), samples: { 100: [measured355("f"), measured355("g")], 101: [measured355("f"), measured355("g")] } });
const verdict355 = (field: TuningField, used: ReadonlySet<number> = new Set()) => tuningVerdict(field, baseline355, frozen355, profiles355, used, true);

test("[spec #355] kit rounds fail changed computer play and accept frozen play", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  expect(verdict355({ ...field, kits: { ...field.kits, f: { ...field.kits.f!, play: "plays badly to reach 50%" } } })).toContain("f computer play changed after freeze");
  expect(verdict355({ ...field, computerProfiles: "wren novice" })).toContain("computer behavior changed after freeze");
  expect(verdict355({ ...field, computerCode: "opponent-specific AI trick" })).toContain("computer behavior changed after freeze");
  expect(() => freezePlay({ ...field, fighters: [{ ...measured355("f"), approachShare: 0.4 }, measured355("g")] }, profiles355, ["f","g"])).toThrow("Gameplan phase incomplete");
});

test("[spec #355] an even field average cannot hide a matchup outside its band or one short of its matches", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  const bad = { ...measured355("f"), matchups: { g: { rate: S.matchupLow - 0.01, matches: S.matchupMatches } } };
  expect(verdict355({ ...field, fighters: [bad, measured355("g")] })).toContain(`f matchup g ${pct(S.matchupLow - 0.01)} (${pct(S.matchupLow)}-${pct(S.matchupHigh)})`);
  expect(verdict355({ ...field, fighters: [{ ...bad, matchups: { g: { rate: S.winTarget, matches: S.matchupMatches - 1 } } }, measured355("g")] }).some(message => message.includes(`${S.matchupMatches - 1}/${S.matchupMatches}`))).toBe(true);
  for (const rate of [S.matchupLow, S.matchupHigh]) expect(verdict355({ ...field, fighters: [{ ...bad, matchups: { g: { rate, matches: S.matchupMatches } } }, measured355("g")] })).toEqual([]);
});

test("[spec #355] repeated rounds cannot drift past the kit fraction or kit frames from the fixed baseline", () => {
  const field = field355();
  expect(verdict355(field)).toEqual([]);
  const kit = (damage: number, startup: number) => ({ ...field.kits.f!, values: { ...field.kits.f!.values, "hit.damage": damage, startupFrames: startup } });
  expect(verdict355({ ...field, kits: { ...field.kits, f: kit(20 * (1 + S.kitFraction), 10 + S.kitFrames) } })).toEqual([]);
  expect(verdict355({ ...field, kits: { ...field.kits, f: kit(20 * (1 + S.kitFraction) + 1, 10 + S.kitFrames + 1) } }).filter(message => message.includes("outside baseline"))).toHaveLength(2);
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
  expect(verdict355({ ...field, kits: { ...field.kits, f: feel(1, 100 * (1 + S.killFraction) + 1) } }).filter(message => message.includes("feel"))).toHaveLength(2);
  expect(verdict355({ ...field, kits: { ...field.kits, f: feel(-1, 100 * (1 + S.killFraction)) } })).toEqual([]);
  expect(verdict355(field,new Set([100]))).toContain("confirmation reused optimizer seeds");
});

test("[spec #355] all 26 recorded kits stay inside fixed bounds and out-of-bound values fail", () => {
  const fixed: Baseline = recordedBaseline;
  const current = currentRosterKits();
  expect(Object.keys(fixed).sort()).toEqual(SELECTABLE_CHARACTERS.map(fighterSlug).sort());
  for (const [name, kit] of Object.entries(current)) {
    const before = fixed[name]!.values;
    expect(kitFailures(kit.values, before)).toEqual([]);
    const damage = Object.keys(before).find(path => path.endsWith(".damage") && before[path]! > 0)!;
    const frames = Object.keys(before).find(path => path.endsWith(".startupFrames"))!;
    expect(kitFailures({ ...kit.values, [damage]: before[damage]! * (1 + S.kitFraction + 0.01), [frames]: before[frames]! + S.kitFrames + 1 }, before)).toHaveLength(2);

  }
});

test("[spec #355] tuning aims at the win target and stops on the measured 95% interval without tightening the gate", async () => {
  const half = S.confidenceZ * Math.sqrt(S.winTarget * (1 - S.winTarget) / 10000);
  const inside = { ...measured355("f"), winRate: S.winTarget + 0.8 * half, decisiveMatches: 10000 };
  const outside = { ...inside, winRate: S.winTarget + 1.3 * half };
  expect(withinWinTarget(inside)).toBe(true);
  expect(withinWinTarget(outside)).toBe(false);
  expect(balanceGate({ ...outside, winRate: S.winHigh - 0.01 }, profile355).balanced).toBe(true);
  const before = field355();
  const current = { ...before, seedPairs: { 100: { "f:g": 5000 }, 101: { "f:g": 5000 } }, fighters: [{ ...inside, matchups: { g: { rate: inside.winRate, matches: 10000 } } }, { ...measured355("g"), decisiveMatches: 10000, matchups: { f: { rate: 1 - inside.winRate, matches: 10000 } } }] };
  const result = await Effect.runPromise(optimizeRound({ fighter: "f", current, baseline: baseline355, frozen: frozen355, profiles: profiles355, usedSeeds: new Set(), heldOutSeeds: [200,201], confirmationSeeds: [300,301], evaluate: () => { throw new Error("A stopped fighter must not run a candidate"); }, record: () => { throw new Error("A stopped fighter has no kept change"); } }));
  expect(result.trainingFields).toBe(0);
  expect(result.kept).toBeUndefined();
});
