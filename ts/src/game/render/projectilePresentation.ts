



import { Character } from "../sim/codes";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { heroDefinition } from "../sim/heroes/registry";
import { HERO_PROJECTILE_CAP } from "../sim/heroSpecialRules";
import { f32 } from "wisp/src/sim/f32";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, parkCue } from "./effects";
import { DEFINITIVE_ULTIMATE_MODELS, PROJECTILE_DRAW_SCALES, fighterProjectileModels, projectileModelOf, ultimateProjectiles } from "../presentation/projectileArt";
import { projectedProjectile } from "../presentation/projectilePose";
import { IMPACT_DEFILE_MODEL } from "../assets/impactAssetInfo";
import { heroProjectileArt } from "../presentation/projectileArt";
import { definitiveCues } from "./specialCueEffects";


interface Pool {
  readonly path: string;
  readonly drawn: string;

  readonly effects: readonly number[];
  readonly boundaries: readonly number[];
}

export class ProjectilePresentation {
  private readonly models: effect[] = [];
  private readonly visible: boolean[] = [];
  private readonly pools: Pool[] = [];

  private readonly assigned: number[] = [];

  private readonly taken: boolean[] = [];
  private readonly serials: number[] = [];
  private readonly specs: (Fighter["projectiles"][number]["spec"])[] = [];
  private parked: ParkedFlags | undefined;
  private readonly definitive: boolean;

  constructor(
    character: Character,
    private readonly origin: WorldOrigin,
  ) {
    const hero = heroDefinition(character) !== undefined;
    const paths = fighterProjectileModels(character);
    this.definitive = definitiveCues();
    const swaps = this.definitive ? DEFINITIVE_ULTIMATE_MODELS[character] : undefined;
    const ultimateOnly = paths.filter((path, index) => index > 0 && !hero && ultimateProjectiles(character).some((spec) => spec.model === path));
    paths.forEach((path, index) => {

      const size = hero ? HERO_PROJECTILE_CAP + 1 : index === 0 ? PROJECTILE_CAPACITY - 4 * ultimateOnly.length : 4;
      const effects: number[] = [];
      const boundaries: number[] = [];
      const specials = heroDefinition(character)?.specials;

      const drawn = swaps?.[path] ?? path;
      const groundPool = specials !== undefined && heroProjectileArt(specials).some(({ spec }) => spec.model === path && spec.pool !== undefined && spec.pool.growth > 0.0);
      for (let slot = 0; slot < size; slot++) {
        effects.push(this.models.length);
        this.models.push(AddSpecialEffect(drawn, origin.x, origin.y));
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
      this.pools.push({ path, drawn, effects, boundaries });
    });
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) this.assigned.push(-1);
    this.clear();
  }


  private hide(model: effect, parked: ParkedFlags, index: number): void {
    parkCue(model, this.origin, parked, index);
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





  private poolOf(fighter: Readonly<Fighter>, index: number): Pool | undefined {
    const projectile = fighter.projectiles[index];
    const path = projectile === undefined ? undefined : projectileModelOf(projectile);
    return this.pools.find((pool) => pool.path === path) ?? this.pools[0];
  }


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
      const lichKing = fighter?.character === Character.lichKing;
      const risen = lichKing && pool?.path.includes("ImpaleHitTarget") === true;
      const tell = lichKing && pool?.path.includes("AnimateDeadTarget") === true;
      const defile = lichKing && projectile?.spec?.pool !== undefined;
      const born = projectile !== undefined && (this.serials[slot] !== projectile.serial || this.specs[slot] !== projectile.spec || !this.visible[slot]);
      if (born && projectile !== undefined && !risen && !tell && !defile) {
        const birth = pool?.path.includes("FreezingBreathMissile") === true || pool?.path.includes("WaterElementalMissile") === true || pool?.path.includes("FrostWyrmMissile") === true;
        BlzSetSpecialEffectAnimation(model, pose.animationSequence ?? (birth ? "birth" : "stand"));
        BlzSetSpecialEffectTime(model, 0.0);
        this.serials[slot] = projectile.serial;
        this.specs[slot] = projectile.spec;
      }
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.origin.y, this.origin.z + pose.z);
      BlzSetSpecialEffectScale(model, pose.modelScale * (pool === undefined ? 1.0 : PROJECTILE_DRAW_SCALES[pool.drawn] ?? 1.0));
      BlzSetSpecialEffectAlpha(model, 255);
      BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
      if (risen) {
        const width = this.definitive ? f32(87.606247) : f32(37.988001);
        const height = this.definitive ? f32(353.993782) : f32(636.061981);
        const centerX = this.definitive ? f32(0.337811) : f32(-0.3387);
        const centerZ = this.definitive
          ? born ? paused ? f32(-198.454501) : f32(-146.291377) : f32(133.889278)
          : born ? f32(-389.412987) : f32(29.882828);
        const scaleX = f32(f32(2.0 * pose.dangerRadius) / width);
        const scaleZ = f32(f32(2.0 * pose.dangerRadius) / height);
        BlzResetSpecialEffectMatrix(model);
        BlzSetSpecialEffectMatrixScale(model, scaleX, 1.0, scaleZ);
        BlzSetSpecialEffectPosition(model, this.origin.x + f32(pose.x - f32(centerX * scaleX)), this.origin.y, this.origin.z + f32(pose.z - f32(centerZ * scaleZ)));
      }
      if (born && projectile !== undefined && (risen || tell || defile)) {
        BlzSetSpecialEffectAnimation(model, "birth");
        this.serials[slot] = projectile.serial;
        this.specs[slot] = projectile.spec;
      }
      if (risen || defile) {
        BlzSetSpecialEffectTime(model, f32(0.3));
        BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : this.definitive ? 1.0 : 0.0);
      } else if (tell && projectile?.spec !== undefined) {
        BlzSetSpecialEffectTime(model, f32((projectile.spec.life - projectile.life) / 60));
      } else if (pose.animationSeconds !== undefined) {
        if (!this.visible[slot] && pose.animationSequence !== undefined) BlzSetSpecialEffectAnimation(model, pose.animationSequence);
        BlzSetSpecialEffectTime(model, pose.animationSeconds);
        BlzSetSpecialEffectTimeScale(model, 0.0);
      } else if (projectile?.spec !== undefined && projectile.velocityX === 0.0 && projectile.velocityZ === 0.0) {

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
        if (defile) {
          BlzResetSpecialEffectMatrix(boundary);
          BlzSetSpecialEffectMatrixScale(boundary, 1.0, f32(5.0 / 3.0), 1.0);
          BlzSetSpecialEffectRoll(boundary, f32(Math.PI * 0.5));
        }
        const frost = fighter?.character === Character.lich;
        BlzSetSpecialEffectColor(boundary, frost ? 155 : pose.armed ? 170 + 85 * pose.poolPulse : 70, frost ? 210 : pose.armed ? 75 + 180 * pose.poolPulse : 65, frost ? 255 : pose.armed ? 255 : 100);
        BlzSetSpecialEffectAlpha(boundary, pose.armed ? 255 : 160);
        if (!this.visible[boundarySlot]) BlzSetSpecialEffectTime(boundary, 0.0);
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
      if (model !== undefined) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : this.visible[index] === true ? 1.0 : PARKED_CUE_TIME_SCALE);
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
