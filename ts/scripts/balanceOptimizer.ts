import { Effect, Schema } from "effect";
import { BALANCE_SPEC, scoreIntervalCritical, optimizerScore, withinWinTarget, balanceScore, archetypeFailures, matchupFailures, type Measured, type PlayStyleProfile } from "./balance";
import { parameterKind, type KitSnapshot, type KitValues, type FeelValues } from "./balanceKit";

export interface FighterBaseline extends KitSnapshot { readonly feel: FeelValues }
export type Baseline = Readonly<Record<string, FighterBaseline>>;
export interface TuningField {
  readonly seeds: readonly number[];
  readonly computerCode: string;
  readonly computerProfiles: string;
  /** Every seed must cover every unordered pair; pairs aggregate at least 400 matches. */
  readonly seedPairs: Readonly<Record<number, Readonly<Record<string, number>>>>;
  readonly fighters: readonly Measured[];
  readonly kits: Readonly<Record<string, FighterBaseline>>;
  /** Independent complete-field samples on the same seed batches, never a sampled matchup estimate. */
  readonly samples: Readonly<Record<number, readonly Measured[]>>;
}
export interface FrozenPlay { readonly phase: "kit"; readonly computerCode: string; readonly computerProfiles: string; readonly play: Readonly<Record<string, string>> }
export type KitPatch = Readonly<Record<string, number>>;

export function kitFailures(current: KitValues, baseline: KitValues): string[] {
  const failures: string[] = [];
  for (const path of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    const before = baseline[path], after = current[path];
    if (before === undefined || after === undefined || !Number.isFinite(after)) { failures.push(`kit ${path} missing or nonfinite`); continue; }
    const kind = parameterKind(path);
    const limit = kind === "frames" ? BALANCE_SPEC.kitFrames : kind === "proportional" ? Math.abs(before) * BALANCE_SPEC.kitFraction : 0;
    if (Math.abs(after - before) > limit + 1e-8 || (kind === "frames" && !Number.isInteger(after)) || (/startupFrames$/.test(path) && after !== before && after < 1)) failures.push(`kit ${path} ${after} outside baseline ${before} ±${limit}`);
  }
  return failures;
}

export function feelFailures(current: FeelValues, baseline: FeelValues): string[] {
  const failures: string[] = [];
  for (const move of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    const before = baseline[move], after = current[move];
    if (before === undefined || after === undefined || !Number.isFinite(after.advantage)) { failures.push(`feel ${move} missing`); continue; }
    if (Math.sign(before.advantage) !== Math.sign(after.advantage)) failures.push(`feel ${move} block advantage ${before.advantage} → ${after.advantage}`);
    if (before.killPercent !== undefined && (after.killPercent === undefined || !Number.isFinite(after.killPercent) || Math.abs(after.killPercent - before.killPercent) > before.killPercent * BALANCE_SPEC.killFraction + 1e-8)) failures.push(`feel ${move} kill percent ${before.killPercent} → ${after.killPercent ?? "none"}`);
    if (before.killPercent === undefined && after.killPercent !== undefined) failures.push(`feel ${move} gains a kill below the baseline's 300% ceiling`);
  }
  return failures;
}

const pair = (a: string, b: string) => [a, b].sort().join(":");
export function completeFieldFailures(field: TuningField, roster: readonly string[]): string[] {
  const failures: string[] = [];
  if (field.seeds.length === 0 || new Set(field.seeds).size !== field.seeds.length) failures.push("field seeds empty or repeated");
  if (field.fighters.length !== roster.length || new Set(field.fighters.map(row => row.fighter)).size !== roster.length || roster.some(name => !field.fighters.some(row => row.fighter === name))) failures.push("whole roster not measured");
  const finite = (row: Measured) => [row.winRate,row.topDamageShare,row.airShare,row.approachShare,row.rangedShare,row.variety,...Object.values(row.aerials),...Object.values(row.specials),...(row.spamWinRate === undefined ? [] : [row.spamWinRate])].every(value => Number.isFinite(value) && value >= 0 && value <= 1);
  for (const row of field.fighters) {
    const counted = Object.values(row.matchups ?? {}).reduce((sum, matchup) => sum + matchup.matches, 0);
    if (row.decisiveMatches !== undefined && (!Number.isInteger(row.decisiveMatches) || row.decisiveMatches < 0 || row.decisiveMatches > counted)) failures.push(`${row.fighter} decisive count exceeds measured matches`);
  }
  if (!field.fighters.every(finite)) failures.push("field has nonfinite or impossible measures");
  for (const seed of field.seeds) {
    const sample = field.samples[seed];
    if (sample === undefined || !sample.every(finite) || sample.length !== roster.length || new Set(sample.map(row => row.fighter)).size !== roster.length || roster.some(name => !sample.some(row => row.fighter === name))) failures.push(`seed ${seed} lacks complete-field scores`);
  }
  for (const [index, left] of roster.entries()) for (const right of roster.slice(index + 1)) {
    const key = pair(left, right);
    let matches = 0;
    for (const seed of field.seeds) { const count = field.seedPairs[seed]?.[key] ?? 0; if (!Number.isInteger(count) || count < 1) failures.push(`seed ${seed} missing pair ${key}`); matches += count; }
    if (matches < BALANCE_SPEC.matchupMatches) failures.push(`whole field ${key} only ${matches}/${BALANCE_SPEC.matchupMatches}`);
  }
  return failures;
}

/** Profile calibration precedes kit tuning and never optimizes win rate. */
export function freezePlay(field: TuningField, profiles: ReadonlyMap<string, PlayStyleProfile>, roster: readonly string[]): FrozenPlay {
  const failures = completeFieldFailures(field, roster);
  for (const fighter of field.fighters) {
    const profile = profiles.get(fighter.fighter);
    if (profile === undefined) failures.push(`${fighter.fighter} profile missing`);
    else failures.push(...balanceScore(fighter, profile).misses.map(miss => `${fighter.fighter} ${miss}`));
  }
  if (failures.length) throw new Error(`Gameplan phase incomplete: ${failures.join("; ")}`);
  return { phase: "kit", computerCode: field.computerCode, computerProfiles: field.computerProfiles, play: Object.fromEntries(roster.map(name => [name, field.kits[name]?.play ?? "missing"])) };
}

/** The same five rules guard recorded fields and candidate acceptance. */
export function tuningVerdict(field: TuningField, baseline: Baseline, frozen: FrozenPlay, profiles: ReadonlyMap<string, PlayStyleProfile>, usedSeeds: ReadonlySet<number>, confirmation = false): string[] {
  const roster = Object.keys(baseline);
  const failures = completeFieldFailures(field, roster);
  if (frozen.phase !== "kit" || field.computerCode !== frozen.computerCode || field.computerProfiles !== frozen.computerProfiles) failures.push("computer behavior changed after freeze");
  if (confirmation && field.seeds.some(seed => usedSeeds.has(seed))) failures.push("confirmation reused optimizer seeds");
  for (const name of roster) {
    const current = field.kits[name], before = baseline[name];
    if (current === undefined || before === undefined) { failures.push(`${name} kit missing`); continue; }
    if (current.play !== frozen.play[name]) failures.push(`${name} computer play changed after freeze`);
    failures.push(...kitFailures(current.values, before.values).map(f => `${name} ${f}`), ...feelFailures(current.feel, before.feel).map(f => `${name} ${f}`));
    const measured = field.fighters.find(fighter => fighter.fighter === name);
    const profile = profiles.get(name);
    if (measured === undefined || profile === undefined) { failures.push(`${name} profile or measurement missing`); continue; }
    if (measured.matchups === undefined || Object.keys(measured.matchups).length !== roster.length - 1 || roster.some(other => other !== name && measured.matchups?.[other] === undefined)) failures.push(`${name} matchups incomplete`);
    else failures.push(...matchupFailures(measured.matchups).map(f => `${name} ${f}`));
    failures.push(...archetypeFailures(measured, profile).map(f => `${name} ${f}`));
  }
  return failures;
}

function changeSize(values: KitValues, baseline: KitValues): [number, number] {
  let count = 0, distance = 0;
  for (const [path, value] of Object.entries(values)) {
    const start = baseline[path];
    if (start === undefined || value === start) continue;
    count++;
    const scale = parameterKind(path) === "frames" ? BALANCE_SPEC.kitFrames : Math.abs(start) * BALANCE_SPEC.kitFraction;
    distance += Math.abs(value - start) / scale;
  }
  return [count, distance];
}

export interface KeptChange {
  readonly fighter: string; readonly seeds: readonly number[];
  readonly beforeScore: number; readonly afterScore: number; readonly improvement: number; readonly interval95: number;
  readonly before: KitValues; readonly after: KitValues;
}
export interface Candidate { readonly field: TuningField; readonly before: TuningField }
/** A paired 95% interval on complete-field score samples, not a caller-supplied claim. */
export function acceptCandidate(fighter: string, candidates: readonly Candidate[], baseline: Baseline, frozen: FrozenPlay, profiles: ReadonlyMap<string, PlayStyleProfile>, usedSeeds: ReadonlySet<number>): KeptChange | undefined {
  const reference = baseline[fighter];
  if (reference === undefined) return undefined;
  const accepted: { record: KeptChange; size: [number, number]; targetDistance: number }[] = [];
  for (const { field, before } of candidates) {
    if (tuningVerdict(field, baseline, frozen, profiles, usedSeeds, true).length || tuningVerdict(before, baseline, frozen, profiles, usedSeeds, true).length) continue;
    if (JSON.stringify(field.seeds) !== JSON.stringify(before.seeds)) continue;
    const profile = profiles.get(fighter);
    if (profile === undefined) continue;
    const scores = (run: TuningField): number[] => run.seeds.map(seed => {
      const measured = run.samples[seed]?.find(row => row.fighter === fighter);
      return measured === undefined ? Number.NaN : optimizerScore(measured, profile);
    });
    const prior = scores(before), after = scores(field);
    if (prior === undefined || after === undefined || prior.length < 2 || prior.length !== after.length || prior.length !== field.seeds.length || [...prior, ...after].some(value => !Number.isFinite(value))) continue;
    const improvements = prior.map((value, index) => value - (after[index] ?? Number.NaN));
    const mean = improvements.reduce((a, b) => a + b, 0) / improvements.length;
    const variance = improvements.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (improvements.length - 1);
    const interval = scoreIntervalCritical(improvements.length) * Math.sqrt(variance / improvements.length);
    if (!(mean > interval)) continue;
    const oldKit = before.kits[fighter], newKit = field.kits[fighter];
    if (oldKit === undefined || newKit === undefined || Object.keys(baseline).some(name => name !== fighter && JSON.stringify(before.kits[name]) !== JSON.stringify(field.kits[name]))) continue;
    const measured = field.fighters.find(row => row.fighter === fighter);
    if (measured === undefined) continue;
    const size = changeSize(newKit.values, reference.values);
    accepted.push({ size, targetDistance: Math.abs(measured.winRate - BALANCE_SPEC.winTarget), record: { fighter, seeds: field.seeds, beforeScore: prior.reduce((a,b) => a+b,0)/prior.length, afterScore: after.reduce((a,b) => a+b,0)/after.length, improvement: mean, interval95: interval, before: oldKit.values, after: newKit.values } });
  }
  accepted.sort((a, b) => a.targetDistance - b.targetDistance || a.size[0] - b.size[0] || a.size[1] - b.size[1]);
  return accepted[0]?.record;
}

/** Finite-difference coordinate descent offers only one real kit scalar at a time. */
export function kitCandidates(current: KitValues, baseline: KitValues): KitValues[] {
  const candidates: KitValues[] = [];
  for (const [path, value] of Object.entries(current)) {
    const kind = parameterKind(path);
    if (kind === "fixed") continue;
    const step = kind === "frames" ? BALANCE_SPEC.gradientFrames : Math.abs(baseline[path] ?? 0) * BALANCE_SPEC.gradientFraction;
    if (step === 0) continue;
    for (const direction of [-1, 1]) {
      const proposed = value + direction * step;
      const candidate = { ...current, [path]: kind === "frames" ? proposed : Math.fround(proposed) };
      if (kitFailures(candidate, baseline).length === 0) candidates.push(candidate);
    }
  }
  return candidates;
}

export class BalanceFailure extends Schema.TaggedError<BalanceFailure>()("BalanceFailure", { problem: Schema.String }) {}

export interface RoundResult { readonly kept?: KeptChange; readonly trainingFields: number; readonly record: string }
/** Callers supply the real whole-field runner; no rate can be extrapolated from a subset. */
export function optimizeRound(options: {
  readonly fighter: string; readonly current: TuningField; readonly baseline: Baseline;
  readonly frozen: FrozenPlay; readonly profiles: ReadonlyMap<string, PlayStyleProfile>;
  readonly usedSeeds: Set<number>; readonly heldOutSeeds: readonly number[]; readonly confirmationSeeds: readonly number[];
  readonly evaluate: (values: KitValues, seeds: readonly number[]) => Promise<TuningField>;
  readonly record: (change: KeptChange, row: string) => Effect.Effect<void, Error>;
}): Effect.Effect<RoundResult, BalanceFailure> {
  return Effect.gen(function*() {
  const { fighter, current, baseline, frozen, profiles, usedSeeds } = options;
  const evaluate = (values: KitValues, seeds: readonly number[]) => Effect.tryPromise({ try: () => options.evaluate(values, seeds), catch: cause => new BalanceFailure({ problem: String(cause) }) });
  const roster = Object.keys(baseline);
  const start = current.kits[fighter];
  const reference = baseline[fighter];
  const profile = profiles.get(fighter);
  if (start === undefined || profile === undefined || reference === undefined) return yield* Effect.fail(new BalanceFailure({ problem: `${fighter} kit/profile missing` }));
  if (completeFieldFailures(current, roster).length) return yield* Effect.fail(new BalanceFailure({ problem: "Optimizer requires a complete current field" }));
  if (options.heldOutSeeds.length < 2 || options.confirmationSeeds.length < 2) return yield* Effect.fail(new BalanceFailure({ problem: "Held-out and confirmation runs need independent score samples" }));
  const measured = current.fighters.find(row => row.fighter === fighter);
  if (measured === undefined) return yield* Effect.fail(new BalanceFailure({ problem: `${fighter} not measured` }));
  if (withinWinTarget(measured) && tuningVerdict(current, baseline, frozen, profiles, usedSeeds).length === 0) return { trainingFields: 0, record: `${fighter}: no change; the 95% win-rate interval includes ${100 * BALANCE_SPEC.winTarget}%.` };
  const fresh = [...options.heldOutSeeds, ...options.confirmationSeeds];
  if (fresh.length === 0 || new Set(fresh).size !== fresh.length || fresh.some(seed => usedSeeds.has(seed) || current.seeds.includes(seed))) return yield* Effect.fail(new BalanceFailure({ problem: "Held-out and confirmation seeds must be unused and disjoint" }));
  current.seeds.forEach(seed => usedSeeds.add(seed));
  const average = (field: TuningField) => {
    const row = field.fighters.find(row => row.fighter === fighter);
    return row === undefined ? Number.POSITIVE_INFINITY : optimizerScore(row, profile);
  };
  const descent: KitValues[] = [];
  let trainingFields = 0;
  for (const values of kitCandidates(start.values, reference.values)) {
    const field = yield* evaluate(values, current.seeds);
    trainingFields++;
    const changed = Object.entries(values).filter(([path,value]) => value !== start.values[path]);
    if (tuningVerdict(field, baseline, frozen, profiles, usedSeeds).length || changed.some(([path,value]) => field.kits[fighter]?.values[path] !== value)) continue;
    if (average(field) < average(current)) descent.push(values);
  }
  const before = yield* evaluate(start.values, options.heldOutSeeds);
  const candidates: Candidate[] = [];
  for (const values of descent) candidates.push({ before, field: yield* evaluate(values, options.heldOutSeeds) });
  const kept = acceptCandidate(fighter, candidates, baseline, frozen, profiles, usedSeeds);
  options.heldOutSeeds.forEach(seed => usedSeeds.add(seed));
  if (kept === undefined) return { trainingFields, record: "No change kept: held-out improvement did not exceed the 95% interval." };
  const confirmationBefore = yield* evaluate(start.values, options.confirmationSeeds);
  const confirmationAfter = yield* evaluate(kept.after, options.confirmationSeeds);
  const confirmed = acceptCandidate(fighter, [{ before: confirmationBefore, field: confirmationAfter }], baseline, frozen, profiles, usedSeeds);
  options.confirmationSeeds.forEach(seed => usedSeeds.add(seed));
  if (confirmed === undefined) return { trainingFields, record: "No change kept: unused-seed confirmation failed." };
  const changed = Object.entries(kept.after).filter(([path, value]) => start.values[path] !== value).map(([path,value]) => `${path}: ${start.values[path]} → ${value}`).join("; ");
  const record = `| ${fighter} | ${changed} | held-out seeds ${kept.seeds.join(",")}: ${kept.beforeScore.toFixed(3)} → ${kept.afterScore.toFixed(3)} (improvement ${kept.improvement.toFixed(3)}, 95% ±${kept.interval95.toFixed(3)}) | confirmation seeds ${confirmed.seeds.join(",")}: ${confirmed.beforeScore.toFixed(3)} → ${confirmed.afterScore.toFixed(3)} (95% ±${confirmed.interval95.toFixed(3)}) |`;
  yield* options.record(confirmed, record).pipe(Effect.mapError(cause => new BalanceFailure({ problem: String(cause) })));
  return { trainingFields, kept: confirmed, record };
  });
}
