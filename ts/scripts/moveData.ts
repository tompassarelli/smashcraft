// Offline move-data diagnostics. These fixtures call the same simulation
// functions as gameplay and never enter the map build.
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Predicate, Schema } from "effect";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { type Fighter, createFighter } from "../src/game/sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../src/game/sim/hitRegions";
import { attackCapsule, emptyCapsule, hurtCapsule } from "../src/game/physics/contactGeometry";
import { authoredTuning } from "../src/game/sim/tuning";
import { attackLandingLag, attackStartupFrames, attackDurationFramesForGrounding, characterAttackActiveFrames,
  isAerialAttack, isSmashAttack, SMASH_MAX_CHARGE_FRAMES, smashDamageMultiplier } from "../src/game/sim/moves";
import { ordinaryHitKnockback, ordinaryHitstunFrames, ordinaryHitlagFrames, victimHitlagFrames } from "../src/game/sim/knockback";
import { digitalShieldDamage, digitalShieldstunFrames, digitalShieldPushback, digitalShieldRecoil } from "../src/game/sim/shield";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { advanceFighterMotion } from "../src/game/sim/step";
import { beginFighterAttack } from "../src/game/sim/attacks";
import { canAttack } from "../src/game/sim/conditions";
import { exportComparisons } from "./moveComparisons";

const root = resolve(import.meta.dir, "../..");
const styleList = [0, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16] as const;
const charList = [ Character.rifleman, Character.demonHunter] as const;
const names: Record<number, string> = {
  0: "jab", 2: "up-smash", 3: "down-smash", 4: "forward-smash", 6: "forward-tilt", 7: "up-tilt",
  8: "down-tilt", 9: "forward-tilt-up", 10: "forward-tilt-down", 12: "neutral-air", 13: "forward-air",
  14: "back-air", 15: "up-air", 16: "down-air",
};
const json = (value: unknown): string => JSON.stringify(value);
const rows: string[] = [];
function firstDifference(expected: string, actual: string): string | undefined {
  const left: unknown = JSON.parse(expected);
  const right: unknown = JSON.parse(actual);
  const visit = (a: unknown, b: unknown, path: string): string | undefined => {
    if (typeof a === "number" && typeof b === "number") return Number(a.toFixed(12)) === Number(b.toFixed(12)) ? undefined : path;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return `${path}.length`;
      for (let index = 0; index < a.length; index++) {
        const difference = visit(a[index], b[index], `${path}[${index}]`);
        if (difference !== undefined) return difference;
      }
      return undefined;
    }
    if (Predicate.isObject(a) && Predicate.isObject(b)) {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (const key of keys) {
        if (!(key in a) || !(key in b)) return `${path}.${key}`;
        const difference = visit(a[key], b[key], `${path}.${key}`);
        if (difference !== undefined) return difference;
      }
      return undefined;
    }
    return a === b ? undefined : path;
  };
  return visit(left, right, "$");
}
const capsule = (style: AttackStyle, character: Character, frame: number, charge: number, regionIndex: number) => {
  const hit = authoredHitRegion(emptyHitRegion(), character, style, frame, charge, regionIndex, authoredTuning(character).moves);
  return attackCapsule(emptyCapsule(), style, hit);
};
export function observeLandingLag(character: Character, style: AttackStyle): number {
  if (!isAerialAttack(style)) return 0;
  const fighter = createFighter(character, 0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 1;
  fighter.motion.vz = -2;
  fighter.attack.style = style;
  fighter.attack.duration = attackDurationFramesForGrounding(style, false);
  fighter.attack.cooldown = fighter.attack.duration;
  const world = createRoster(1, [fighter]);
  advanceFighterMotion(world, 0, 0, 0, neutralControls(), 0);
  return fighter.landing.lag;
}

function emitMoves(): void {
    rows.push(json({ kind: "context", schema: 1, roster: ["Rifleman", "Illidan"], units: "simulation world units; frames are zero-based attack ticks, excluding charge/hitlag pauses", derivedContext: { preHitPercent: 0, victimWeight: 100, contextScale: 1, shieldStrength: 1, crouching: false, di: "none; launch vector is authored before DI", simultaneousContacts: false }, motionContext: { stage: 0, x: 0, groundStartZ: 0, aerialStartZ: 700, initialVelocity: [0, 0], facing: 1, input: "neutral", contacts: false, chargeFrames: 0 }, conditions: { selection: "lowest contacting region index wins; body capsule intersection or shield intersection", rehit: "one hit per attacker/attack serial/window; a higher window permits another hit", smashCharge: "grounded held attack pauses before first active frame; endpoints exported", start: "beginFighterAttack enforces grounding and canStartAttackStyle; motion fixture starts idle", landing: "aerial landing cancels attack; no autocancel window represented" }, unknown: ["reference corpus mapping", "reachable punishments", "DI/contact/spacing dependent matchup outcomes", "animation-specific hurtboxes", "autocancel windows"], maxChargeFrames: SMASH_MAX_CHARGE_FRAMES }));
  for (const character of charList) for (const style of styleList) {
    if (!names[style]) continue;
    // Each fighter's own kit, where it has one (the reference body's dash attack, Rifleman's ground normals).
    const moves = authoredTuning(character).moves;
    const charges = isSmashAttack(style) ? [0, SMASH_MAX_CHARGE_FRAMES] : [0];
    for (const charge of charges) {
      const startup = attackStartupFrames(style, moves);
      const active = characterAttackActiveFrames(character, style, moves);
      const total = attackDurationFramesForGrounding(style, !isAerialAttack(style), moves);
      const recovery = total - startup - active;
      const multiplier = isSmashAttack(style) ? smashDamageMultiplier(charge, moves) : 1;
      const hurt = hurtCapsule(character);
      const move = { kind: "move", character, move: names[style], style, chargeFrames: charge, startup, active, recovery, totalUnpaused: total,
        landingLag: attackLandingLag(style, moves), observedLandingLag: observeLandingLag(character, style),
        chargeDamageMultiplier: multiplier, hurtCapsule: hurt, autocancelWindows: null, animationHurtboxes: null };
      rows.push(json(move));
      for (let frame = 0; frame < total; frame++) for (let region = 0; region < authoredHitRegionCount(style, moves); region++) {
        const hit = authoredHitRegion(emptyHitRegion(), character, style, frame, charge, region, moves);
        if (hit.window <= 0) continue;
        const effect = hit.effect;
        const knockback = ordinaryHitKnockback(0, effect.damage, 100, effect.growth, effect.base, 1);
        const angle = Math.atan2(effect.launchZ, effect.launchX) * 180 / Math.PI;
        rows.push(json({ kind: "contact", character, move: names[style], style, chargeFrames: charge, frame, region, window: hit.window,
          damage: effect.damage, growth: effect.growth, baseKnockback: effect.base, launchX: effect.launchX, launchZ: effect.launchZ,
          angleDegrees: angle, electric: effect.electric, envelope: [hit.minX, hit.maxX, hit.minZ, hit.maxZ], hitCapsule: capsule(style, character, frame, charge, region),
          derived: { knockback, hitstun: ordinaryHitstunFrames(knockback), attackerHitlag: ordinaryHitlagFrames(effect.damage),
            victimHitlag: victimHitlagFrames(effect.damage, effect.electric, false), digitalShieldDamage: digitalShieldDamage(effect.damage),
            digitalShieldstun: digitalShieldstunFrames(effect.damage, isAerialAttack(style)), digitalShieldPushback: digitalShieldPushback(effect.damage), digitalShieldRecoil: digitalShieldRecoil(effect.damage) } }));
      }
    }
    const startup = attackStartupFrames(style, moves);
    const active = characterAttackActiveFrames(character, style, moves);
    const total = attackDurationFramesForGrounding(style, !isAerialAttack(style), moves);
    const fighter = createFighter(character, 0, 1);
    const world = createRoster(1, [fighter]);
    fighter.motion.grounded = !isAerialAttack(style);
    fighter.motion.surface = fighter.motion.grounded ? 0 : undefined;
    fighter.motion.z = fighter.motion.grounded ? 0 : 700;
    const startZ = fighter.motion.z;
    beginFighterAttack(world, 0, style, false);
    for (let elapsed = 0; elapsed <= total; elapsed++) {
      rows.push(json({ kind: "motion", character, move: names[style], style, chargeFrames: 0, elapsed, attackFrame: fighter.attack.frame,
        attackStyle: fighter.attack.style ?? -1, phase: fighter.attack.style === undefined ? 0 : fighter.attack.frame < startup ? 1 : fighter.attack.frame < startup + active ? 2 : 3,
        x: fighter.motion.x, zDisplacement: fighter.motion.z - startZ, vx: fighter.motion.vx, vz: fighter.motion.vz,
        grounded: fighter.motion.grounded, canAttack: canAttack(fighter) }));
      if (elapsed < total) advanceFighterMotion(world, 0, 0, 0, neutralControls(), 0);
    }
  }
}

const readJsonl = async <S extends Schema.Top>(path: string, schema: S): Promise<S["Type"][]> =>
  (await Bun.file(path).text()).trim().split("\n").map((line) => {
    const value: unknown = JSON.parse(line);
    // Validate without rebuilding the object: declared facts retain every field and its original order.
    Schema.asserts(schema, value);
    return value;
  });
const ACTION_FAMILIES: Readonly<Record<number, string>> = { 0: "jab1", 2: "usmash", 3: "dsmash", 4: "fsmash", 6: "ftilt", 7: "utilt", 8: "dtilt", 9: "ftilt", 10: "ftilt", 12: "nair", 13: "fair", 14: "bair", 15: "uair", 16: "dair" };
export const actionFamily = (style: number): string => ACTION_FAMILIES[style] ?? "";
export function referenceJoinScope(style: number, charge: number): string {
  if (charge > 0) return "family-only-charge-unknown";
  if (style === 9 || style === 10) return "family-only-angle-unknown";
  return "same-action-family";
}
export function firstActiveDelta(startup: number, referenceStart: number): number {
  return startup + 1 - referenceStart;
}
const TradeoffFact = Schema.Struct({
  category: Schema.String, spacing: Schema.Finite, percent: Schema.Finite, shielding: Schema.Boolean, character: Schema.Finite,
  connected: Schema.Boolean, attackerReady: Schema.Finite, defenderReady: Schema.Finite, shieldDamage: Schema.Finite, percentDamage: Schema.Finite,
});
type TradeoffFact = typeof TradeoffFact.Type;
const MoveRow = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("move"), style: Schema.Finite, chargeFrames: Schema.Finite, startup: Schema.Finite, character: Schema.Finite }),
  Schema.Struct({ kind: Schema.Literals(["context", "contact", "motion"]) }),
]);
const ReferenceRow = Schema.Struct({
  category: Schema.String, character: Schema.String, action: Schema.NullOr(Schema.String),
  values: Schema.Record(Schema.String, Schema.NullOr(Schema.Finite)), frame_index_origin: Schema.Finite,
});
const ComparisonRow = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("contact"), ...TradeoffFact.fields }),
  Schema.Struct({ kind: Schema.Literals(["context", "category-rule", "option"]) }),
]);
function sameContactContext(a: TradeoffFact, b: TradeoffFact): boolean {
  return a.category === b.category && a.spacing === b.spacing && a.percent === b.percent && a.shielding === b.shielding;
}
function readinessDamageDominates(a: TradeoffFact, b: TradeoffFact): boolean {
  const aDamage = a.shielding ? a.shieldDamage : a.percentDamage;
  const bDamage = b.shielding ? b.shieldDamage : b.percentDamage;
  return aDamage >= bDamage && a.attackerReady <= b.attackerReady && a.defenderReady >= b.defenderReady
    && (aDamage > bDamage || a.attackerReady < b.attackerReady || a.defenderReady > b.defenderReady);
}
export function referenceTradeoffVerdict(a: TradeoffFact, b: TradeoffFact): string {
  if (!a.connected || !b.connected) return "contact-unavailable";
  if (a.attackerReady < 0 || b.attackerReady < 0 || a.defenderReady < 0 || b.defenderReady < 0) return "readiness-unobserved";
  if (readinessDamageDominates(a, b)) return "a-dominates-projection";
  if (readinessDamageDominates(b, a)) return "b-dominates-projection";
  const aDamage = a.shielding ? a.shieldDamage : a.percentDamage;
  const bDamage = b.shielding ? b.shieldDamage : b.percentDamage;
  return aDamage === bDamage && a.attackerReady === b.attackerReady && a.defenderReady === b.defenderReady ? "equal-projection" : "tradeoff";
}
function emitReference(): Promise<void> {
  return (async () => {
    const [moves, references, comparisons] = await Promise.all([
      readJsonl(join(root, "tools/move-data/moves.jsonl"), MoveRow), readJsonl(join(root, "references/melee-frame-data/records.jsonl"), ReferenceRow),
      readJsonl(join(root, "tools/move-data/comparisons.jsonl"), ComparisonRow),
    ]);
    rows.length = 0;
    rows.push(json({ kind: "context", schema: 1, productionInput: "smashcraft:tools/move-data/moves.jsonl", comparisonInput: "smashcraft:tools/move-data/comparisons.jsonl", referenceInput: "smashcraft:references/melee-frame-data/records.jsonl", productionContext: moves.find((r) => r.kind === "context"), comparisonContext: comparisons.find((r) => r.kind === "context"), join: "action family across distinct identities; never fighter equivalence", declaredMeaning: "verbatim exported facts, including previously derived production measurements", referenceFieldMeanings: { start: "reported first active, one-based", end: "reported last active bound; gaps unknown", total: "reported action boundary; recovery not inferred", stun: "shieldstun, not hitstun", percent: "reported strongest rounded base damage; not multihit total" }, projection: { damage: "maximize shieldDamage on shield, percentDamage on body", attackerReady: "minimize", defenderReady: "maximize", pairing: "different production fighters; same category, spacing, percent, shielding; fixed Rifleman defender and shared fixture" }, excludedFromOrder: ["separation", "launch direction", "hurtbox geometry", "approach and startup", "escape choices", "whole moveset"], tuningDecision: "No supported parameter change: partial-order findings alone do not establish an unwanted trade-off or target." }));
    const exported = moves.filter((r) => r.kind === "move");
    const characters = [...new Set(references.filter((r) => r.category === "attacks").map((r) => r.character))];
    const matched = new Set<string>();
    for (const reference of references) {
      if (reference.category !== "attacks") continue;
      for (const move of exported) {
        const action = actionFamily(move.style);
        if (!action || action !== (reference.action ?? "")) continue;
        const scope = referenceJoinScope(move.style, move.chargeFrames);
        const start = reference.values.start;
        const delta = start != null && reference.frame_index_origin === 1 && scope === "same-action-family" ? firstActiveDelta(move.startup, start) : null;
        rows.push(json({ kind: "reference-join", scope, declared: { production: move, reference }, derived: { productionFirstActiveOneBased: move.startup + 1, reportedFirstActiveDelta: delta }, unknown: { fighterEquivalence: null, referenceRecovery: null, referenceDiscreteActiveWindows: null, referenceShieldSafety: null, chargeComparability: null, balanceParity: null } }));
        matched.add(`${reference.character}\u0000${move.character}\u0000${move.style}\u0000${move.chargeFrames}`);
      }
    }
    for (const referenceCharacter of characters) for (const move of exported) if (!matched.has(`${referenceCharacter}\u0000${move.character}\u0000${move.style}\u0000${move.chargeFrames}`)) {
      rows.push(json({ kind: "reference-gap", declared: { production: move, referenceCharacter }, derived: { requestedActionFamily: actionFamily(move.style) }, unknown: { referenceRecord: null } }));
    }
    const contacts = comparisons.filter((r) => r.kind === "contact");
    for (let j = 0; j < contacts.length; j++) for (let i = 0; i < j; i++) {
      const a = contacts[i], b = contacts[j];
      if (a === undefined || b === undefined) throw new Error("contact pair missing");
      if (a.character === b.character || !sameContactContext(a, b)) continue;
      const verdict = referenceTradeoffVerdict(a, b);
      rows.push(json({ kind: "tradeoff", declared: { a, b }, derived: { verdict }, unknown: { overallDominance: null, tuningRecommendation: null } }));
    }
  })();
}

async function main(): Promise<void> {
  const [command = "export", mode = "export"] = process.argv.slice(2);
  if (!(["export", "compare", "reference"].includes(command) && ["export", "--check"].includes(mode))) throw new Error("usage: bun scripts/moveData.ts export|compare|reference [--check]");
  const outputDir = join(root, "build", command === "export" ? "move-export" : command === "compare" ? "move-comparisons" : "move-reference");
  rows.length = 0;
  if (command === "export") emitMoves();
  else if (command === "reference") await emitReference();
  else if (command === "compare") rows.push(...exportComparisons());
  await mkdir(outputDir, { recursive: true });
  const filename = command === "export" ? "moves.jsonl" : command === "reference" ? "reference-join.jsonl" : "comparisons.jsonl";
  const result = rows.join("\n") + "\n";
  const output = join(outputDir, filename);
  await Bun.write(output, result);
  console.log(`Exported ${rows.length} rows to ${output}`);
  if (mode === "--check") {
    const snapshot = join(root, "tools/move-data", filename);
    const expectedRows = (await Bun.file(snapshot).text()).trim().split("\n");
    const actualRows = result.trim().split("\n");
    const rowCount = Math.min(expectedRows.length, actualRows.length);
    for (let index = 0; index < rowCount; index++) {
      const expected = expectedRows[index], actual = actualRows[index];
      if (expected === undefined || actual === undefined) throw new Error(`Snapshot row ${index} missing`);
      const difference = firstDifference(expected, actual);
      if (difference !== undefined) throw new Error(`Generated row ${index} differs from ${snapshot} at ${difference}; inspect the production-data change before replacing the snapshot.`);
    }
    if (expectedRows.length !== actualRows.length) throw new Error(`Generated output has ${actualRows.length} rows; ${snapshot} has ${expectedRows.length}. Inspect before replacing the snapshot.`);
    console.log(`Generated output matches ${snapshot} at the snapshot's 12-decimal numeric precision`);
  }
}

if (import.meta.main) await main();
