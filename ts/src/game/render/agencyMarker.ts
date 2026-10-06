import { FighterAgencyForecast, type FighterAgency } from "../presentation/fighterAgency";
import type { Fighter } from "../sim/fighter";
import { hideEffect, type WorldOrigin } from "./effects";
import { f32 } from "wisp/src/sim/f32";

/** A separate halo preserves the victim's elemental hitlag and ice colours. */
export class AgencyMarker {
  readonly forecast = new FighterAgencyForecast();
  private readonly halo: effect;
  private shown = false;

  constructor(private readonly origin: WorldOrigin) {
    this.halo = AddSpecialEffect("Abilities\\Spells\\Other\\GeneralAuraTarget\\GeneralAuraTarget.mdl", origin.x, origin.y);
    BlzSetSpecialEffectAnimationBlendTime(this.halo, 0.0);
    BlzSetSpecialEffectAnimation(this.halo, "Stand");
    BlzSetSpecialEffectTimeScale(this.halo, 0.0);
    BlzSetSpecialEffectTime(this.halo, 0.5);
    // The stock aura is one horizontal quad; face its front toward the side camera.
    BlzSetSpecialEffectRoll(this.halo, f32(Math.PI / 2.0));
    hideEffect(this.halo, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, agency: FighterAgency): void {
    if (fighter === undefined || fighter.status.out || agency === "act") {
      this.hide();
      return;
    }
    this.shown = true;
    // Keep the glow behind the body and clear of the floor, so hit colours stay readable.
    BlzSetSpecialEffectPosition(this.halo, this.origin.x + fighter.motion.x, this.origin.y + 40.0, this.origin.z + fighter.motion.z + 90.0);
    BlzSetSpecialEffectScale(this.halo, 1.75);
    BlzSetSpecialEffectAlpha(this.halo, 255);
    BlzSetSpecialEffectColor(this.halo, agency === "none" ? 255 : 0, agency === "none" ? 100 : 255, agency === "none" ? 40 : 0);
  }

  hide(): void {
    if (!this.shown) return;
    hideEffect(this.halo, this.origin);
    this.shown = false;
  }

  destroy(): void {
    hideEffect(this.halo, this.origin);
    DestroyEffect(this.halo);
  }
}
