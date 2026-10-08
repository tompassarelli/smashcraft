import { WHITE_FIGHTER_MODELS } from "../assets/whiteFighterModels";
import { originalClip, originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import type { FighterPose } from "../presentation/fighterPose";
import { characterModelScale } from "../presentation/modelScale";
import { createWhiteGlowState, whiteGlowAlpha } from "../presentation/whiteGlow";
import type { Character } from "../sim/codes";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";
import { at } from "wisp/src/runtime/lookup";
import { stageFighterTint } from "../presentation/stageFighterTint";

export class BodyFlash {
  private readonly model: effect;
  private readonly state = createWhiteGlowState();
  private readonly placement = { x: 0.0, z: 0.0 };
  private shown = false;

  constructor(private readonly character: Character, private readonly origin: WorldOrigin) {
    this.model = AddSpecialEffect(WHITE_FIGHTER_MODELS[character] ?? "", origin.x, origin.y);
    BlzSetSpecialEffectAnimationBlendTime(this.model, 0.0);
    BlzSetSpecialEffectAnimation(this.model, "Stand");
    BlzSetSpecialEffectTimeScale(this.model, 0.0);
    hideEffect(this.model, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, pose: Readonly<FighterPose>, stage: number, frame: number, authoredLighting = true): void {
    const alpha = fighter === undefined ? 0 : whiteGlowAlpha(this.state, fighter, frame);
    const index = pose.clipIndex ?? originalClipNamed(this.character, pose.clipName);
    const clip = index === undefined ? undefined : originalClip(this.character, index);
    if (fighter === undefined || alpha === 0 || index === undefined || clip === undefined) {
      if (this.shown) hideEffect(this.model, this.origin);
      this.shown = false;
      return;
    }
    fitFighterPlacement(this.placement, fighter, stage);
    let seconds = Math.max(0.0, pose.clipTime);
    const duration = clip.endSeconds - clip.startSeconds;
    if (duration <= 0.0) seconds = 0.0;
    else if (clip.looping) seconds -= I2R(R2I(seconds / duration)) * duration;
    else seconds = Math.min(seconds, duration);
    BlzSetSpecialEffectTime(this.model, clip.startSeconds + seconds);
    BlzSetSpecialEffectYaw(this.model, facingYaw(fighterPoseFacing(fighter)));
    // A half-unit toward the camera prevents two coincident surfaces from flickering.
    placeEffect(this.model, this.origin.x + this.placement.x, this.origin.y - 0.5, this.origin.z + this.placement.z);
    BlzSetSpecialEffectScale(this.model, characterModelScale(fighter.character));
    BlzSetSpecialEffectAlpha(this.model, alpha);
    const tint = stageFighterTint(stage, authoredLighting);
    BlzSetSpecialEffectColor(this.model, tint[0], tint[1], tint[2]);
    this.shown = true;
  }

  destroy(): void {
    hideEffect(this.model, this.origin);
    DestroyEffect(this.model);
  }
}
