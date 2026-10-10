


import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";





export const BALANCE_SPEC = {
  winLow: 0.45,
  winHigh: 0.55,
  winTarget: 0.50,
  matchupLow: 0.30,
  matchupHigh: 0.70,
  matchupMatches: 400,
  kitFraction: 0.25,
  kitFrames: 3,
  killFraction: 0.15,
  confidenceZ: 1.96,
  gradientFraction: 0.01,
  gradientFrames: 1,
  feelMaxPercent: 300,
  feelFlightFrames: 360,

  spamMax: 0.45,

  topMoveMax: 0.40,

  varietyFloor: 0.55,





  slippiOpeningsLow: 3,
  slippiOpeningsHigh: 4,
  openingsLow: 2,
  openingsHigh: 3,

  oneHitWarn: 0.5,
} as const;


export const PUNISH_RESET_FRAMES = 45;

export const DISADVANTAGE_FRAMES = 30;


export const CEILING_SPEC = {
  panelLow: 0.45, panelHigh: 0.55, personalityLow: 0.40, personalityHigh: 0.60,
  bestFitMin: 1, bestFitMaxShare: 0.5, depthMargin: 0.05,
  axisMajority: 0.6, mixedGainMin: 0, ceilingLow: 0.45, ceilingHigh: 0.55,
  headroomTolerance: 0.10, wrenPerPair: 400, panelPerPair: 100, finalPerPair: 25, depthMatches: 100,
} as const;


const SCORE_WEIGHTS = { win: 1, profile: 0.5, variety: 1, spam: 1, probe: 1, openings: 10, recovery: 1 } as const;

interface Range { readonly low: number; readonly high: number }


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


function parseProfile(block: string, doc: string): PlayStyleProfile {
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


export interface Measured {
  readonly fighter: string;
  readonly winRate: number;
  readonly decisiveMatches?: number;
  readonly topMove?: string;
  readonly topDamageShare: number;
  readonly aerials: Readonly<Record<string, number>>;
  readonly airShare: number;
  readonly approachShare: number;
  readonly rangedShare: number;
  readonly specials: Readonly<Record<string, number>>;
  readonly variety: number;

  readonly spamWinRate?: number;

  readonly potentialOpeningsPerKill?: number;

  readonly recoveryDistance?: number;
  readonly matchups?: Readonly<Record<string, { readonly rate: number; readonly matches: number }>>;
}

const outside = (value: number, band: Range): number => (Number.isNaN(value) ? 0 : value < band.low ? band.low - value : value > band.high ? value - band.high : 0);


function topMoveLimit(profile: PlayStyleProfile | undefined, topMove: string | undefined): number {
  if (profile?.signature !== undefined && profile.signature.move === topMove) return profile.signature.max;
  return profile?.topMoveMax ?? BALANCE_SPEC.topMoveMax;
}

interface ScoreTerms {
  readonly win: number;
  readonly profile: number;
  readonly variety: number;
  readonly spam: number;
  readonly probe: number | undefined;
  readonly openings: number | undefined;
  readonly recovery: number | undefined;

  readonly total: number;

  readonly misses: readonly string[];
}

const pct = (value: number) => `${(100 * value).toFixed(0)}%`;


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

interface GateResult {
  readonly fighter: string;

  readonly balanced: boolean;
  readonly failures: readonly string[];

  readonly measured: boolean;
}






export function balanceGate(measured: Measured, profile: PlayStyleProfile | undefined): GateResult {
  const failures: string[] = [];
  if (!(measured.winRate >= BALANCE_SPEC.winLow && measured.winRate <= BALANCE_SPEC.winHigh)) failures.push(`win rate ${pct(measured.winRate)}`);
  if (measured.spamWinRate !== undefined && measured.spamWinRate > BALANCE_SPEC.spamMax) failures.push(`${measured.topMove ?? "top move"} spam wins ${pct(measured.spamWinRate)}`);
  const limit = topMoveLimit(profile, measured.topMove);
  if (measured.topDamageShare > limit) failures.push(`${measured.topMove ?? "top move"} deals ${pct(measured.topDamageShare)} of damage (limit ${pct(limit)})`);
  if (measured.matchups !== undefined) failures.push(...matchupFailures(measured.matchups));
  if (profile !== undefined) failures.push(...archetypeFailures(measured, profile));
  return { fighter: measured.fighter, balanced: failures.length === 0 && measured.spamWinRate !== undefined, failures, measured: measured.spamWinRate !== undefined };
}



const ARCHETYPE_TRAITS: Readonly<Record<string, readonly string[]>> = {
  rushdown: ["approach"], zoner: ["ranged"], "bait-and-punish": ["approach"],
  heavy: ["air"], grappler: ["approach"], setplay: ["ranged"], "all-rounder": ["approach", "ranged"],
  skirmisher: ["approach", "air"], trapper: ["ranged", "special:down-special"],
  "mobility trickster": ["air", "special:side-special"],
};

export function archetypeFailures(measured: Measured, profile: PlayStyleProfile): string[] {
  const traits = ARCHETYPE_TRAITS[profile.archetype];
  if (traits === undefined) return [`archetype ${profile.archetype} has no defining traits`];
  return traits.flatMap(trait => {
    const band = trait === "approach" ? profile.approach : trait === "ranged" ? profile.ranged : trait === "air" ? profile.airShare : profile.specials[trait.slice(8)];
    const value = trait === "approach" ? measured.approachShare : trait === "ranged" ? measured.rangedShare : trait === "air" ? measured.airShare : measured.specials[trait.slice(8)];
    if (band === undefined || value === undefined || !Number.isFinite(value)) return [`archetype ${trait} not measured`];
    return outside(value, band) > 0 ? [`archetype ${trait} ${pct(value)} (${pct(band.low)}-${pct(band.high)})`] : [];
  });
}

export function matchupFailures(matchups: NonNullable<Measured["matchups"]>): string[] {
  return Object.entries(matchups).flatMap(([opponent, { rate, matches }]) =>
    matches < BALANCE_SPEC.matchupMatches ? [`matchup ${opponent} only ${matches}/${BALANCE_SPEC.matchupMatches} matches`]
      : !Number.isFinite(rate) || outside(rate, { low: BALANCE_SPEC.matchupLow, high: BALANCE_SPEC.matchupHigh }) > 0 ? [`matchup ${opponent} ${pct(rate)} (${pct(BALANCE_SPEC.matchupLow)}-${pct(BALANCE_SPEC.matchupHigh)})`] : []);
}





