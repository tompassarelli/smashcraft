// Placed objects (sim/placedObjects.ts), three models per participant slot,
// created with the match. Presentation follows numerical state, so it can be
// reapplied after a restore without spawning another object.
import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type Fighter, type PlacedObject, placedObject } from "../sim/fighter";
import { CompanionMode } from "../sim/heroSpecials";
import { heroDefinition } from "../sim/heroes/registry";
import { type ParkedFlags, type WorldOrigin, parkOnce, placeEffect } from "./effects";

/** Serpent Ward, the default placed object: the classic model stands about 300 units tall. */
const PLACED_OBJECT_MODEL = "Units\\Orc\\SerpentWard\\SerpentWard.mdx";
const MODEL_HEIGHT = 300.0;
const DEFAULT_LOOK = { path: PLACED_OBJECT_MODEL, height: MODEL_HEIGHT, alpha: 255 };

export class PlacedObjectEffects {
  private readonly models: effect[];
  private readonly paths: string[];
  /** A partner's playing animation (0 stand, 1 walk, 2 attack) and its last x, by slot. */
  private readonly anims: number[] = [];
  private attackStarts: number[] | undefined;
  private readonly lastX: number[] = [];
  private parked: ParkedFlags | undefined;

  constructor(private readonly origin: WorldOrigin) {
    this.models = [];
    this.paths = [];
    for (const slot of PARTICIPANT_SLOTS) for (let animal = 0; animal < 3; animal++) {
      this.models.push(AddSpecialEffect(PLACED_OBJECT_MODEL, origin.x, origin.y));
      this.paths.push(PLACED_OBJECT_MODEL);
    }
    this.clear();
  }

  /** The slot's model for the fighter's look, replaced only when the fighter's look differs. */
  private modelFor(slot: number, path: string): effect | undefined {
    const current = this.models[slot];
    if (current === undefined || this.paths[slot] === path) return current;
    DestroyEffect(current);
    const model = AddSpecialEffect(path, this.origin.x, this.origin.y);
    BlzSetSpecialEffectAnimationBlendTime(model, 0.0);
    this.models[slot] = model;
    this.paths[slot] = path;
    // Created at the origin: the next hide must park it.
    if (this.parked !== undefined) this.parked[slot] = false;
    return model;
  }

  clear(): void {
    for (let slot = 0; slot < this.models.length; slot++) this.hideModel(slot);
  }

  hideSlot(slot: number): void {
    for (let animal = 0; animal < 3; animal++) this.hideModel(slot * 3 + animal);
  }

  private hideModel(slot: number): void {
    const model = this.models[slot];
    if (model === undefined) return;
    parkOnce(model, this.origin, (this.parked ??= []), slot);
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    for (let animal = 0; animal < 3; animal++) {
      if (animal > fighter.pack.length) this.hideModel(slot * 3 + animal);
      else this.presentAnimal(fighter, placedObject(fighter, animal), slot * 3 + animal);
    }
  }

  private presentAnimal(fighter: Readonly<Fighter>, placed: Readonly<PlacedObject>, slot: number): void {
    const look = placed.spec?.model ?? heroDefinition(fighter.character)?.presentation.placedModel ?? DEFAULT_LOOK;
    const model = this.modelFor(slot, look.path);
    const spec = placed.spec;
    if (model === undefined) return;
    if (placed.life <= 0 || spec === undefined || fighter.status.out) {
      this.hideModel(slot);
      return;
    }
    const parked = (this.parked ??= []);
    parked[slot] = false;
    const { x, y, z } = this.origin;
    placeEffect(model, x + placed.x, y, z + placed.z);
    BlzSetSpecialEffectYaw(model, placed.direction > 0 ? 0.0 : f32(3.14159274));
    if (spec.companion !== undefined) this.animate(model, slot, placed);
    BlzSetSpecialEffectScale(model, f32(spec.height / look.height));
    // A damaged object fades toward half its opacity as its durability runs out.
    const left = f32(Math.max(0.0, placed.durability) / spec.durability);
    const half = idiv(look.alpha, 2);
    BlzSetSpecialEffectAlpha(model, half + Math.floor(f32((look.alpha - half) * left)));
  }

  /** Keep the attack's windup and follow-through visible; the contact window alone cuts off the stock animation. */
  private animate(model: effect, slot: number, placed: Readonly<PlacedObject>): void {
    const { x, mode } = placed;
    const partner = placed.spec?.companion;
    let attackStart = -1;
    let pitch = 0.0;
    let speed = 1.0;
    if (partner !== undefined && mode === CompanionMode.lunge) {
      if (partner.behavior === "sentry") {
        for (const fire of partner.volleyFrames ?? []) {
          if (placed.modeFrame >= fire - 4 && placed.modeFrame < fire + 4) {
            attackStart = placed.age - placed.modeFrame + fire;
            pitch = placed.modeFrame < fire ? f32(-0.2) : 0.0;
            speed = 4.0;
          }
        }
      } else {
        attackStart = placed.age - placed.modeFrame;
        speed = f32(80.0 / (partner.lungeStartup + partner.lungeActive + partner.lungeRecovery));
        if (placed.modeFrame <= partner.lungeStartup) pitch = f32(-0.25);
        else if (placed.modeFrame <= partner.lungeStartup + partner.lungeActive) pitch = partner.behavior === "flying" ? f32(0.7) : f32(0.15);
      }
    } else if (mode === CompanionMode.follow) {
      for (const fire of placed.spec?.fireAges ?? []) {
        if (placed.age >= fire && placed.age < fire + 8) {
          attackStart = fire;
          speed = 4.0;
        }
      }
    }
    BlzSetSpecialEffectPitch(model, pitch);
    BlzSetSpecialEffectTimeScale(model, speed);
    const moved = this.lastX[slot] !== undefined && this.lastX[slot] !== x;
    this.lastX[slot] = x;
    const anim = attackStart >= 0 ? 2 : moved ? 1 : 0;
    const attackStarts = (this.attackStarts ??= []);
    if (this.anims[slot] === anim && attackStarts[slot] === attackStart) return;
    this.anims[slot] = anim;
    attackStarts[slot] = attackStart;
    BlzPlaySpecialEffect(model, anim === 2 ? ANIM_TYPE_ATTACK : anim === 1 ? ANIM_TYPE_WALK : ANIM_TYPE_STAND);
  }

  destroy(): void {
    for (const model of this.models) DestroyEffect(model);
  }
}
