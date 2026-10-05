// One fighter's projectile models, one per projectile slot. Created and
// destroyed only in the synchronized match lifecycle; projecting never
// allocates handles. Particles the engine emits are not replay state.
import { Character } from "../sim/codes";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { f32 } from "../../sim/f32";
import { STOCK_MODELS, type WorldOrigin, hideEffect } from "./effects";
import { projectedProjectile } from "../presentation/projectilePose";

function projectileModel(character: Character): string {
  return character === Character.demonHunter ? STOCK_MODELS.manaFlareMissile : character === Character.archer ? STOCK_MODELS.arrowMissile : STOCK_MODELS.gyroCopterMissile;
}

export class ProjectilePresentation {
  private readonly models: effect[] = [];
  private readonly visible: boolean[] = [];
  private readonly scale: number;

  constructor(
    character: Character,
    private readonly origin: WorldOrigin,
  ) {
    this.scale = character === Character.rifleman ? f32(0.65) : 1.0;
    const path = projectileModel(character);
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) {
      const model = AddSpecialEffect(path, origin.x, origin.y);
      BlzSetSpecialEffectPosition(model, origin.x, origin.y, origin.z);
      this.models.push(model);
      this.visible.push(false);
    }
    this.clear();
  }

  private hide(model: effect): void {
    hideEffect(model);
    BlzSetSpecialEffectTimeScale(model, 0.0);
  }

  clear(): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model === undefined) continue;
      this.visible[index] = false;
      this.hide(model);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model === undefined) continue;
      const pose = projectedProjectile(fighter, index, playing);
      this.visible[index] = pose.visible;
      if (!pose.visible) {
        this.hide(model);
        continue;
      }
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.origin.y, this.origin.z + pose.z);
      BlzSetSpecialEffectScale(model, this.scale);
      BlzSetSpecialEffectAlpha(model, 255);
      BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
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
  }
}
