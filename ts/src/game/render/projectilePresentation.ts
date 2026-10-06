// One fighter's projectile models, one per projectile slot. Created and
// destroyed only in the synchronized match lifecycle; projecting never
// allocates handles. Particles the engine emits are not replay state.
import { Character } from "../sim/codes";
import { heroDefinition } from "../sim/heroes/registry";
import { PROJECTILE_CAPACITY, type Fighter } from "../sim/fighter";
import { f32 } from "wisp/src/sim/f32";
import { type ParkedFlags, STOCK_MODELS, type WorldOrigin, parkOnce } from "./effects";
import { projectedProjectile } from "../presentation/projectilePose";

function projectileModel(character: Character): string {
  const hero = heroDefinition(character);
  if (hero !== undefined) return hero.presentation.projectileModel;
  return character === Character.demonHunter ? STOCK_MODELS.manaFlareMissile : character === Character.archer ? STOCK_MODELS.arrowMissile : STOCK_MODELS.gyroCopterMissile;
}

export class ProjectilePresentation {
  private readonly models: effect[] = [];
  private readonly visible: boolean[] = [];
  private parked: ParkedFlags | undefined;
  private readonly scale: number;

  constructor(
    character: Character,
    private readonly origin: WorldOrigin,
  ) {
    this.scale = character === Character.rifleman ? f32(0.65) : 1.0;
    const path = projectileModel(character);
    for (let index = 0; index < PROJECTILE_CAPACITY; index++) {
      const model = AddSpecialEffect(path, origin.x, origin.y);
      this.models.push(model);
      this.visible.push(false);
    }
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
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model === undefined) continue;
      const pose = projectedProjectile(fighter, index, playing);
      this.visible[index] = pose.visible;
      if (!pose.visible) {
        this.hide(model, parked, index);
        continue;
      }
      parked[index] = false;
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
