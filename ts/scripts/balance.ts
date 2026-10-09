// Tom's balance spec as numbers (smashcraft:docs/design/balance.md): the
// gate, the per-fighter play-style profiles read from the design docs, and the
// balance score an optimizer minimizes. Pure functions; cpuField prints them.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The spec's numbers, initial values Tom tunes (balance.md, "Thresholds").
 * Shares are fractions; balance.test.ts checks the doc states each.
 */
export const BALANCE_SPEC = {
  winLow: 0.45,
  winHigh: 0.55,
  /** The spam probe may win at most this against the Expert field. */
  spamMax: 0.45,
  /** No move may deal more than this share of a fighter's damage, unless its profile names it the signature move. */
  topMoveMax: 0.40,
  /** Default move-variety floor (normalized entropy of moves started). */
  varietyFloor: 0.55,
  /**
   * Openings per kill (Tom, 8 Oct), about 1.5-2x as explosive as master-level
   * Melee (balance.md, "Openings and punishes"): Slippi's count 3-4, the
   * combo-potential target; pokes excluded 2-3.
   */
  slippiOpeningsLow: 3,
  slippiOpeningsHigh: 4,
  openingsLow: 2,
  openingsHigh: 3,
  /** A one-hit share of punishes above this is flagged. */
  oneHitWarn: 0.5,
} as const;

/** A punish ends once its victim has been actionable this many frames: Slippi's PUNISH_RESET_FRAMES. */
export const PUNISH_RESET_FRAMES = 45;
/** A lone hit is an opening, not a poke, when it leaves the victim unable to act this many frames. */
export const DISADVANTAGE_FRAMES = 30;

/** Draft depth/headroom margins; #358 fixes the win bands and sample counts. */
export const CEILING_SPEC = {
  panelLow: 0.45, panelHigh: 0.55, personalityLow: 0.40, personalityHigh: 0.60,
  bestFitMin: 1, bestFitMaxShare: 0.5, depthMargin: 0.05,
  axisMajority: 0.6, mixedGainMin: 0, ceilingLow: 0.45, ceilingHigh: 0.55,
  headroomTolerance: 0.10, wrenPerPair: 400, panelPerPair: 100, finalPerPair: 25, depthMatches: 100,
} as const;

/** Each score term's weight, initial values (balance.md, "Balance score"). */
export const SCORE_WEIGHTS = { win: 1, profile: 0.5, variety: 1, spam: 1, probe: 1, openings: 10, recovery: 1 } as const;

export interface Range { readonly low: number; readonly high: number }

/** One fighter's play-style profile, from a ```balance-profile block in its design doc. Shares are fractions. */
export interface PlayStyleProfile {
  readonly fighter: string;
  readonly archetype: string;
  readonly doc: string;
  readonly aerials: Readonly<Record<string, Range>>;
  readonly airShare?: Range;
  readonly approach?: Range;
  readonly ranged?: Range;
  readonly specials: Readonly<Record<string, Range>>;
  readonly varietyFloor: number;
  readonly topMoveMax: number;
  /** The signature move, which may carry up to its own share of the damage. */
  readonly signature?: { readonly move: string; readonly max: number };
  readonly openings: Range;
}

const AERIAL_NAMES: Readonly<Record<string, string>> = { nair: "neutral-air", fair: "forward-air", bair: "back-air", uair: "up-air", dair: "down-air" };
const SPECIAL_NAMES: Readonly<Record<string, string>> = { neutral: "neutral-special", side: "side-special", up: "up-special", down: "down-special" };

function range(text: string, scale: number, where: string): Range {
  const match = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(text.trim());
  if (match === null) throw new Error(`${where}: ${text} is not a LOW-HIGH range`);
  return { low: Number(match[1]) / scale, high: Number(match[2]) / scale };
}

/** "nair 10-35, fair 20-50" as named ranges, percent to fractions. */
function namedRanges(text: string, names: Readonly<Record<string, string>>, where: string): Record<string, Range> {
  const out: Record<string, Range> = {};
  for (const part of text.split(",")) {
    const [key, value, extra] = part.trim().split(/\s+/);
    const name = key === undefined ? undefined : names[key];
    if (name === undefined || value === undefined || extra !== undefined) throw new Error(`${where}: ${part.trim()} names no ${Object.keys(names).join("/")} range`);
    out[name] = range(value, 100, where);
  }
  return out;
}

/** Parses one ```balance-profile block's `key: value` lines. */
export function parseProfile(block: string, doc: string): PlayStyleProfile {
  const fields = new Map<string, string>();
  for (const line of block.split("\n")) {
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon < 0) throw new Error(`${doc}: profile line "${line}" has no key`);
    fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }
  const fighter = fields.get("fighter");
  if (fighter === undefined) throw new Error(`${doc}: a balance-profile names no fighter`);
  const where = `${doc} (${fighter})`;
  const optional = (key: string) => {
    const value = fields.get(key);
    return value === undefined ? undefined : range(value, 100, where);
  };
  const signature = fields.get("signature")?.split(/\s+/);
  const known = new Set(["fighter", "archetype", "aerials", "air-share", "approach", "ranged", "specials", "variety-floor", "top-move-ceiling", "signature", "openings-per-kill"]);
  for (const key of fields.keys()) if (!known.has(key)) throw new Error(`${where}: unknown profile key ${key}`);
  const airShare = optional("air-share"), approach = optional("approach"), ranged = optional("ranged");
  return {
    fighter, doc,
    archetype: fields.get("archetype") ?? "all-rounder",
    aerials: fields.has("aerials") ? namedRanges(fields.get("aerials") ?? "", AERIAL_NAMES, where) : {},
    ...(airShare === undefined ? {} : { airShare }),
    ...(approach === undefined ? {} : { approach }),
    ...(ranged === undefined ? {} : { ranged }),
    specials: fields.has("specials") ? namedRanges(fields.get("specials") ?? "", SPECIAL_NAMES, where) : {},
    varietyFloor: Number(fields.get("variety-floor") ?? BALANCE_SPEC.varietyFloor),
    topMoveMax: Number(fields.get("top-move-ceiling") ?? 100 * BALANCE_SPEC.topMoveMax) / 100,
    ...(signature === undefined ? {} : { signature: { move: signature[0] ?? "", max: Number(signature[1] ?? 100 * BALANCE_SPEC.topMoveMax) / 100 } }),
    openings: fields.has("openings-per-kill") ? range(fields.get("openings-per-kill") ?? "", 1, where) : { low: BALANCE_SPEC.slippiOpeningsLow, high: BALANCE_SPEC.slippiOpeningsHigh },
  };
}

function markdownFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? markdownFiles(path) : name.endsWith(".md") ? [path] : [];
  });
}

export const DESIGN_DOCS = join(import.meta.dir, "../../docs/design");

/** Every fighter's profile, from the ```balance-profile blocks under docs/design/. */
export function readProfiles(folder = DESIGN_DOCS): Map<string, PlayStyleProfile> {
  const profiles = new Map<string, PlayStyleProfile>();
  for (const path of markdownFiles(folder).sort()) {
    const text = readFileSync(path, "utf8");
    const doc = path.slice(path.indexOf("docs/"));
    for (const match of text.matchAll(/```balance-profile\n([\s\S]*?)```/g)) {
      const profile = parseProfile(match[1] ?? "", doc);
      if (profiles.has(profile.fighter)) throw new Error(`${profile.fighter} has two balance profiles (${profiles.get(profile.fighter)?.doc}, ${doc})`);
      profiles.set(profile.fighter, profile);
    }
  }
  return profiles;
}

/** What the score and the gate read from a fighter's field summary. */
export interface Measured {
  readonly fighter: string;
  readonly winRate: number;
  readonly topMove?: string;
  readonly topDamageShare: number;
  readonly aerials: Readonly<Record<string, number>>;
  readonly airShare: number;
  readonly approachShare: number;
  readonly rangedShare: number;
  readonly specials: Readonly<Record<string, number>>;
  readonly variety: number;
  /** The spam probe's win rate against the Expert field, once measured. */
  readonly spamWinRate?: number;
  /** Openings per kill (Slippi's count) from the combo search, once measured; the realized rate is reported, not scored. */
  readonly potentialOpeningsPerKill?: number;
  /** Distance outside the roster's recovery band, once measured (0 inside). */
  readonly recoveryDistance?: number;
}

const outside = (value: number, band: Range): number => (Number.isNaN(value) ? 0 : value < band.low ? band.low - value : value > band.high ? value - band.high : 0);

/** The move share a fighter's top move may reach: its signature allowance, or the profile's (or spec's) ceiling. */
export function topMoveLimit(profile: PlayStyleProfile | undefined, topMove: string | undefined): number {
  if (profile?.signature !== undefined && profile.signature.move === topMove) return profile.signature.max;
  return profile?.topMoveMax ?? BALANCE_SPEC.topMoveMax;
}

export interface ScoreTerms {
  readonly win: number;
  readonly profile: number;
  readonly variety: number;
  readonly spam: number;
  readonly probe: number | undefined;
  readonly openings: number | undefined;
  readonly recovery: number | undefined;
  /** The weighted sum of the measured terms, in percentage points; 0 meets every target. */
  readonly total: number;
  /** Profile ranges missed, as "name value (low-high)". */
  readonly misses: readonly string[];
}

const pct = (value: number) => `${(100 * value).toFixed(0)}%`;

/** A fighter's balance score (balance.md, "Balance score"); terms are percentage points outside their targets, openings in openings. */
export function balanceScore(measured: Measured, profile: PlayStyleProfile | undefined): ScoreTerms {
  const misses: string[] = [];
  let profileDistance = 0;
  const check = (name: string, value: number, band: Range | undefined) => {
    if (band === undefined) return;
    const distance = outside(value, band);
    if (distance > 0) misses.push(`${name} ${pct(value)} (${pct(band.low)}-${pct(band.high)})`);
    profileDistance += distance;
  };
  if (profile !== undefined) {
    for (const [name, band] of Object.entries(profile.aerials)) check(name, measured.aerials[name] ?? 0, band);
    check("air", measured.airShare, profile.airShare);
    check("approach", measured.approachShare, profile.approach);
    check("ranged", measured.rangedShare, profile.ranged);
    for (const [name, band] of Object.entries(profile.specials)) check(name, measured.specials[name] ?? 0, band);
  }
  const terms = {
    win: 100 * outside(measured.winRate, { low: BALANCE_SPEC.winLow, high: BALANCE_SPEC.winHigh }),
    profile: 100 * profileDistance,
    variety: 100 * Math.max(0, (profile?.varietyFloor ?? BALANCE_SPEC.varietyFloor) - measured.variety),
    spam: 100 * Math.max(0, measured.topDamageShare - topMoveLimit(profile, measured.topMove)),
    probe: measured.spamWinRate === undefined ? undefined : 100 * Math.max(0, measured.spamWinRate - BALANCE_SPEC.spamMax),
    openings: measured.potentialOpeningsPerKill === undefined ? undefined
      : outside(measured.potentialOpeningsPerKill, profile?.openings ?? { low: BALANCE_SPEC.slippiOpeningsLow, high: BALANCE_SPEC.slippiOpeningsHigh }),
    recovery: measured.recoveryDistance,
  };
  const w = SCORE_WEIGHTS;
  const total = w.win * terms.win + w.profile * terms.profile + w.variety * terms.variety + w.spam * terms.spam
    + w.probe * (terms.probe ?? 0) + w.openings * (terms.openings ?? 0) + w.recovery * (terms.recovery ?? 0);
  return { ...terms, total, misses };
}

export interface GateResult {
  readonly fighter: string;
  /** "balanced", or the rules it fails. */
  readonly balanced: boolean;
  readonly failures: readonly string[];
  /** False until the spam probe has measured it. */
  readonly measured: boolean;
}

/**
 * Tom's gate (8 Oct; balance.md, "Gate"): balanced only with a win rate in
 * 45-55%, a spam probe winning at most 45% against Expert, and no move over
 * 40% of its damage except the signature move its profile names.
 */
export function balanceGate(measured: Measured, profile: PlayStyleProfile | undefined): GateResult {
  const failures: string[] = [];
  if (!(measured.winRate >= BALANCE_SPEC.winLow && measured.winRate <= BALANCE_SPEC.winHigh)) failures.push(`win rate ${pct(measured.winRate)}`);
  if (measured.spamWinRate !== undefined && measured.spamWinRate > BALANCE_SPEC.spamMax) failures.push(`${measured.topMove ?? "top move"} spam wins ${pct(measured.spamWinRate)}`);
  const limit = topMoveLimit(profile, measured.topMove);
  if (measured.topDamageShare > limit) failures.push(`${measured.topMove ?? "top move"} deals ${pct(measured.topDamageShare)} of damage (limit ${pct(limit)})`);
  return { fighter: measured.fighter, balanced: failures.length === 0 && measured.spamWinRate !== undefined, failures, measured: measured.spamWinRate !== undefined };
}
