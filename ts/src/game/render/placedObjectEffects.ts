// Placed objects (sim/placedObjects.ts), one model per participant slot,
// created with the match. Presentation follows numerical state, so it can be
// reapplied after a restore without spawning another object.
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";

/** Serpent Ward, the only placed object: the classic model stands about 300 units tall. */
export const PLACED_OBJECT_MODEL = "Units\\Orc\\SerpentWard\\SerpentWard.mdx";
const MODEL_HEIGHT = 300.0;

export class PlacedObjectEffects {
  private readonly models: readonly effect[];
  private parked: ParkedFlags | undefined;

  constructor(private readonly origin: WorldOrigin) {
    this.models = PARTICIPANT_SLOTS.map(() => AddSpecialEffect(PLACED_OBJECT_MODEL, origin.x, origin.y));
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < this.models.length; slot++) this.hideSlot(slot);
  }

  hideSlot(slot: number): void {
    const model = this.models[slot];
    if (model === undefined) return;
    parkOnce(model, this.origin, (this.parked ??= []), slot);
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const model = this.models[slot];
    const { placed } = fighter;
    const spec = placed.spec;
    if (model === undefined) return;
    if (placed.life <= 0 || spec === undefined || fighter.status.out) {
      this.hideSlot(slot);
      return;
    }
    const parked = (this.parked ??= []);
    parked[slot] = false;
    const { x, y, z } = this.origin;
    BlzSetSpecialEffectPosition(model, x + placed.x, y, z + placed.z);
    BlzSetSpecialEffectYaw(model, placed.direction > 0 ? 0.0 : f32(3.14159274));
    BlzSetSpecialEffectScale(model, f32(spec.height / MODEL_HEIGHT));
    // A damaged ward fades toward half opacity as its durability runs out.
    BlzSetSpecialEffectAlpha(model, 128 + Math.floor(127 * Math.max(0.0, placed.durability) / spec.durability));
  }

  destroy(): void {
    for (const model of this.models) DestroyEffect(model);
  }
}
