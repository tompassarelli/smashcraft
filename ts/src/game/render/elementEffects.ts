// A hit's element on its victim (presentation/elementLooks.ts): one effect per
// element that has a victim look, per participant slot, created with the
// match. The victim shows its last hit's element through hitlag and hitstun,
// as Melee shows an element through hitlag; it follows numerical state, so a
// restore reapplies it without spawning anything.
import { PARTICIPANT_SLOTS } from "../input/participants";
import { ELEMENTS, elementLook } from "../presentation/elementLooks";
import { characterModelScale } from "../presentation/modelScale";
import type { Fighter } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";

/** Elements with a victim look, in table order; their effects sit at this index within a slot. */
const SHOWN = ELEMENTS.filter((element) => elementLook(element).victim !== undefined);

export class ElementEffects {
  /** A slot's effects at SHOWN.length times the slot. */
  private readonly models: readonly effect[];
  private parked: ParkedFlags | undefined;
  /** The hit serial each slot last restarted its effect for. */
  private readonly hitSerials: number[] = [0, 0, 0, 0];
  /** Effects sit just in front of the fighters. */
  private readonly front: number;

  constructor(private readonly origin: WorldOrigin) {
    this.front = origin.y - 10.0;
    this.models = PARTICIPANT_SLOTS.flatMap(() => SHOWN.map((element) => AddSpecialEffect(elementLook(element).victim ?? "", origin.x, origin.y)));
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < PARTICIPANT_SLOTS.length; slot++) this.hideSlot(slot);
  }

  hideSlot(slot: number): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < SHOWN.length; index++) {
      const model = this.models[slot * SHOWN.length + index];
      if (model !== undefined) parkOnce(model, this.origin, parked, slot * SHOWN.length + index);
    }
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const { launch, visuals } = fighter;
    const shown = !fighter.status.out && (launch.hitlag > 0 || launch.hitstun > 0) ? SHOWN.indexOf(visuals.hitElement) : -1;
    const parked = (this.parked ??= []);
    const scale = characterModelScale(fighter.character);
    for (let index = 0; index < SHOWN.length; index++) {
      const at = slot * SHOWN.length + index;
      const model = this.models[at];
      if (model === undefined) continue;
      if (index !== shown) {
        parkOnce(model, this.origin, parked, at);
        continue;
      }
      parked[at] = false;
      if (this.hitSerials[slot] !== visuals.hit) BlzSetSpecialEffectTime(model, 0.0);
      BlzSetSpecialEffectPosition(model, this.origin.x + fighter.motion.x, this.front, this.origin.z + fighter.motion.z + 45.0 * scale);
      BlzSetSpecialEffectScale(model, elementLook(visuals.hitElement).victimScale * scale);
      BlzSetSpecialEffectAlpha(model, 255);
    }
    this.hitSerials[slot] = visuals.hit;
  }

  setPaused(paused: boolean): void {
    for (const model of this.models) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  destroy(): void {
    for (const model of this.models) DestroyEffect(model);
  }
}
