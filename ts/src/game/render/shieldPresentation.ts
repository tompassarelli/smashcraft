// One participant's shield bubble, allocated once per participant in the
// synchronized match lifecycle. Projection can replace a speculative shield
// without allocating a handle.
import { SHIELD_P1_MODEL, SHIELD_P2_MODEL, SHIELD_P3_MODEL, SHIELD_P4_MODEL } from "../assets/shieldAssetInfo";
import type { Fighter } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";
import { projectedShield } from "../presentation/shieldPose";

function shieldModel(slot: number): string {
  return slot === 0 ? SHIELD_P1_MODEL : slot === 1 ? SHIELD_P2_MODEL : slot === 2 ? SHIELD_P3_MODEL : SHIELD_P4_MODEL;
}

export class ShieldPresentation {
  private readonly model: effect;
  private parked: ParkedFlags | undefined;

  constructor(
    slot: number,
    private readonly origin: WorldOrigin,
  ) {
    this.model = AddSpecialEffect(shieldModel(slot), origin.x, origin.y);
    BlzSetSpecialEffectAnimationBlendTime(this.model, 0.0);
    BlzSetSpecialEffectAnimation(this.model, "Stand");
    BlzSetSpecialEffectTimeScale(this.model, 0.0);
    BlzSetSpecialEffectTime(this.model, 0.0);
    this.hide();
  }

  hide(): void {
    parkOnce(this.model, this.origin, (this.parked ??= []), 0);
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean): void {
    const pose = projectedShield(fighter, playing);
    if (!pose.visible) {
      this.hide();
      return;
    }
    (this.parked ??= [])[0] = false;
    BlzSetSpecialEffectPosition(this.model, this.origin.x + pose.x, this.origin.y, this.origin.z + pose.z);
    BlzSetSpecialEffectScale(this.model, pose.scale);
    BlzSetSpecialEffectAlpha(this.model, 255);
  }

  destroy(): void {
    this.hide();
    DestroyEffect(this.model);
  }
}
