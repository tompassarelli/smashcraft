// Special-move effects per participant slot: the bear summon, hippogryph,
// Illidan's aura, wing trail, the drain flash, immolation flames and mana-burn
// hand. Handles are created with the match; numerical state owns every
// contact. Animated particles restart only from confirmed frames.
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL } from "../assets/impactAssetInfo";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type ImpactPresentationCursor, consumeImpactFrame, createImpactPresentationCursor, resetImpactPresentationCursor } from "../presentation/impactEvents";
import {
  STATIC_AURA,
  STATIC_DRAIN_FLASH,
  STATIC_WING_TRAIL,
  type SpecialEffectState,
  type StaticSpecialPose,
  projectSpecialEffect,
} from "../presentation/specialEffectState";
import { SUMMON_BEAR } from "../presentation/summonClipInfo";
import { type SummonState, projectBear } from "../presentation/summonState";
import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusKind, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_MANA_BURN_STARTUP, FLAME_CRASH_BURST_LAST, FLAME_CRASH_LANDING_FORM } from "../sim/specials";
import { type ParkedFlags, STOCK_MODELS, type WorldOrigin, facingYaw, parkOnce, placeEffect } from "./effects";
import { characterModelScale } from "../presentation/modelScale";
import { IMMOLATE_SOUNDS } from "../presentation/elementLooks";
import { SummonPresentation } from "./summonPresentation";
import { bindPrototype } from "../../platform/rebind";

interface SpecialSlot {
  readonly bear: SummonPresentation;
  readonly aura: effect;
  readonly felFlames: effect;
  readonly manaHand: effect;
  readonly wingTrail: effect;
  readonly drainFlash: effect;
  readonly silence: effect;
  /** Event identity is (match, completed frame, fighter, action); the cursor rejects replayed frames before any restart. */
  readonly cursor: ImpactPresentationCursor;
  previousSpecial: SpecialAction;
  previousSpecialFrame: number;
  /** Immolation's fire loop while it burns; made on first use, so a reloaded slot gains one. */
  immolationLoop?: sound | undefined;
}

/** A slot's effects in its parked flags, after eight times the slot. */
const AURA = 1;
const FEL_FLAMES = 2;
const MANA_HAND = 3;
const WING_TRAIL = 4;
const DRAIN_FLASH = 5;
const SILENCE = 7;
const SLOT_EFFECTS = 8;

export class SpecialEffects {
  private readonly slots: readonly SpecialSlot[];
  private parked: ParkedFlags | undefined;
  /** Effects sit just in front of the fighters. */
  private readonly front: number;

  constructor(private readonly origin: WorldOrigin) {
    const { x, y } = origin;
    this.front = y - 8.0;
    this.slots = PARTICIPANT_SLOTS.map((participant) => {
      const cursor = createImpactPresentationCursor();
      const bear = new SummonPresentation(SUMMON_BEAR, origin);
      const aura = AddSpecialEffect(IMPACT_ROLL_MODEL, x, y);
      const felFlames = AddSpecialEffect(STOCK_MODELS.immolationTarget, x, y);
      const manaHand = AddSpecialEffect(STOCK_MODELS.manaBurnTarget, x, y);
      const wingTrail = AddSpecialEffect(IMPACT_DUST_MODEL, x, y);
      const drainFlash = AddSpecialEffect(IMPACT_TECH_MODEL, x, y);
      const silence = AddSpecialEffect(STOCK_MODELS.silenceTarget, x, y);
      BlzSetSpecialEffectTimeScale(aura, 0.0);
      BlzSetSpecialEffectTimeScale(wingTrail, 0.0);
      BlzSetSpecialEffectTimeScale(drainFlash, 0.0);
      return {
        bear, aura, felFlames, manaHand, wingTrail, drainFlash, silence, cursor,
        previousSpecial: SpecialAction.none, previousSpecialFrame: 0,
      };
    });
    this.clear();
  }

  /** Bind retained summon pools to the reloaded bundle. */
  bindNestedCode(): void {
    for (const slot of this.slots) bindPrototype(slot.bear, SummonPresentation.prototype);
  }

  clear(): void {
    this.slots.forEach((slot, index) => {
      resetImpactPresentationCursor(slot.cursor);
      slot.bear.hide();
      // In flag order.
      [slot.aura, slot.felFlames, slot.manaHand, slot.wingTrail, slot.drainFlash, slot.silence].forEach((model, effect) => this.park(model, index, effect));
      slot.previousSpecial = SpecialAction.none;
      slot.previousSpecialFrame = 0;
      this.releaseImmolationLoop(slot);
    });
  }

  private park(model: effect, slot: number, effect: number): void {
    parkOnce(model, this.origin, (this.parked ??= []), SLOT_EFFECTS * slot + effect);
  }

  private releaseImmolationLoop(slot: SpecialSlot): void {
    if (slot.immolationLoop === undefined) return;
    StopSound(slot.immolationLoop, false, false);
    KillSoundWhenDone(slot.immolationLoop);
    slot.immolationLoop = undefined;
  }

  private placed(slot: number, effect: number): void {
    (this.parked ??= [])[SLOT_EFFECTS * slot + effect] = false;
  }

  setPaused(paused: boolean): void {
    const scale = paused ? 0.0 : 1.0;
    for (const { felFlames, manaHand, silence } of this.slots) {
      BlzSetSpecialEffectTimeScale(felFlames, scale);
      BlzSetSpecialEffectTimeScale(manaHand, scale);
      BlzSetSpecialEffectTimeScale(silence, scale);
    }
  }

  /** Shows a particle at an offset from the fighter, in its model's scale, frozen while the fighter is. */
  private show(model: effect, slot: number, effect: number, fighter: Readonly<Fighter>, x: number, z: number, size: number): void {
    this.placed(slot, effect);
    const scale = characterModelScale(fighter.character);
    placeEffect(model, this.origin.x + fighter.motion.x + x * scale, this.front, this.origin.z + fighter.motion.z + z * scale);
    BlzSetSpecialEffectScale(model, size * scale);
    BlzSetSpecialEffectAlpha(model, 255);
    BlzSetSpecialEffectTimeScale(model, fighter.launch.hitlag > 0 || fighter.status.frozenFrames > 0 ? 0.0 : 1.0);
  }

  /** Mana Burn's stun (#116) burns over the stunned fighter's head; it never overlaps the fighter's own cast. */
  private showStun(fighter: Readonly<Fighter>, index: number, manaHand: effect): void {
    if (fighter.status.condition === HeroStatusKind.stun) this.show(manaHand, index, MANA_HAND, fighter, 0.0, 175.0, f32(0.6));
    else this.park(manaHand, index, MANA_HAND);
  }

  /** Immolation's cast, loop and decay sounds, from confirmed frames only, so a rollback never replays one. */
  private presentImmolationSound(fighter: Readonly<Fighter>, slot: SpecialSlot, lit: boolean, out: boolean): void {
    const x = this.origin.x + fighter.motion.x;
    const z = this.origin.z + fighter.motion.z;
    const play = (label: string): void => {
      const cue = CreateSoundFromLabel(label, false, true, true, 10000, 10000);
      SetSoundPosition(cue, x, this.origin.y, z);
      StartSound(cue);
      KillSoundWhenDone(cue);
    };
    if (lit) {
      play(IMMOLATE_SOUNDS.start);
      const loop = (slot.immolationLoop ??= CreateSoundFromLabel(IMMOLATE_SOUNDS.loop, true, true, true, 10000, 10000));
      SetSoundPosition(loop, x, this.origin.y, z);
      StartSound(loop);
    } else if (out) {
      if (slot.immolationLoop !== undefined) StopSound(slot.immolationLoop, false, true);
      play(IMMOLATE_SOUNDS.end);
    } else if (slot.immolationLoop !== undefined && fighter.special.action === SpecialAction.demonHunterImmolate) {
      SetSoundPosition(slot.immolationLoop, x, this.origin.y, z);
    }
  }

  private presentConfirmedParticles(fighter: Readonly<Fighter>, slot: SpecialSlot, index: number): void {
    const { action, frame } = fighter.special;
    const entered = action !== slot.previousSpecial || frame < slot.previousSpecialFrame;
    const { felFlames, manaHand } = slot;
    if (!fighter.status.out && fighter.status.condition === HeroStatusKind.silence) this.show(slot.silence, index, SILENCE, fighter, 0.0, 150.0, f32(0.7));
    else this.park(slot.silence, index, SILENCE);
    if (fighter.character === Character.demonHunter && !fighter.status.out) {
      if (entered && action === SpecialAction.demonHunterImmolate) BlzSetSpecialEffectTime(felFlames, 0.0);
      else if (entered && action === SpecialAction.demonHunterManaBurn) BlzSetSpecialEffectTime(manaHand, 0.0);
      // The fel fire burns through the whole action and flares over its strike frames.
      const immolating = action === SpecialAction.demonHunterImmolate;
      // Flame Crash's landing flares the same fire over its burst.
      const crashBurst = fighter.special.form === FLAME_CRASH_LANDING_FORM && frame <= FLAME_CRASH_BURST_LAST;
      const striking = immolating && (fighter.special.form === 0 ? frame >= DEMONHUNTER_IMMOLATE_STARTUP && frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE : crashBurst);
      this.presentImmolationSound(fighter, slot, entered && immolating, slot.previousSpecial === SpecialAction.demonHunterImmolate && !immolating);
      if (immolating) this.show(felFlames, index, FEL_FLAMES, fighter, 0.0, 25.0, striking ? f32(2.0) : f32(1.35));
      else this.park(felFlames, index, FEL_FLAMES);
      if (action === SpecialAction.demonHunterManaBurn && frame <= DEMONHUNTER_MANA_BURN_STARTUP) this.show(manaHand, index, MANA_HAND, fighter, fighter.facing * 45.0, 90.0, 0.75);
      else this.showStun(fighter, index, manaHand);
    } else {
      this.presentImmolationSound(fighter, slot, false, slot.previousSpecial === SpecialAction.demonHunterImmolate);
      this.park(felFlames, index, FEL_FLAMES);
      if (fighter.status.out) this.park(manaHand, index, MANA_HAND);
      else this.showStun(fighter, index, manaHand);
    }
    slot.previousSpecial = action;
    slot.previousSpecialFrame = frame;
  }

  private applyStatic(model: effect, slot: number, effect: number, pose: Readonly<StaticSpecialPose>): void {
    if (!pose.visible) {
      this.park(model, slot, effect);
      return;
    }
    this.placed(slot, effect);
    placeEffect(model, this.origin.x + pose.x, this.front, this.origin.z + pose.z);
    BlzSetSpecialEffectColor(model, pose.red, pose.green, pose.blue);
    BlzSetSpecialEffectScale(model, pose.scale);
    BlzSetSpecialEffectAlpha(model, pose.alpha);
  }

  /** Effects that follow completed state directly, speculative or not; undefined hides them. */
  presentStatic(state: Readonly<SpecialEffectState>, fighter: Readonly<Fighter> | undefined, slot: number): void {
    const effects = this.slots[slot];
    if (effects === undefined) return;
    if (fighter === undefined) {
      this.park(effects.aura, slot, AURA);
      this.park(effects.wingTrail, slot, WING_TRAIL);
      this.park(effects.drainFlash, slot, DRAIN_FLASH);
      this.park(effects.felFlames, slot, FEL_FLAMES);
      this.park(effects.manaHand, slot, MANA_HAND);
      this.park(effects.silence, slot, SILENCE);
      this.releaseImmolationLoop(effects);
      return;
    }
    this.applyStatic(effects.aura, slot, AURA, projectSpecialEffect(state, fighter, slot, STATIC_AURA));
    this.applyStatic(effects.wingTrail, slot, WING_TRAIL, projectSpecialEffect(state, fighter, slot, STATIC_WING_TRAIL));
    this.applyStatic(effects.drainFlash, slot, DRAIN_FLASH, projectSpecialEffect(state, fighter, slot, STATIC_DRAIN_FLASH));
  }

  presentSummons(state: Readonly<SummonState>, fighter: Readonly<Fighter> | undefined, slot: number): void {
    this.slots[slot]?.bear.present(projectBear(state, fighter, slot));
  }

  /** Animated effects that restart on an event: once per confirmed frame, never from a speculative one. */
  presentConfirmedAnimated(frame: number, fighter: Readonly<Fighter>, slot: number): void {
    const effects = this.slots[slot];
    if (effects === undefined || !consumeImpactFrame(effects.cursor, frame)) return;
    this.presentConfirmedParticles(fighter, effects, slot);
  }

  destroy(): void {
    for (const slot of this.slots) {
      this.releaseImmolationLoop(slot);
      slot.bear.destroy();
      for (const model of [slot.aura, slot.felFlames, slot.manaHand, slot.wingTrail, slot.drainFlash, slot.silence]) DestroyEffect(model);
    }
  }
}
