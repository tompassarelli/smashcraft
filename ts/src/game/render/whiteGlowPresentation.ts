import { IMPACT_DUST_MODEL } from "../assets/impactAssetInfo";
import { fitFighterPlacement } from "../presentation/fighterPlacement";
import { characterModelScale } from "../presentation/modelScale";
import { createWhiteGlowState, whiteGlowAlpha } from "../presentation/whiteGlow";
import type { Fighter } from "../sim/fighter";
import { hideEffect, placeEffect, type WorldOrigin } from "./effects";

export class WhiteGlowPresentation {
  private readonly model: effect;
  private readonly state = createWhiteGlowState();
  private readonly placement = { x: 0.0, z: 0.0 };
  private shown = false;

  constructor(private readonly origin: WorldOrigin) {
    this.model = AddSpecialEffect(IMPACT_DUST_MODEL, origin.x, origin.y);
    BlzSetSpecialEffectAnimation(this.model, "Stand");
    BlzSetSpecialEffectTimeScale(this.model, 0.0);
    hideEffect(this.model, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, stage: number, frame: number): void {
    const alpha = fighter === undefined ? 0 : whiteGlowAlpha(this.state, fighter, frame);
    if (fighter === undefined || alpha === 0) {
      if (this.shown) hideEffect(this.model, this.origin);
      this.shown = false;
      return;
    }
    fitFighterPlacement(this.placement, fighter, stage);
    const scale = characterModelScale(fighter.character);
    // Vertex tint cannot brighten the body; the unshaded white gradient supplies the halo.
    placeEffect(this.model, this.origin.x + this.placement.x - 10.0 * scale, this.origin.y - 25.0, this.origin.z + this.placement.z + 12.0 * scale);
    BlzSetSpecialEffectScale(this.model, 3.0 * scale);
    BlzSetSpecialEffectAlpha(this.model, alpha);
    this.shown = true;
  }

  destroy(): void {
    hideEffect(this.model, this.origin);
    DestroyEffect(this.model);
  }
}
