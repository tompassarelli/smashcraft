import { FighterAgencyForecast, type FighterAgency } from "../presentation/fighterAgency";
import type { Fighter } from "../sim/fighter";
import { hideEffect, type WorldOrigin } from "./effects";

/** A separate halo preserves the victim's elemental hitlag and ice colours. */
export class AgencyMarker {
  readonly forecast = new FighterAgencyForecast();
  private readonly halo: effect;
  private shown = false;

  constructor(private readonly origin: WorldOrigin) {
    this.halo = AddSpecialEffect("Abilities\\Spells\\Other\\GeneralAuraTarget\\GeneralAuraTarget.mdl", origin.x, origin.y);
    hideEffect(this.halo, origin);
  }

  present(fighter: Readonly<Fighter> | undefined, agency: FighterAgency): void {
    if (fighter === undefined || fighter.status.out || agency === "act") {
      this.hide();
      return;
    }
    this.shown = true;
    BlzSetSpecialEffectPosition(this.halo, this.origin.x + fighter.motion.x, this.origin.y, this.origin.z + fighter.motion.z + 5.0);
    BlzSetSpecialEffectScale(this.halo, 0.75);
    BlzSetSpecialEffectColor(this.halo, agency === "none" ? 255 : 80, agency === "none" ? 100 : 255, agency === "none" ? 40 : 150);
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
