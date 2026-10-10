import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type BearFeedbackCursor, BEAR_IMPACT_MODEL, BEAR_ROAR_MODEL, advanceBearFeedback, bearState, createBearFeedbackCursor } from "../presentation/bearFeedback";
import type { Fighter } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, parkOnce, placeEffect } from "./effects";
import { SoundBank, SoundKind } from "./soundBank";

interface BearFeedbackSlot { roar: effect; impact: effect; cursor: BearFeedbackCursor }

export class BearFeedback {
  private readonly slots: readonly BearFeedbackSlot[];
  private readonly parked: ParkedFlags = [];
  private readonly sounds = new SoundBank();

  constructor(private readonly origin: WorldOrigin) {
    this.sounds.prepare(SoundKind.label, ["BattleRoar", "MetalHeavySliceFlesh"]);
    this.slots = PARTICIPANT_SLOTS.map(() => ({ roar: AddSpecialEffect(BEAR_ROAR_MODEL, origin.x, origin.y), impact: AddSpecialEffect(BEAR_IMPACT_MODEL, origin.x, origin.y), cursor: createBearFeedbackCursor() }));
    for (const slot of this.slots) {
      BlzSetSpecialEffectAnimation(slot.roar, "Stand");
      BlzSetSpecialEffectTimeScale(slot.roar, 0.0);
      BlzSetSpecialEffectTime(slot.roar, f32(0.5));
    }
    this.clear();
  }

  clear(): void {
    for (const index of PARTICIPANT_SLOTS) {
      this.hide(index);
      const slot = this.slots[index];
      if (slot !== undefined) slot.cursor = createBearFeedbackCursor();
    }
  }

  hide(index: number): void {
    const slot = this.slots[index];
    if (slot === undefined) return;
    parkOnce(slot.roar, this.origin, this.parked, index * 2);
    parkOnce(slot.impact, this.origin, this.parked, index * 2 + 1);
  }

  confirm(frame: number, fighter: Readonly<Fighter>, index: number): void {
    const slot = this.slots[index];
    if (slot === undefined) return;
    const cues = advanceBearFeedback(slot.cursor, fighter, frame);
    const play = (label: string): void => {
      this.sounds.playAt(SoundKind.label, label, this.origin.x + fighter.placed.x, this.origin.y, this.origin.z + fighter.placed.z, 127);
    };
    if (cues.roar) play("BattleRoar");
    if (cues.hit) {
      play("MetalHeavySliceFlesh");
      BlzSetSpecialEffectAnimation(slot.impact, "Birth");
      BlzSetSpecialEffectTime(slot.impact, 0.0);
    }
  }

  present(fighter: Readonly<Fighter>, index: number): void {
    const slot = this.slots[index];
    const state = bearState(fighter);
    if (slot === undefined) return;
    if (state === undefined) { this.hide(index); return; }
    const bear = fighter.placed;
    const x = this.origin.x + bear.x;
    const z = this.origin.z + bear.z;
    if (state === "CHARGING") {
      this.parked[index * 2] = false;
      placeEffect(slot.roar, x, this.origin.y - 12.0, z + 95.0);
      BlzSetSpecialEffectScale(slot.roar, 2.5);
      BlzSetSpecialEffectAlpha(slot.roar, 255);
    } else parkOnce(slot.roar, this.origin, this.parked, index * 2);
    if (slot.cursor.frame - slot.cursor.impactFrame < 14) {
      this.parked[index * 2 + 1] = false;
      placeEffect(slot.impact, this.origin.x + slot.cursor.impactX, this.origin.y - 15.0, this.origin.z + slot.cursor.impactZ);
      BlzSetSpecialEffectScale(slot.impact, 1.5);
      BlzSetSpecialEffectAlpha(slot.impact, 255);
    } else parkOnce(slot.impact, this.origin, this.parked, index * 2 + 1);
  }

  destroy(): void {
    this.clear();
    for (const slot of this.slots) {
      DestroyEffect(slot.roar);
      DestroyEffect(slot.impact);
    }
  }
}
