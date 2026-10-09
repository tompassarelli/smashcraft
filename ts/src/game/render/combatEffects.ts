

import { DEMON_HUNTER_MODEL_FILE } from "../presentation/demonHunterAssetInfo";
import { RIFLEMAN_MODEL_FILE } from "../presentation/fighterAssetInfo";
import {
  IMPACT_CHARGE,
  IMPACT_COUNT,
  IMPACT_FIRE_HIT,
  IMPACT_GRAB,
  IMPACT_LEDGE_CATCH,
  IMPACT_LEDGE_RECOVERY,
  IMPACT_READY,
  IMPACT_SCREEN_KO,
  IMPACT_STAR_KO,
  IMPACT_THROW,
  IMPACTS_PER_KIND,
  type ImpactState,
  advanceImpacts,
  clearImpactState,
  clearImpactSlot,
  createImpactState,
  emitImpacts,
  isContactImpact,
  projectImpact,
  projectKo,
} from "../presentation/impactState";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { impactAnimation, impactModel, impactModelScale, impactStartSeconds, presentImpactSounds } from "../presentation/hitPresentation";
import type { ImpactEvents } from "../presentation/impactEvents";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, heroDefinition } from "../sim/heroes/registry";
import { type ParkedFlags, type WorldOrigin, hideEffect, parkOnce, placeEffect } from "./effects";
import { characterModelScale } from "../presentation/modelScale";
import { tierSoundPaths } from "../presentation/moveTiers";
import { KO_BLUR_DISTANCE, type KoFlash, createKoFlash, endKoFlash, koFlashLevels, noteKoFlash } from "../presentation/koFlash";
import type { Fighter } from "../sim/fighter";


const KO_FIGHTERS = SELECTABLE_CHARACTERS.length;
const KO_BODY_COUNT = IMPACTS_PER_KIND * 2 * KO_FIGHTERS;
const STAR_KO_FIRST = IMPACT_STAR_KO * IMPACTS_PER_KIND;

const STAR_KO_DEPTH = 1400.0;

const SAME_HIT_FRAMES = 2;

const DRAWN_FRAMES = 64;


export function fighterModel(character: number): string {
  const hero = heroDefinition(character);
  if (hero !== undefined) return hero.presentation.model;
  return character === Character.rifleman ? RIFLEMAN_MODEL_FILE : DEMON_HUNTER_MODEL_FILE;
}

export class CombatEffects {
  private readonly impacts: effect[] = [];
  private readonly koBodies: effect[] = [];

  private soundFrames: number[] = [];

  private shownAges: (number | undefined)[] | undefined;

  private shownEmissions: (number | undefined)[] = [];

  private drawnContacts: number[] = [];





  private late: ImpactState | undefined;

  private lateConfirmed: (number | undefined)[] = [];
  private lateLive = 0;
  private presentedFrame: number | undefined;

  private koFlash: KoFlash | undefined;
  private koFlashShown = false;

  private koParked: (boolean | undefined)[] | undefined;

  private parked: ParkedFlags | undefined;

  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor(origin: WorldOrigin) {
    this.x = origin.x;
    this.y = origin.y - 8.0;
    this.z = origin.z;
    const parked: ParkedFlags = [];
    this.parked = parked;
    for (const path of tierSoundPaths()) Preload(path);
    for (let i = 0; i < IMPACT_COUNT; i++) {
      const model = AddSpecialEffect(impactModel(floorDiv(i, IMPACTS_PER_KIND)), origin.x, origin.y);
      if (floorDiv(i, IMPACTS_PER_KIND) === IMPACT_FIRE_HIT) BlzSetSpecialEffectColor(model, 255, 100, 25);
      parkOnce(model, this, parked, i);
      this.impacts.push(model);
    }
    for (let i = 0; i < KO_BODY_COUNT; i++) {
      const model = AddSpecialEffect(fighterModel(at(SELECTABLE_CHARACTERS, floorMod(i, KO_FIGHTERS))), origin.x, origin.y);
      BlzSetSpecialEffectAnimation(model, "stand hit");
      BlzSetSpecialEffectAnimationBlendTime(model, 0.0);
      BlzSetSpecialEffectTimeScale(model, 0.0);
      BlzSetSpecialEffectTime(model, f32(0.1));
      parkOnce(model, this, parked, IMPACT_COUNT + i);
      this.koBodies.push(model);
    }
  }

  clear(): void {
    const parked = (this.parked ??= []);
    this.impacts.forEach((model, i) => parkOnce(model, this, parked, i));
    this.koBodies.forEach((model, i) => parkOnce(model, this, parked, IMPACT_COUNT + i));
    this.shownAges = undefined;
    this.soundFrames = [];
    this.shownEmissions = [];
    this.drawnContacts = [];
    if (this.late !== undefined) clearImpactState(this.late);
    this.lateConfirmed = [];
    this.lateLive = 0;
    this.presentedFrame = undefined;
    if (this.koFlash !== undefined) endKoFlash(this.koFlash);
    this.hideKoFlash();
  }


  confirmKo(frame: number, slot: number, fighter: Readonly<Fighter>, events: Readonly<ImpactEvents>): void {
    noteKoFlash((this.koFlash ??= createKoFlash()), frame, slot, fighter, events);
  }


  private presentKoFlash(frame: number, playing: boolean): void {
    const flash = this.koFlash;
    const levels = flash === undefined ? undefined : koFlashLevels(flash, frame);
    if (flash === undefined || levels === undefined || !playing || !levels.showing) {
      if (flash !== undefined && levels !== undefined && !levels.showing) endKoFlash(flash);
      this.hideKoFlash();
      return;
    }
    if (!this.koFlashShown) {
      SetCineFilterTexture("ReplaceableTextures\\CameraMasks\\White_Mask.blp");
      SetCineFilterBlendMode(BLEND_MODE_BLEND);
      SetCineFilterTexMapFlags(TEXMAP_FLAG_NONE);
      SetCineFilterStartUV(0.0, 0.0, 1.0, 1.0);
      SetCineFilterEndUV(0.0, 0.0, 1.0, 1.0);
      SetCineFilterDuration(0.0);
      DisplayCineFilter(true);
      SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_DISTANCE, KO_BLUR_DISTANCE, 0.0);
      this.koFlashShown = true;
    }
    SetCineFilterStartColor(255, 255, 255, levels.alpha);
    SetCineFilterEndColor(255, 255, 255, levels.alpha);
    SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_SCALE, levels.blur, 0.0);
  }

  private hideKoFlash(): void {
    if (!this.koFlashShown) return;
    this.koFlashShown = false;
    DisplayCineFilter(false);
    SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_DISTANCE, 0.0, 0.0);
    SetCameraField(CAMERA_FIELD_DEPTH_OF_FIELD_SCALE, 0.0, 0.0);
  }






  confirmContacts(frame: number, events: Readonly<ImpactEvents>): void {
    if (!events.hit && !events.shieldHit && !events.shieldReflect && !events.shieldBreak) return;
    const late = (this.late ??= createImpactState());
    emitImpacts(late, events, frame);
    let live = 0;
    // Use IMPACT_COUNT because free slots are undefined and Lua length skips them.
    for (let i = 0; i < IMPACT_COUNT; i++) {

      if (late.ages[i] === 0 && this.lateConfirmed[i] === undefined) {

        if (isContactImpact(floorDiv(i, IMPACTS_PER_KIND))) this.lateConfirmed[i] = frame;
        else clearImpactSlot(late, i);
      }
      if (late.ages[i] !== undefined) live++;
    }
    this.lateLive = live;
  }


  presentConfirmed(frame: number, slot: number, events: Readonly<ImpactEvents>, soundPlayed?: (sound: string, volume: number, pitch: number) => void): void {
    const previous = this.soundFrames[slot];
    if (previous !== undefined && frame <= previous) return;
    this.soundFrames[slot] = frame;
    presentImpactSounds(events, (sound, x, z, volume, pitch, file) => {

      const cue = file ? CreateSound(sound, false, true, true, 10, 10, "CombatSoundsEAX") : CreateSoundFromLabel(sound, false, true, true, 10000, 10000);
      if (file) {
        SetSoundDistances(cue, 600.0, 3500.0);
        SetSoundDistanceCutoff(cue, 3000.0);
      }
      SetSoundPosition(cue, this.x + x, this.y, this.z + z);
      SetSoundVolume(cue, volume);
      SetSoundPitch(cue, pitch);
      StartSound(cue);
      soundPlayed?.(sound, volume, pitch);
      KillSoundWhenDone(cue);
    });
  }





  present(state: Readonly<ImpactState>, frame: number, confirmed: Readonly<ImpactState>, playing: boolean): void {
    const shownAges = (this.shownAges ??= []);
    const parked = (this.parked ??= []);
    const count = this.impacts.length;
    for (let i = 0; i < count; i++) {
      const model = this.impacts[i];
      if (model === undefined) continue;
      const kind = floorDiv(i, IMPACTS_PER_KIND);
      const source = kind === IMPACT_STAR_KO || kind === IMPACT_SCREEN_KO ? confirmed : state;
      const age = source.ages[i];

      const pose = playing && age !== undefined ? projectImpact(source, i) : undefined;
      if (pose === undefined || !pose.visible) {

        if (parked[i] !== true && (this.lateLive === 0 || this.late?.ages[i] === undefined)) parkOnce(model, this, parked, i);
        shownAges[i] = undefined;
        this.shownEmissions[i] = undefined;
        continue;
      }


      const last = shownAges[i];
      if (last !== undefined && age !== undefined && age < last) hideEffect(model, this);
      if (last === undefined || age !== undefined && age < last) {
        BlzSetSpecialEffectAnimation(model, impactAnimation(kind));
        BlzSetSpecialEffectTime(model, impactStartSeconds(kind));
      }
      shownAges[i] = age;
      if (age !== undefined) this.drawn(i, kind, frame - age);
      this.place(model, i, kind, pose);
    }
    if (this.lateLive > 0) this.presentLate(state, frame, playing);
    this.presentKoFlash(frame, playing);
    const koParked = (this.koParked ??= []);
    for (let i = 0; i < this.koBodies.length; i++) {
      const group = floorDiv(i, KO_FIGHTERS);
      const impact = STAR_KO_FIRST + group;
      if (!playing || confirmed.ages[impact] === undefined) {

        if (koParked[group] !== true) {
          for (let body = i; body < i + KO_FIGHTERS; body++) {
            const hidden = this.koBodies[body];
            if (hidden !== undefined) parkOnce(hidden, this, parked, IMPACT_COUNT + body);
          }
          koParked[group] = true;
        }
        i += KO_FIGHTERS - 1;
        continue;
      }
      const model = this.koBodies[i];
      if (model === undefined) continue;
      const pose = projectKo(confirmed, impact);
      if (!pose.visible || pose.character !== at(SELECTABLE_CHARACTERS, floorMod(i, KO_FIGHTERS))) {
        parkOnce(model, this, parked, IMPACT_COUNT + i);
        continue;
      }
      koParked[group] = false;
      parked[IMPACT_COUNT + i] = false;
      placeEffect(model, this.x + pose.x, this.y + pose.y, this.z + pose.z);
      BlzSetSpecialEffectScale(model, characterModelScale(pose.character) * pose.scale);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectRoll(model, pose.roll);
      BlzSetSpecialEffectAlpha(model, pose.alpha);
    }
  }

  private place(model: effect, i: number, kind: number, pose: ReturnType<typeof projectImpact>): void {
    const parked = (this.parked ??= []);
    parked[i] = false;

    const depth = kind === IMPACT_STAR_KO ? STAR_KO_DEPTH
      : isContactImpact(kind) || kind === IMPACT_GRAB || kind === IMPACT_THROW ? -120.0 : 0.0;
    BlzSetSpecialEffectAlpha(model, pose.alpha);
    BlzSetSpecialEffectScale(model, pose.scale * impactModelScale(kind));
    BlzSetSpecialEffectPitch(model, pose.pitch);
    placeEffect(model, this.x + pose.x, this.y + depth, this.z + pose.z);
  }


  private drawn(i: number, kind: number, emitted: number): void {
    if (!isContactImpact(kind) || this.shownEmissions[i] === emitted) return;
    this.shownEmissions[i] = emitted;
    this.drawnContacts[kind * DRAWN_FRAMES + floorMod(emitted, DRAWN_FRAMES)] = emitted;
  }

  private wasDrawn(kind: number, confirmedFrame: number): boolean {
    for (let emitted = confirmedFrame - SAME_HIT_FRAMES; emitted <= confirmedFrame + SAME_HIT_FRAMES; emitted++) {
      if (this.drawnContacts[kind * DRAWN_FRAMES + floorMod(emitted, DRAWN_FRAMES)] === emitted) return true;
    }
    return false;
  }






  private presentLate(state: Readonly<ImpactState>, frame: number, playing: boolean): void {
    const late = this.late;
    if (late === undefined) return;
    const parked = (this.parked ??= []);
    const advance = this.presentedFrame !== frame;
    this.presentedFrame = frame;
    for (let i = 0; i < IMPACT_COUNT; i++) {
      const age = late.ages[i];
      if (age === undefined) continue;
      const kind = floorDiv(i, IMPACTS_PER_KIND);
      const confirmedFrame = this.lateConfirmed[i];
      this.lateConfirmed[i] = undefined;
      const model = this.impacts[i];
      if (!playing || model === undefined || confirmedFrame !== undefined && this.wasDrawn(kind, confirmedFrame)) {
        clearImpactSlot(late, i);
        if (model !== undefined && state.ages[i] === undefined) parkOnce(model, this, parked, i);
        continue;
      }

      if (state.ages[i] === undefined) {
        if (age === 0) {
          BlzSetSpecialEffectAnimation(model, impactAnimation(kind));
          BlzSetSpecialEffectTime(model, impactStartSeconds(kind));
        }
        this.place(model, i, kind, projectImpact(late, i));
      }
    }
    if (advance) advanceImpacts(late);
    this.lateLive = 0;
    for (let i = 0; i < IMPACT_COUNT; i++) if (late.ages[i] !== undefined) this.lateLive++;
  }

  setPaused(paused: boolean): void {
    for (const model of this.impacts) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  destroy(): void {
    for (const model of this.impacts) DestroyEffect(model);
    for (const model of this.koBodies) DestroyEffect(model);
    this.impacts.length = 0;
    this.koBodies.length = 0;
  }
}
