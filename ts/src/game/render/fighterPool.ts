// A fighter drawn from a pool of original-model clips: every clip has its own
// effect, all frozen, and presenting shows the selected one at the pose's clip
// time. Allocation and destruction belong to the synchronized character and
// match lifecycle; present and hide change only these handles.
import {
  ORIGINAL_LIGHT_ACTIVE_ANIMATION,
  ORIGINAL_LIGHT_GATE_SECONDS,
  ORIGINAL_LIGHT_INACTIVE_ANIMATION,
  originalClip,
  originalClipCount,
  originalClipNamed,
  originalLightPath,
} from "../assets/fighterOriginalClipInfo";
import type { FighterPose } from "../presentation/fighterPose";
import type { Character } from "../sim/codes";
import { fighterPoseFacing, isIntangible } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { type WorldOrigin, facingYaw, hideEffect } from "./effects";
import { characterModelScale } from "../presentation/modelScale";
import { fitFighterPlacement } from "../presentation/fighterPlacement";

export class FighterPoolPresentation {
  private readonly clips: effect[] = [];
  private readonly light: effect | undefined;
  private readonly scale: number;
  private lightVisible = false;
  private visible: number | undefined;
  private readonly placement = { x: 0.0, z: 0.0 };
  /** Frames whose pose selected a clip this pool doesn't have. */
  missingSelections = 0;

  constructor(
    private readonly character: Character,
    participant: number,
    private readonly origin: WorldOrigin,
  ) {
    const { x, y, z } = origin;
    this.scale = characterModelScale(character);
    const lightPath = originalLightPath(character);
    if (lightPath !== undefined) {
      const light = AddSpecialEffect(lightPath, x, y);
      BlzSetSpecialEffectPosition(light, x, y, z);
      BlzSetSpecialEffectScale(light, this.scale);
      BlzSetSpecialEffectAnimationBlendTime(light, 0.0);
      BlzSetSpecialEffectTimeScale(light, 0.0);
      this.suppress(light);
      this.light = light;
    }
    const count = originalClipCount(character);
    for (let index = 0; index < count; index++) {
      const clip = originalClip(character, index);
      if (clip === undefined) break;
      const model = AddSpecialEffect(clip.modelPath, x, y);
      BlzSetSpecialEffectColorByPlayer(model, Player(participant));
      BlzSetSpecialEffectAnimationBlendTime(model, 0.0);
      BlzSetSpecialEffectAnimation(model, "Stand");
      BlzSetSpecialEffectTimeScale(model, 0.0);
      hideEffect(model, origin);
      this.clips.push(model);
    }
  }

  /** Whether this character has a clip pool to draw with. */
  admitted(): boolean {
    return this.clips.length > 0;
  }

  /** The light's inactive animation casts no light. */
  private suppress(light: effect): void {
    BlzSetSpecialEffectAnimation(light, ORIGINAL_LIGHT_INACTIVE_ANIMATION);
    BlzSetSpecialEffectTime(light, ORIGINAL_LIGHT_GATE_SECONDS);
  }

  hide(): void {
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    this.visible = undefined;
    if (this.light !== undefined && this.lightVisible) {
      this.suppress(this.light);
      this.lightVisible = false;
    }
  }

  present(fighter: Readonly<Fighter>, pose: Readonly<FighterPose>, stage = 0): void {
    if (this.clips.length === 0) return;
    const index = pose.clipIndex ?? originalClipNamed(this.character, pose.clipName);
    const model = index === undefined ? undefined : this.clips[index];
    const clip = index === undefined ? undefined : originalClip(this.character, index);
    if (fighter.status.out || index === undefined || model === undefined || clip === undefined) {
      if (!fighter.status.out) this.missingSelections++;
      this.hide();
      return;
    }
    if (this.visible !== index) {
      const shown = this.visible === undefined ? undefined : this.clips[this.visible];
      if (shown !== undefined) hideEffect(shown, this.origin);
      this.visible = index;
    }
    const duration = clip.endSeconds - clip.startSeconds;
    let seconds = pose.clipTime > 0.0 ? pose.clipTime : 0.0;
    if (duration <= 0.0) seconds = 0.0;
    else if (clip.looping) seconds -= I2R(R2I(seconds / duration)) * duration;
    else if (seconds > duration) seconds = duration;
    fitFighterPlacement(this.placement, fighter, stage);
    const x = this.origin.x + this.placement.x;
    const y = this.origin.y;
    const z = this.origin.z + this.placement.z;
    const yaw = facingYaw(fighterPoseFacing(fighter));
    BlzSetSpecialEffectPosition(model, x, y, z);
    BlzSetSpecialEffectYaw(model, yaw);
    BlzSetSpecialEffectScale(model, this.scale);
    BlzSetSpecialEffectTime(model, seconds);
    if (this.light !== undefined) {
      BlzSetSpecialEffectPosition(this.light, x, y, z);
      BlzSetSpecialEffectYaw(this.light, yaw);
      BlzSetSpecialEffectScale(this.light, this.scale);
      if (!this.lightVisible) {
        BlzSetSpecialEffectAnimation(this.light, ORIGINAL_LIGHT_ACTIVE_ANIMATION);
        BlzSetSpecialEffectTime(this.light, ORIGINAL_LIGHT_GATE_SECONDS);
        this.lightVisible = true;
      }
    }
    if (fighter.status.frozenFrames > 0) {
      BlzSetSpecialEffectColor(model, 155, 210, 255);
      BlzSetSpecialEffectAlpha(model, 255);
    } else {
      const shielded = fighter.shield.raised;
      BlzSetSpecialEffectColor(model, shielded ? 100 : 255, shielded ? 160 : 255, 255);
      BlzSetSpecialEffectAlpha(model, isIntangible(fighter) ? 140 : 255);
    }
  }

  destroy(): void {
    // DestroyEffect may defer teardown; turn the light off first.
    if (this.light !== undefined) {
      this.suppress(this.light);
      DestroyEffect(this.light);
    }
    // Every clip but the shown one is already parked, where its death animation plays out of view.
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    for (const model of this.clips) DestroyEffect(model);
    this.clips.length = 0;
    this.visible = undefined;
  }
}
