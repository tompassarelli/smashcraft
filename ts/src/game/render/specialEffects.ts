// Special-move effects per participant slot: the bear summon, hippogryph,
// Illidan's aura, wing trail, parry flash, immolation flames and mana-burn
// hand. Handles are created with the match; numerical state owns every
// contact. Animated particles restart only from confirmed frames.
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL } from "../assets/impactAssetInfo";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type ImpactPresentationCursor, consumeImpactFrame, createImpactPresentationCursor, resetImpactPresentationCursor } from "../presentation/impactEvents";
import {
  STATIC_AURA,
  STATIC_PARRY_FLASH,
  STATIC_WING_TRAIL,
  type SpecialEffectState,
  type StaticSpecialPose,
  projectSpecialEffect,
} from "../presentation/specialEffectState";
import { SUMMON_BEAR } from "../presentation/summonClipInfo";
import { type SummonState, projectBear } from "../presentation/summonState";
import { f32 } from "wisp/src/sim/f32";
import { Character, HeroStatusKind, HippogryphKind, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_MANA_BURN_STARTUP } from "../sim/specials";
import { type ParkedFlags, STOCK_MODELS, type WorldOrigin, facingYaw, parkOnce } from "./effects";
import { characterModelScale } from "../presentation/modelScale";
import { IMMOLATE_SOUNDS } from "../presentation/elementLooks";
import { SummonPresentation } from "./summonPresentation";
import { bindPrototype } from "../../platform/rebind";

interface SpecialSlot {
  readonly bear: SummonPresentation;
  readonly hippogryph: effect;
  readonly aura: effect;
  readonly felFlames: effect;
  readonly manaHand: effect;
  readonly wingTrail: effect;
  readonly parryFlash: effect;
  /** Event identity is (match, completed frame, fighter, action); the cursor rejects replayed frames before any restart. */
  readonly cursor: ImpactPresentationCursor;
  previousSpecial: SpecialAction;
  previousSpecialFrame: number;
  previousHippogryphLife: number;
  previousHippogryphKind: HippogryphKind;
  /** Immolation's fire loop while it burns; made on first use, so a reloaded slot gains one. */
  immolationLoop?: sound | undefined;
}

/** The hippogryph flies while swooping or carrying, stands on its perch and attacks while diving or flying on. */
function hippogryphAnimation(kind: HippogryphKind): string {
  return kind === HippogryphKind.perch ? "stand" : kind === HippogryphKind.dive || kind === HippogryphKind.released ? "attack" : "walk";
}

/** A slot's effects in its parked flags, after six times the slot. */
const HIPPOGRYPH = 0;
const AURA = 1;
const FEL_FLAMES = 2;
const MANA_HAND = 3;
const WING_TRAIL = 4;
const PARRY_FLASH = 5;
const SLOT_EFFECTS = 6;

export class SpecialEffects {
  private readonly slots: readonly SpecialSlot[];
  private parked: ParkedFlags | undefined;
  /** Effects sit just in front of the fighters. */
  private readonly front: number;

  constructor(private readonly origin: WorldOrigin) {
    const { x, y } = origin;
    this.front = y - 8.0;
    this.slots = PARTICIPANT_SLOTS.map(() => {
      const cursor = createImpactPresentationCursor();
      const bear = new SummonPresentation(SUMMON_BEAR, origin);
      const hippogryph = AddSpecialEffect(STOCK_MODELS.hippogryph, x, y);
      const aura = AddSpecialEffect(IMPACT_ROLL_MODEL, x, y);
      const felFlames = AddSpecialEffect(STOCK_MODELS.immolationTarget, x, y);
      const manaHand = AddSpecialEffect(STOCK_MODELS.manaBurnTarget, x, y);
      const wingTrail = AddSpecialEffect(IMPACT_DUST_MODEL, x, y);
      const parryFlash = AddSpecialEffect(IMPACT_TECH_MODEL, x, y);
      BlzSetSpecialEffectTimeScale(aura, 0.0);
      BlzSetSpecialEffectTimeScale(wingTrail, 0.0);
      BlzSetSpecialEffectTimeScale(parryFlash, 0.0);
      BlzSetSpecialEffectAnimationBlendTime(hippogryph, 0.0);
      return {
        bear, hippogryph, aura, felFlames, manaHand, wingTrail, parryFlash, cursor,
        previousSpecial: SpecialAction.none, previousSpecialFrame: 0, previousHippogryphLife: 0, previousHippogryphKind: HippogryphKind.none,
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
      [slot.hippogryph, slot.aura, slot.felFlames, slot.manaHand, slot.wingTrail, slot.parryFlash].forEach((model, effect) => this.park(model, index, effect));
      slot.previousSpecial = SpecialAction.none;
      slot.previousSpecialFrame = 0;
      slot.previousHippogryphLife = 0;
      if (slot.immolationLoop !== undefined) StopSound(slot.immolationLoop, false, false);
      slot.previousHippogryphKind = HippogryphKind.none;
    });
  }

  private park(model: effect, slot: number, effect: number): void {
    parkOnce(model, this.origin, (this.parked ??= []), SLOT_EFFECTS * slot + effect);
  }

  private placed(slot: number, effect: number): void {
    (this.parked ??= [])[SLOT_EFFECTS * slot + effect] = false;
  }

  setPaused(paused: boolean): void {
    const scale = paused ? 0.0 : 1.0;
    for (const { hippogryph, felFlames, manaHand } of this.slots) {
      BlzSetSpecialEffectTimeScale(hippogryph, scale);
      BlzSetSpecialEffectTimeScale(felFlames, scale);
      BlzSetSpecialEffectTimeScale(manaHand, scale);
    }
  }

  /** Shows a particle at an offset from the fighter, in its model's scale, frozen while the fighter is. */
  private show(model: effect, slot: number, effect: number, fighter: Readonly<Fighter>, x: number, z: number, size: number): void {
    this.placed(slot, effect);
    const scale = characterModelScale(fighter.character);
    BlzSetSpecialEffectPosition(model, this.origin.x + fighter.motion.x + x * scale, this.front, this.origin.z + fighter.motion.z + z * scale);
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
    if (fighter.character === Character.demonHunter && !fighter.status.out) {
      if (entered && action === SpecialAction.demonHunterImmolate) BlzSetSpecialEffectTime(felFlames, 0.0);
      else if (entered && action === SpecialAction.demonHunterManaBurn) BlzSetSpecialEffectTime(manaHand, 0.0);
      // The fel fire burns through the whole action and flares over its strike frames.
      const immolating = action === SpecialAction.demonHunterImmolate;
      const striking = immolating && frame >= DEMONHUNTER_IMMOLATE_STARTUP && frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
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
    BlzSetSpecialEffectPosition(model, this.origin.x + pose.x, this.front, this.origin.z + pose.z);
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
      this.park(effects.parryFlash, slot, PARRY_FLASH);
      return;
    }
    this.applyStatic(effects.aura, slot, AURA, projectSpecialEffect(state, fighter, slot, STATIC_AURA));
    this.applyStatic(effects.wingTrail, slot, WING_TRAIL, projectSpecialEffect(state, fighter, slot, STATIC_WING_TRAIL));
    this.applyStatic(effects.parryFlash, slot, PARRY_FLASH, projectSpecialEffect(state, fighter, slot, STATIC_PARRY_FLASH));
  }

  presentSummons(state: Readonly<SummonState>, fighter: Readonly<Fighter> | undefined, slot: number): void {
    this.slots[slot]?.bear.present(projectBear(state, fighter, slot));
  }

  /** Animated effects that restart on an event: once per confirmed frame, never from a speculative one. */
  presentConfirmedAnimated(frame: number, fighter: Readonly<Fighter>, slot: number): void {
    const effects = this.slots[slot];
    if (effects === undefined || !consumeImpactFrame(effects.cursor, frame)) return;
    this.presentConfirmedParticles(fighter, effects, slot);
    const { hippogryph } = effects;
    const mount = fighter.hippogryph;
    if (mount.life > 0 && !fighter.status.out) {
      this.placed(slot, HIPPOGRYPH);
      BlzSetSpecialEffectPosition(hippogryph, this.origin.x + mount.x, this.origin.y, this.origin.z + mount.z);
      BlzSetSpecialEffectYaw(hippogryph, facingYaw(mount.velocityX === 0 ? fighter.facing : mount.velocityX));
      BlzSetSpecialEffectScale(hippogryph, f32(0.7));
      BlzSetSpecialEffectAlpha(hippogryph, 255);
      if (effects.previousHippogryphLife === 0 || effects.previousHippogryphKind !== mount.kind) BlzSetSpecialEffectAnimation(hippogryph, hippogryphAnimation(mount.kind));
    } else {
      this.park(hippogryph, slot, HIPPOGRYPH);
    }
    effects.previousHippogryphLife = mount.life;
    effects.previousHippogryphKind = mount.kind;
  }

  destroy(): void {
    for (const slot of this.slots) {
      slot.bear.destroy();
      for (const model of [slot.hippogryph, slot.aura, slot.felFlames, slot.manaHand, slot.wingTrail, slot.parryFlash]) DestroyEffect(model);
    }
  }
}
