import { f32 } from "wisp/src/sim/f32";
import type { HitEffect } from "./hitRegions";
import type { AuthoredSpecial, SpecialKit, SpecialProjectile } from "./heroSpecials";

export interface ExUpgrade {
  readonly damage?: number;
  readonly reach?: number;
  readonly travel?: number;
  readonly durability?: number;
  readonly armorDamage?: number;
  readonly guardFrames?: number;
  /** Protection for a recall or companion command that has no damaging payload. */
  readonly recallProtection?: number;
}

/** Build immutable EX data once; a running cast only selects its authored form. */
export function withExKit(kit: SpecialKit, upgrade: ExUpgrade): SpecialKit {
  const damage = upgrade.damage ?? 1.0;
  const reach = upgrade.reach ?? 1.0;
  const travel = upgrade.travel ?? 1.0;
  const originals: SpecialProjectile[] = [];
  const upgraded: SpecialProjectile[] = [];
  const hit = (effect: Readonly<HitEffect>): HitEffect => ({ ...effect, damage: f32(effect.damage * damage) });
  const projectile = (spec: SpecialProjectile): SpecialProjectile => {
    for (let index = 0; index < originals.length; index++) {
      if (originals[index] === spec) return upgraded[index] ?? spec;
    }
    const result: SpecialProjectile = {
      ...spec, radius: f32(spec.radius * reach), effect: hit(spec.effect),
      returnEffect: spec.returnEffect === undefined ? undefined : hit(spec.returnEffect),
      pool: spec.pool === undefined ? undefined : { ...spec.pool, growth: f32(spec.pool.growth * reach), maxRadius: f32(spec.pool.maxRadius * reach) },
    };
    originals.push(spec);
    upgraded.push(result);
    return result;
  };
  const exMove = (move: AuthoredSpecial, recall: boolean): AuthoredSpecial => {
    const placement = move.placement;
    const guard = move.guard;
    const guardFrames = guard === undefined ? 0 : upgrade.guardFrames ?? 0;
    const protection = recall ? upgrade.recallProtection ?? 0 : 0;
    return {
      ...move,
      regions: move.regions?.map(region => ({ ...region, hit: { ...region.hit,
        minX: f32(region.hit.minX * reach), maxX: f32(region.hit.maxX * reach),
        minZ: f32(region.hit.minZ - f32((region.hit.strike?.radius ?? 0.0) * f32(reach - 1.0))),
        maxZ: f32(region.hit.maxZ + f32((region.hit.strike?.radius ?? 0.0) * f32(reach - 1.0))),
        strike: region.hit.strike === undefined ? undefined : { ...region.hit.strike,
          x1: f32(region.hit.strike.x1 * reach), x2: f32(region.hit.strike.x2 * reach), radius: f32(region.hit.strike.radius * reach) },
        effect: hit(region.hit.effect), groundedEffect: region.hit.groundedEffect === undefined ? undefined : hit(region.hit.groundedEffect),
      } })),
      motion: move.motion?.map(motion => ({ ...motion,
        velocityX: f32(motion.velocityX * travel), velocityZ: f32(motion.velocityZ * travel),
        aimedSpeed: motion.aimedSpeed === undefined ? undefined : f32(motion.aimedSpeed * travel),
        driftSpeed: motion.driftSpeed === undefined ? undefined : f32(motion.driftSpeed * travel),
        relocateReach: motion.relocateReach === undefined ? undefined : f32(motion.relocateReach * travel),
      })),
      projectiles: move.projectiles?.map((each) => projectile(each)),
      burst: move.burst === undefined ? undefined : { ...move.burst, from: projectile(move.burst.from), into: projectile(move.burst.into) },
      armor: move.armor === undefined ? undefined : { ...move.armor, maxDamage: f32(move.armor.maxDamage * (upgrade.armorDamage ?? 1.0)) },
      intangible: move.intangible === undefined ? (protection > 0 ? { first: 1, last: protection } : undefined)
        : { ...move.intangible, last: move.intangible.last + guardFrames },
      guard: guard === undefined ? undefined : { ...guard, last: guard.last + guardFrames },
      commandGrab: move.commandGrab === undefined ? undefined : { ...move.commandGrab, effect: hit(move.commandGrab.effect) },
      placement: placement === undefined ? undefined : { ...placement,
        durability: f32(placement.durability * (upgrade.durability ?? 1.0)),
        shot: placement.shot === undefined ? undefined : projectile(placement.shot),
        companion: placement.companion === undefined ? undefined : { ...placement.companion, biteEffect: hit(placement.companion.biteEffect) },
      },
      followUps: move.followUps?.map(branch => ({ ...branch, special: exMove(branch.special, false) })),
    };
  };
  const form = (move: AuthoredSpecial | undefined, recall = false): AuthoredSpecial | undefined =>
    move === undefined ? undefined : { ...move, ex: exMove(move, recall) };
  return {
    ...kit, ground: { ...kit.ground, ex: exMove(kit.ground, false) },
    air: form(kit.air), free: form(kit.free), recall: form(kit.recall, true),
    marked: kit.marked === undefined ? undefined : { ...kit.marked, special: { ...kit.marked.special, ex: exMove(kit.marked.special, false) } },
    soul: form(kit.soul),
  };
}
