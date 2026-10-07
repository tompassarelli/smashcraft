// A summon drawn from its original-model clip pool, like a pooled fighter. The
// pool is allocated once; presenting only projects completed summon state.
import { summonClip, summonClipCount } from "../presentation/summonClipInfo";
import type { SummonProjection } from "../presentation/summonState";
import { type WorldOrigin, hideEffect, placeEffect } from "./effects";

export class SummonPresentation {
  private readonly clips: effect[] = [];
  private visible: number | undefined;

  constructor(
    summon: number,
    private readonly origin: WorldOrigin,
  ) {
    const count = summonClipCount(summon);
    for (let index = 0; index < count; index++) {
      const clip = summonClip(summon, index);
      const model = AddSpecialEffect(clip.modelPath, origin.x, origin.y);
      BlzSetSpecialEffectAnimationBlendTime(model, 0.0);
      BlzSetSpecialEffectAnimation(model, "Stand");
      BlzSetSpecialEffectTimeScale(model, 0.0);
      hideEffect(model, origin);
      this.clips.push(model);
    }
  }

  hide(): void {
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    this.visible = undefined;
  }

  present(pose: Readonly<SummonProjection>): void {
    const model = pose.visible && pose.clipIndex !== undefined ? this.clips[pose.clipIndex] : undefined;
    if (model === undefined || pose.clipIndex === undefined) {
      this.hide();
      return;
    }
    if (this.visible !== pose.clipIndex) {
      this.hide();
      this.visible = pose.clipIndex;
    }
    placeEffect(model, this.origin.x + pose.x, this.origin.y, this.origin.z + pose.z);
    BlzSetSpecialEffectYaw(model, pose.yaw);
    BlzSetSpecialEffectScale(model, pose.scale);
    BlzSetSpecialEffectTime(model, pose.seconds);
    BlzSetSpecialEffectAlpha(model, 255);
  }

  destroy(): void {
    // Every clip but the shown one is already parked, where its death animation plays out of view.
    this.hide();
    for (const model of this.clips) DestroyEffect(model);
    this.clips.length = 0;
  }
}
