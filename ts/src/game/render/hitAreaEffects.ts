import { f32 } from "wisp/src/sim/f32";
import { Character } from "../sim/codes";
import { createFighter, type Fighter } from "../sim/fighter";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { DISJOINT_MODELS, disjointNormals, hitAreaPose, specialAreaRegion, type HitAreaPose } from "../presentation/disjointCues";
import { type ParkedFlags, type WorldOrigin, facingYaw, parkOnce } from "./effects";

/** Lich's twelve-segment halo is the largest simultaneous strike set. */
export const HIT_AREA_EFFECT_CAPACITY = 12;

/** Contact accents are separate from cast cues: simultaneous regions each get one. */
export class HitAreaEffects {
  private readonly models: effect[] = [];
  private readonly styles;
  private readonly parked: ParkedFlags = [];
  private readonly region = emptyHitRegion();
  private readonly pose: HitAreaPose = { visible: false, x: 0.0, z: 0.0, scale: 1.0 };

  constructor(character: Character, private readonly origin: WorldOrigin) {
    this.styles = disjointNormals(createFighter(character, 0.0, 1));
    for (let index = 0; index < HIT_AREA_EFFECT_CAPACITY; index++) this.models.push(AddSpecialEffect(DISJOINT_MODELS[character] ?? DISJOINT_MODELS[0] ?? "", origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    for (let index = 0; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkOnce(model, this.origin, this.parked, index);
    }
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean): void {
    let shown = 0;
    if (fighter !== undefined && playing && !fighter.status.out) {
      const style = fighter.attack.style;
      const normal = style !== undefined && this.styles.includes(style);
      const count = normal ? authoredHitRegionCount(style, fighter.tuning.moves) : runningHeroSpecial(fighter)?.regions?.length ?? 1;
      for (let index = 0; index < count; index++) {
        const region = normal ? authoredHitRegion(this.region, fighter.character, style, fighter.attack.frame, fighter.attack.smashChargeFrames, index, fighter.tuning.moves) : specialAreaRegion(fighter, index);
        const pose = hitAreaPose(fighter, region, this.pose);
        if (!pose.visible) continue;
        const model = this.models[shown];
        if (model === undefined) break;
        this.parked[shown++] = false;
        BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.origin.y - 14.0, this.origin.z + pose.z);
        BlzSetSpecialEffectYaw(model, facingYaw(fighter.facing));
        const size = fighter.character === Character.lich ? f32(0.2) : 0.5;
        BlzSetSpecialEffectScale(model, f32(pose.scale * size));
        BlzSetSpecialEffectAlpha(model, 255);
        BlzSetSpecialEffectAnimation(model, "stand");
        // Hold a visible spell pose on every active tick, including a long hitstop.
        BlzSetSpecialEffectTime(model, f32(0.3));
        BlzSetSpecialEffectTimeScale(model, 0.0);
      }
    }
    for (let index = shown; index < this.models.length; index++) {
      const model = this.models[index];
      if (model !== undefined) parkOnce(model, this.origin, this.parked, index);
    }
  }

  destroy(): void {
    this.clear();
    for (const model of this.models) DestroyEffect(model);
    this.models.length = 0;
  }
}
