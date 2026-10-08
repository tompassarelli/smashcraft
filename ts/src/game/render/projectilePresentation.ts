// One fighter's projectile models: a pool per stock missile its moves fire
// (presentation/projectileArt.ts). Created and destroyed only in the
// synchronized match lifecycle; projecting never allocates handles.
// Particles the engine emits are not replay state.
import { Character } from "../sim/codes";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { heroDefinition } from "../sim/heroes/registry";
import { HERO_PROJECTILE_CAP } from "../sim/heroSpecialRules";
import { f32 } from "wisp/src/sim/f32";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";
import { fighterProjectileModels, projectileModelOf } from "../presentation/projectileArt";
import { projectedProjectile } from "../presentation/projectilePose";
import { IMPACT_DEFILE_MODEL } from "../assets/impactAssetInfo";
import { heroProjectileArt } from "../presentation/projectileArt";

/** One missile model's effects. */
interface Pool {
  readonly path: string;
  /** Global effect indices, into `models`. */
  readonly effects: readonly number[];
  readonly boundaries: readonly number[];
}

export class ProjectilePresentation {
  private readonly models: effect[] = [];
  private readonly visible: boolean[] = [];
  private readonly pools: Pool[] = [];
  /** The effect each projectile slot draws with, or -1; kept while it flies, so a missile never jumps to another. */
  private readonly assigned: number[] = [];
  /** Effects drawn this presentation, by effect index; reused every frame. */
  private readonly taken: boolean[] = [];
  private readonly serials: number[] = [];
  private readonly specs: (Fighter["projectiles"][number]["spec"])[] = [];
  private parked: ParkedFlags | undefined;

  constructor(
    character: Character,
    private readonly origin: WorldOrigin,
  ) {
    const hero = heroDefinition(character) !== undefined;
    fighterProjectileModels(character).forEach((path, index) => {
      // A hero owns at most three projectiles; one more for a reflected one. The original fighters' main missile can fill every slot.
      const size = hero ? HERO_PROJECTILE_CAP + 1 : index === 0 ? PROJECTILE_CAPACITY : 4;
      const effects: number[] = [];
      const boundaries: number[] = [];
      const specials = heroDefinition(character)?.specials;
      const groundPool = specials !== undefined && heroProjectileArt(specials).some(({ spec }) => spec.model === path && (spec.pool !== undefined || (spec.velocityX === 0.0 && spec.velocityZ === 0.0)));
      for (let slot = 0; slot < size; slot++) {
        effects.push(this.models.length);
        this.models.push(AddSpecialEffect(path, origin.x, origin.y));
        this.visible.push(false);
        if (groundPool) {
          boundaries.push(this.models.length);
          const boundary = AddSpecialEffect(IMPACT_DEFILE_MODEL, origin.x, origin.y);
          BlzSetSpecialEffectAnimationBlendTime(boundary, 0.0);
          BlzSetSpecialEffectAnimation(boundary, "stand");
          BlzSetSpecialEffectTime(boundary, 0.0);
          this.models.push(boundary);
          this.visible.push(false);
        }
      }
      this.pools.push({ path, effects, boundaries });
    });
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) this.assigned.push(-1);
    this.clear();
  }

  /** Parks a missile once and stops its animation, which a pause would otherwise leave running. */
  private hide(model: effect, parked: ParkedFlags, index: number): void {
    if (parkOnce(model, this.origin, parked, index)) BlzSetSpecialEffectTimeScale(model, 0.0);
  }

  clear(): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model === undefined) continue;
      this.visible[index] = false;
      this.hide(model, parked, index);
    }
    for (let index = 0; index < this.assigned.length; index++) this.assigned[index] = -1;
  }

  /**
   * The pool for a projectile's model: a foreign missile this fighter
   * reflected draws with its first pool when it has none of that model.
   */
  private poolOf(fighter: Readonly<Fighter>, index: number): Pool | undefined {
    const projectile = fighter.projectiles[index];
    const path = projectile === undefined ? undefined : projectileModelOf(projectile);
    return this.pools.find((pool) => pool.path === path) ?? this.pools[0];
  }

  /** The effect a visible projectile draws with: its kept one when still of its pool, else a free one. */
  private effectFor(pool: Pool, index: number, taken: readonly boolean[]): number {
    const kept = this.assigned[index] ?? -1;
    if (kept >= 0 && pool.effects.includes(kept) && taken[kept] !== true) return kept;
    for (const candidate of pool.effects) if (taken[candidate] !== true && !this.assigned.includes(candidate)) return candidate;
    for (const candidate of pool.effects) if (taken[candidate] !== true) return candidate;
    return -1;
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    const parked = (this.parked ??= []);
    const taken = this.taken;
    for (let index = 0; index < this.models.length; index++) taken[index] = false;
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) {
      const pose = projectedProjectile(fighter, index, playing);
      const pool = fighter === undefined || !pose.visible ? undefined : this.poolOf(fighter, index);
      const slot = pool === undefined ? -1 : this.effectFor(pool, index, taken);
      this.assigned[index] = slot;
      const model = this.models[slot];
      if (model === undefined) continue;
      taken[slot] = true;
      parked[slot] = false;
      const projectile = fighter?.projectiles[index];
      if (projectile !== undefined && (this.serials[slot] !== projectile.serial || this.specs[slot] !== projectile.spec || !this.visible[slot])) {
        const birth = pool?.path.includes("FreezingBreathMissile") === true || pool?.path.includes("WaterElementalMissile") === true;
        BlzSetSpecialEffectAnimation(model, pose.animationSequence ?? (birth ? "birth" : "stand"));
        BlzSetSpecialEffectTime(model, 0.0);
        this.serials[slot] = projectile.serial;
        this.specs[slot] = projectile.spec;
      }
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.origin.y, this.origin.z + pose.z);
      const smallMissile = pool?.path.includes("QuillSprayMissile") === true || pool?.path.includes("ShadowHunterMissile") === true;
      BlzSetSpecialEffectScale(model, pose.modelScale * (smallMissile ? f32(1.5) : 1.0));
      BlzSetSpecialEffectAlpha(model, 255);
      BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
      if (pose.animationSeconds !== undefined) {
        if (!this.visible[slot] && pose.animationSequence !== undefined) BlzSetSpecialEffectAnimation(model, pose.animationSequence);
        BlzSetSpecialEffectTime(model, pose.animationSeconds);
        BlzSetSpecialEffectTimeScale(model, 0.0);
      } else if (projectile?.spec !== undefined && projectile.velocityX === 0.0 && projectile.velocityZ === 0.0) {
        // Stationary spell areas hold their visible contact pose while armed.
        BlzSetSpecialEffectTime(model, f32(0.3));
        BlzSetSpecialEffectTimeScale(model, 0.0);
      }
      const boundarySlot = pool?.boundaries[pool.effects.indexOf(slot)];
      const boundary = boundarySlot === undefined ? undefined : this.models[boundarySlot];
      if (boundary !== undefined && boundarySlot !== undefined && pose.dangerRadius > 0.0) {
        taken[boundarySlot] = true;
        parked[boundarySlot] = false;
        BlzSetSpecialEffectPosition(boundary, this.origin.x + pose.x, this.origin.y - 8.0, this.origin.z + pose.z);
        BlzSetSpecialEffectScale(boundary, pose.dangerRadius);
        const frost = fighter?.character === Character.lich;
        BlzSetSpecialEffectColor(boundary, frost ? 155 : pose.armed ? 170 + 85 * pose.poolPulse : 70, frost ? 210 : pose.armed ? 75 + 180 * pose.poolPulse : 65, frost ? 255 : pose.armed ? 255 : 100);
        BlzSetSpecialEffectAlpha(boundary, pose.armed ? 255 : 160);
        BlzSetSpecialEffectTimeScale(boundary, 0.0);
      }
    }
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      this.visible[index] = taken[index] === true;
      if (model !== undefined && taken[index] !== true) this.hide(model, parked, index);
    }
  }

  setPaused(paused: boolean): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) BlzSetSpecialEffectTimeScale(model, paused || this.visible[index] !== true ? 0.0 : 1.0);
    }
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) DestroyEffect(model);
    this.models.length = 0;
    this.visible.length = 0;
    this.pools.length = 0;
  }
}
