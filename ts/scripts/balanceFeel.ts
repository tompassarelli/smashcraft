import { BALANCE_SPEC } from "./balance";
import { AttackStyle, Character, GrabAction, ProjectileKind } from "../src/game/sim/codes";
import { createFighter } from "../src/game/sim/fighter";
import { createRoster, neutralControls } from "../src/game/sim/roster";
import { openDamageContacts, finishDamageContacts } from "../src/game/sim/contacts";
import { applyAttackHit } from "../src/game/sim/hits";
import { advanceFighter } from "../src/game/sim/step";
import { digitalShieldstunFrames } from "../src/game/sim/shield";
import { isAerialAttack } from "../src/game/sim/moves";
import { authoredTuning } from "../src/game/sim/tuning";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion, type HitEffect } from "../src/game/sim/hitRegions";
import { attackStartupFrames, attackDurationFramesForGrounding, attackLandingLag } from "../src/game/sim/moves";
import { authoredThrowEffect } from "../src/game/sim/grabs";
import { BEAR_SWIPE, BEAR_SWIPE_EX } from "../src/game/sim/summons";
import { originalProjectileEffect } from "../src/game/sim/projectiles";
import * as specials from "../src/game/sim/specials";
import { currentKit } from "./balanceKit";
import type { FeelValues, FeelSample } from "./balanceKit";

const cache = new Map<string, number | undefined>();

function killPercent(effect: Readonly<HitEffect>): number | undefined {
  const key = JSON.stringify(effect);
  if (cache.has(key)) return cache.get(key);
  const kills = (percent: number): boolean => {
    const attacker = createFighter(Character.rifleman, -50, 1);
    const target = createFighter(Character.rifleman, 0, -1);
    target.motion.grounded = true;
    target.motion.z = 0;
    target.status.damage = percent;
    const world = createRoster(2, [attacker, target]);
    openDamageContacts();
    applyAttackHit(world, 0, 1, AttackStyle.jab, 1, effect, true, false);
    finishDamageContacts(world);
    const input = neutralControls();
    for (let frame = 0; frame < BALANCE_SPEC.feelFlightFrames; frame++) {
      advanceFighter(world, 1, 0, input, 0, frame);
      if (target.status.out) return true;
    }
    return false;
  };
  if (!kills(BALANCE_SPEC.feelMaxPercent)) { cache.set(key, undefined); return undefined; }
  let low = 0;
  let high: number = BALANCE_SPEC.feelMaxPercent;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (kills(middle)) high = middle; else low = middle + 1; }
  cache.set(key, low);
  return low;
}

const sample = (effect: Readonly<HitEffect>, recovery: number, aerial: boolean): FeelSample => {
  const kill = killPercent(effect);
  return { advantage: digitalShieldstunFrames(effect.damage, aerial) - recovery, ...(kill === undefined ? {} : { killPercent: kill }) };
};


export function currentFeel(character: Character): FeelValues {
  const tuning = authoredTuning(character);
  const out: Record<string, FeelSample> = {};
  for (const style of Object.values(AttackStyle)) {
    if (style === AttackStyle.grab) continue;
    const aerial = isAerialAttack(style);
    const startup = attackStartupFrames(style, tuning.moves);
    const total = attackDurationFramesForGrounding(style, !aerial, tuning.moves);
    for (let index = 0; index < authoredHitRegionCount(style, tuning.moves); index++) for (let frame = startup; frame < total; frame++) {
      const hit = authoredHitRegion(emptyHitRegion(), character, style, frame, 0, index, tuning.moves);
      if (hit.effect.damage > 0) {
        out[`normal.${style}.hit.${index}`] = sample(hit.effect, aerial ? attackLandingLag(style, tuning.moves) : total - frame - 1, aerial);
        if (hit.groundedEffect !== undefined) out[`normal.${style}.hit.${index}.grounded`] = sample(hit.groundedEffect, aerial ? attackLandingLag(style, tuning.moves) : total - frame - 1, aerial);
        break;
      }
    }
  }
  const isEffect = (value: unknown): value is Readonly<HitEffect> => typeof value === "object" && value !== null
    && "damage" in value && typeof value.damage === "number" && "growth" in value && typeof value.growth === "number"
    && "base" in value && typeof value.base === "number" && "launchX" in value && typeof value.launchX === "number"
    && "launchZ" in value && typeof value.launchZ === "number" && "electric" in value && typeof value.electric === "boolean";
  const visit = (row: unknown, path: string, end: number): void => {
    if (row === null || typeof row !== "object") return;
    const actionEnd = "endFrame" in row && typeof row.endFrame === "number" ? row.endFrame : end;
    if ("firstFrame" in row && typeof row.firstFrame === "number" && "hit" in row && typeof row.hit === "object" && row.hit !== null) {
      const hit = row.hit;
      if ("effect" in hit && isEffect(hit.effect) && hit.effect.damage > 0) out[path] = sample(hit.effect, actionEnd - row.firstFrame - 1, false);
      if ("groundedEffect" in hit && isEffect(hit.groundedEffect)) out[`${path}.grounded`] = sample(hit.groundedEffect, actionEnd - row.firstFrame - 1, false);
    }
    if ("spawnFrame" in row && typeof row.spawnFrame === "number" && "effect" in row && isEffect(row.effect)) out[path] = sample(row.effect, Math.max(0, actionEnd - row.spawnFrame), false);
    for (const [name, child] of Object.entries(row)) visit(child, `${path}.${name}`, actionEnd);
  };
  visit(tuning.specials, "special", 0);
  for (const action of [GrabAction.throwForward, GrabAction.throwBack, GrabAction.throwUp, GrabAction.throwDown]) {
    const kill = killPercent(authoredThrowEffect(action, tuning.moves));
    out[`throw.${action}`] = { advantage: 0, ...(kill === undefined ? {} : { killPercent: kill }) };
  }
  if (character === Character.rifleman || character === Character.demonHunter) {
    const values = currentKit(character).values;
    const number = (name: string): number => Object.entries(values).find(([path]) => path.endsWith(`.${name}`))?.[1] ?? 0;
    const firstProjectile = createFighter(character, 0, 1).projectiles[0];
    if (firstProjectile === undefined) throw new Error("Original fighter has no projectile slot");
    const projectile = { ...firstProjectile };
    for (const kind of character === Character.rifleman ? [ProjectileKind.blaster, ProjectileKind.recoil] : [ProjectileKind.manaBurn]) {
      projectile.kind = kind;
      projectile.damageMultiplier = 1;
      const duration = kind === ProjectileKind.blaster ? number("RIFLEMAN_BLASTER_GROUND_FRAMES") : kind === ProjectileKind.recoil ? number("RIFLEMAN_RECOVERY_FRAMES") : specials.DEMONHUNTER_MANA_BURN_STARTUP + specials.DEMONHUNTER_MANA_BURN_RECOVERY;
      const spawn = kind === ProjectileKind.blaster ? number("RIFLEMAN_BLASTER_GROUND_SHOT_FRAME") : kind === ProjectileKind.recoil ? specials.RIFLEMAN_RECOVERY_STARTUP_FRAMES : specials.DEMONHUNTER_MANA_BURN_STARTUP;
      out[`special.projectile.${kind}`] = sample(originalProjectileEffect(projectile), duration - spawn, false);
    }
    if (character === Character.rifleman) {
      out["special.bear"] = sample(BEAR_SWIPE, specials.RIFLEMAN_BEAR_SUMMON_FRAMES - specials.RIFLEMAN_BEAR_CAST_FRAMES, false);
      out["special.bear.ex"] = sample(BEAR_SWIPE_EX, specials.RIFLEMAN_BEAR_SUMMON_FRAMES - specials.RIFLEMAN_BEAR_CAST_FRAMES, false);
    } else {
      for (const ex of [false,true]) {
        const rush = specials.felRushRegion(0, specials.FEL_RUSH_FIRST, ex);
        const chaos = specials.felRushRegion(specials.CHAOS_STRIKE_FORM, specials.CHAOS_STRIKE_FIRST, ex);
        out[`special.rush.${ex}`] = sample(rush.effect, specials.FEL_RUSH_FRAMES - specials.FEL_RUSH_FIRST, false);
        out[`special.chaos.${ex}`] = sample(chaos.effect, specials.CHAOS_STRIKE_FRAMES - specials.CHAOS_STRIKE_FIRST, false);
        for (const grounded of [false,true]) out[`special.immolate.${grounded}.${ex}`] = sample(specials.immolationRegion(grounded, ex).effect, specials.DEMONHUNTER_IMMOLATE_DURATION - specials.DEMONHUNTER_IMMOLATE_STARTUP, false);
      }
      out["special.glide"] = sample(specials.glideSlashRegion().effect, number("DEMONHUNTER_GLIDE_SLASH_FRAMES") - specials.DEMONHUNTER_GLIDE_SLASH_FIRST, false);
      const flames: readonly (readonly [number,number,number])[] = [[specials.FLAME_CRASH_FORM, specials.FLAME_CRASH_HANG_LAST + 1, specials.FLAME_CRASH_FRAMES], [specials.FLAME_CRASH_LANDING_FORM, 1, specials.FLAME_CRASH_LANDING_FRAMES]];
      for (const [form, frame, total] of flames) {
        const hit = specials.flameCrashRegion(form, frame);
        if (hit.effect.damage > 0) out[`special.flame.${form}`] = sample(hit.effect, total - frame, false);
        if (hit.groundedEffect !== undefined) out[`special.flame.${form}.grounded`] = sample(hit.groundedEffect, total - frame, false);
      }
    }
  }
  return out;
}
