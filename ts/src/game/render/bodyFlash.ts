import { WHITE_FIGHTER_MODELS } from "../assets/whiteFighterModels";
import { ARENA_CAMERA } from "../presentation/arenaCamera";
import { originalClip, originalClipNamed } from "../assets/fighterOriginalClipInfo";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import type { FighterPose } from "../presentation/fighterPose";
import { characterModelScale } from "../presentation/modelScale";
import { createWhiteGlowState, whiteGlowAlpha } from "../presentation/whiteGlow";
import type { Character } from "../sim/codes";
import { fighterPoseFacing } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import type { MatchCamera } from "../sim/matchCamera";
import { facingYaw, hideEffect, placeEffect, type WorldOrigin } from "./effects";
import { at } from "wisp/src/runtime/lookup";

const FLASH_LIFT = 8.0;

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

  /** Lifts the flash toward the shared match camera's eye: every client poses it alike, unlike its own native camera (#410). */
  present(fighter: Readonly<Fighter> | undefined, pose: Readonly<FighterPose>, stage: number, frame: number, camera: Readonly<MatchCamera>): void {
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
    const x = this.origin.x + this.placement.x, y = this.origin.y, z = this.origin.z + this.placement.z;
    const pitch = ARENA_CAMERA.angleOfAttack * (Math.PI / 180.0), yaw = ARENA_CAMERA.rotation * (Math.PI / 180.0);
    const distance = camera.distance;
    const towardX = this.origin.x + camera.x - Math.cos(yaw) * Math.cos(pitch) * distance - x;
    const towardY = this.origin.y - Math.sin(yaw) * Math.cos(pitch) * distance - y;
    const towardZ = this.origin.z + camera.z - Math.sin(pitch) * distance - z;
    const length = Math.sqrt(towardX * towardX + towardY * towardY + towardZ * towardZ);
    const lift = length > FLASH_LIFT * 2.0 ? FLASH_LIFT / length : 0.0;
    placeEffect(this.model, x + towardX * lift, y + towardY * lift, z + towardZ * lift);
    BlzSetSpecialEffectScale(this.model, characterModelScale(fighter.character) * (1.0 - lift));
    BlzSetSpecialEffectAlpha(this.model, alpha);
    BlzSetSpecialEffectColor(this.model, 255, 255, 255);
    this.shown = true;
  }

  destroy(): void {
    hideEffect(this.model, this.origin);
    DestroyEffect(this.model);
  }
}
