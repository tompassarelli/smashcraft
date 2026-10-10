
import { BALANCE_SPEC } from "./balance";
import { parameterKind, type KitSnapshot, type KitValues, type FeelValues } from "./balanceKit";

interface FighterBaseline extends KitSnapshot { readonly feel: FeelValues }
export type Baseline = Readonly<Record<string, FighterBaseline>>;

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
