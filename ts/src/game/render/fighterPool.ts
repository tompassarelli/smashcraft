// A fighter drawn from a pool of original-model clips: every clip has its own
// effect, all frozen, and presenting shows the selected one at the pose's clip
// time. Allocation and destruction belong to the synchronized character and
// match lifecycle; present and hide change only these handles. Entering or
// leaving a pain pose keeps the previous clip frozen over the new one while
// it dissolves (presentation/damageBlend.ts).
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
import { type WorldOrigin, facingYaw, hideEffect, placeEffect } from "./effects";
import { damageTint } from "../presentation/hitPresentation";
import { characterModelScale } from "../presentation/modelScale";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import { outgoingPoseAlpha, poseBlendFrames } from "../presentation/damageBlend";

export class FighterPoolPresentation {
  private readonly clips: effect[] = [];
  private readonly light: effect | undefined;
  private readonly scale: number;
  private lightVisible = false;
  private visible: number | undefined;
  private yaw: number | undefined;
  private seconds: number | undefined;
  private red: number | undefined;
  private green: number | undefined;
  private blue: number | undefined;
  private alpha: number | undefined;
  private lightYaw: number | undefined;
  /** The dissolving previous clip, the simulation frame it started and its length. */
  private blendFrom: number | undefined;
  private blendStart = 0;
  private blendFrames = 0;
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

  private endBlend(): void {
    const from = this.blendFrom === undefined ? undefined : this.clips[this.blendFrom];
    if (from !== undefined && this.blendFrom !== this.visible) hideEffect(from, this.origin);
    this.blendFrom = undefined;
  }

  hide(): void {
    this.endBlend();
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    this.visible = undefined;
    if (this.light !== undefined && this.lightVisible) {
      this.suppress(this.light);
      this.lightVisible = false;
    }
  }

  /** `frame` is the presented simulation frame, which times pose blends. */
  present(fighter: Readonly<Fighter>, pose: Readonly<FighterPose>, stage: number, frame: number): void {
    if (this.clips.length === 0) return;
    const index = pose.clipIndex ?? originalClipNamed(this.character, pose.clipName);
    const model = index === undefined ? undefined : this.clips[index];
    const clip = index === undefined ? undefined : originalClip(this.character, index);
    if (fighter.status.out || index === undefined || model === undefined || clip === undefined) {
      if (!fighter.status.out) this.missingSelections++;
      this.hide();
      return;
    }
    const changed = this.visible !== index;
    if (changed) {
      const previous = this.visible;
      const frames = previous === undefined ? 0 : poseBlendFrames(fighter, previous, index);
      // A clip returning while it dissolves is simply drawn again.
      if (this.blendFrom === index) this.blendFrom = undefined;
      this.endBlend();
      const shown = previous === undefined ? undefined : this.clips[previous];
      // The outgoing clip stays frozen at its last drawn pose and yaw.
      if (frames > 0) {
        this.blendFrom = previous;
        this.blendStart = frame;
        this.blendFrames = frames;
      } else if (shown !== undefined) hideEffect(shown, this.origin);
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
    placeEffect(model, x, y, z);
    if (changed || this.yaw !== yaw) {
      BlzSetSpecialEffectYaw(model, yaw);
      this.yaw = yaw;
    }
    if (changed) BlzSetSpecialEffectScale(model, this.scale);
    if (changed || this.seconds !== seconds) {
      BlzSetSpecialEffectTime(model, seconds);
      this.seconds = seconds;
    }
    if (this.light !== undefined) {
      placeEffect(this.light, x, y, z);
      if (this.lightYaw !== yaw) {
        BlzSetSpecialEffectYaw(this.light, yaw);
        this.lightYaw = yaw;
      }
      if (!this.lightVisible) {
        BlzSetSpecialEffectAnimation(this.light, ORIGINAL_LIGHT_ACTIVE_ANIMATION);
        BlzSetSpecialEffectTime(this.light, ORIGINAL_LIGHT_GATE_SECONDS);
        this.lightVisible = true;
      }
    }
    const tint = damageTint(fighter);
    let red = 255;
    let green = 255;
    let blue = 255;
    let alpha = 255;
    if (fighter.status.frozenFrames > 0) {
      red = 155;
      green = 210;
    } else if (tint !== undefined) {
      red = tint.red;
      green = tint.green;
      blue = tint.blue;
    } else {
      const shielded = fighter.shield.raised;
      if (shielded) {
        red = 100;
        green = 160;
      }
      if (isIntangible(fighter)) alpha = 140;
    }
    if (changed || this.red !== red || this.green !== green || this.blue !== blue) {
      BlzSetSpecialEffectColor(model, red, green, blue);
      this.red = red;
      this.green = green;
      this.blue = blue;
    }
    if (changed || this.alpha !== alpha) {
      BlzSetSpecialEffectAlpha(model, alpha);
      this.alpha = alpha;
    }
    const from = this.blendFrom === undefined ? undefined : this.clips[this.blendFrom];
    if (from === undefined) return;
    const fade = outgoingPoseAlpha(frame - this.blendStart, this.blendFrames);
    if (fade <= 0) {
      this.endBlend();
      return;
    }
    BlzSetSpecialEffectPosition(from, x, y, z);
    BlzSetSpecialEffectScale(from, this.scale);
    BlzSetSpecialEffectColor(from, red, green, blue);
    BlzSetSpecialEffectAlpha(from, fade);
  }

  destroy(): void {
    // DestroyEffect may defer teardown; turn the light off first.
    if (this.light !== undefined) {
      this.suppress(this.light);
      DestroyEffect(this.light);
    }
    // Every clip but the shown one is already parked, where its death animation plays out of view.
    this.endBlend();
    const shown = this.visible === undefined ? undefined : this.clips[this.visible];
    if (shown !== undefined) hideEffect(shown, this.origin);
    for (const model of this.clips) DestroyEffect(model);
    this.clips.length = 0;
    this.visible = undefined;
  }
}
