// Placed objects (sim/placedObjects.ts), one model per participant slot,
// created with the match. Presentation follows numerical state, so it can be
// reapplied after a restore without spawning another object.
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "../sim/fighter";
import { heroDefinition } from "../sim/heroes/registry";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";

/** Serpent Ward, the default placed object: the classic model stands about 300 units tall. */
const PLACED_OBJECT_MODEL = "Units\\Orc\\SerpentWard\\SerpentWard.mdx";
const MODEL_HEIGHT = 300.0;
const DEFAULT_LOOK = { path: PLACED_OBJECT_MODEL, height: MODEL_HEIGHT, alpha: 255 };

export class PlacedObjectEffects {
  private readonly models: effect[];
  private readonly paths: string[];
  private parked: ParkedFlags | undefined;

  constructor(private readonly origin: WorldOrigin) {
    this.models = PARTICIPANT_SLOTS.map(() => AddSpecialEffect(PLACED_OBJECT_MODEL, origin.x, origin.y));
    this.paths = PARTICIPANT_SLOTS.map(() => PLACED_OBJECT_MODEL);
    this.clear();
  }

  /** The slot's model for the fighter's look, replaced only when the fighter's look differs. */
  private modelFor(slot: number, path: string): effect | undefined {
    const current = this.models[slot];
    if (current === undefined || this.paths[slot] === path) return current;
    DestroyEffect(current);
    const model = AddSpecialEffect(path, this.origin.x, this.origin.y);
    this.models[slot] = model;
    this.paths[slot] = path;
    // Created at the origin: the next hide must park it.
    if (this.parked !== undefined) this.parked[slot] = false;
    return model;
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
    const look = heroDefinition(fighter.character)?.presentation.placedModel ?? DEFAULT_LOOK;
    const model = this.modelFor(slot, look.path);
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
    BlzSetSpecialEffectScale(model, f32(spec.height / look.height));
    // A damaged object fades toward half its opacity as its durability runs out.
    const left = f32(Math.max(0.0, placed.durability) / spec.durability);
    const half = idiv(look.alpha, 2);
    BlzSetSpecialEffectAlpha(model, half + Math.floor(f32((look.alpha - half) * left)));
  }

  destroy(): void {
    for (const model of this.models) DestroyEffect(model);
  }
}
