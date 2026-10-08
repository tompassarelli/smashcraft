// Impact sparks, dust and KO bodies. Every handle is created with the match;
// effects never feed back into combat, and playback creates or destroys none.
import { DEMON_HUNTER_MODEL_FILE } from "../presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../presentation/fighterAssetInfo";
import {
  IMPACT_CHARGE,
  IMPACT_COUNT,
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

/** A KO body per star-KO impact and selectable fighter, so any fighter can fly off as itself. */
const KO_FIGHTERS = SELECTABLE_CHARACTERS.length;
const KO_BODY_COUNT = IMPACTS_PER_KIND * 2 * KO_FIGHTERS;
const STAR_KO_FIRST = IMPACT_STAR_KO * IMPACTS_PER_KIND;
/** Star-KO sparkles play far behind the stage, against the sky. */
const STAR_KO_DEPTH = 1400.0;
/** A confirmed hit within this many frames of a contact spark already drawn is that spark. */
const SAME_HIT_FRAMES = 2;
/** Frames of drawn contact sparks remembered per kind: longer than any correction takes to confirm. */
const DRAWN_FRAMES = 64;


export function fighterModel(character: number): string {
  const hero = heroDefinition(character);
  if (hero !== undefined) return hero.presentation.model;
  return character === Character.archer ? ARCHER_MODEL_FILE : character === Character.rifleman ? RIFLEMAN_MODEL_FILE : DEMON_HUNTER_MODEL_FILE;
}

export class CombatEffects {
  private readonly impacts: effect[] = [];
  private readonly koBodies: effect[] = [];
  /** Each impact slot's age when last shown; created on first use, so a pool retained across a reload gains it. */
  private soundFrames: number[] = [];

  private shownAges: (number | undefined)[] | undefined;
  /** Per impact slot, the frame the drawn impact was emitted on. */
  private shownEmissions: (number | undefined)[] = [];
  /** Per contact kind, the frames its drawn sparks were emitted on, at the frame's place in a DRAWN_FRAMES ring. */
  private drawnContacts: number[] = [];
  /**
   * Sparks for confirmed hits that predicted presentation never drew: a
   * correction that arrives after a spark's window would otherwise drop it.
   * Its ages count presented frames from the correction, not executed ones.
   */
  private late: ImpactState | undefined;
  /** Per late slot, the confirmed frame of a hit not yet checked against what was drawn. */
  private lateConfirmed: (number | undefined)[] = [];
  private lateLive = 0;
  private presentedFrame: number | undefined;
  /** Created on first use, so a pool retained across a reload gains it. */
  private koFlash: KoFlash | undefined;
  private koFlashShown = false;
  /** Per KO impact, whether every one of its bodies is parked; created on first use, so a pool retained across a reload gains it. */
  private koParked: (boolean | undefined)[] | undefined;
  /** Impacts at their pool index, then KO bodies. */
  private parked: ParkedFlags | undefined;
  /** The impacts' plane, just in front of the fighters; hidden models park beneath it. */
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

  /** Notes a fighter's confirmed frame for the KO flash, which only a confirmed KO starts. */
  confirmKo(frame: number, slot: number, fighter: Readonly<Fighter>, events: Readonly<ImpactEvents>): void {
    noteKoFlash((this.koFlash ??= createKoFlash()), frame, slot, fighter, events);
  }

  /** Silverpine's calls: a white mask over the screen and the camera's depth of field, on this client only. */
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

  /**
   * Notes the contact sparks of a confirmed frame's events. `present` shows
   * each one that predicted presentation never drew, from the start of its
   * spark, so a hit corrected in after its spark's window still shows one.
   */
  confirmContacts(frame: number, events: Readonly<ImpactEvents>): void {
    if (!events.hit && !events.shieldHit && !events.shieldReflect && !events.shieldBreak) return;
    const late = (this.late ??= createImpactState());
    emitImpacts(late, events, frame);
    let live = 0;
    // Pool arrays hold undefined for free slots, so loops run to IMPACT_COUNT, never to a Lua length.
    for (let i = 0; i < IMPACT_COUNT; i++) {
      // A noted slot is one an earlier frame of this callback emitted.
      if (late.ages[i] === 0 && this.lateConfirmed[i] === undefined) {
        // The events' other cues (dust, jumps, landings) are predicted presentation's alone.
        if (isContactImpact(floorDiv(i, IMPACTS_PER_KIND))) this.lateConfirmed[i] = frame;
        else clearImpactSlot(late, i);
      }
      if (late.ages[i] !== undefined) live++;
    }
    this.lateLive = live;
  }

  /** Only completed frames dispatch sounds; replay never calls this method. */
  presentConfirmed(frame: number, slot: number, events: Readonly<ImpactEvents>, soundPlayed?: (sound: string, volume: number, pitch: number) => void): void {
    const previous = this.soundFrames[slot];
    if (previous !== undefined && frame <= previous) return;
    this.soundFrames[slot] = frame;
    presentImpactSounds(events, (sound, x, z, volume, pitch, file) => {
      // A tier's weapon sound or swing plays its file at UnitCombatSounds.slk's distances; a label carries its own.
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

  /**
   * KO impacts come from confirmed state, so a rollback never replays one; the
   * rest from `state`, as of `frame`, then late sparks where `state` shows none.
   */
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
      // An empty slot projects hidden, and most of the pool is empty for most of a match.
      const pose = playing && age !== undefined ? projectImpact(source, i) : undefined;
      if (pose === undefined || !pose.visible) {
        // The late pass below shows or parks a slot holding a late spark.
        if (parked[i] !== true && (this.lateLive === 0 || this.late?.ages[i] === undefined)) parkOnce(model, this, parked, i);
        shownAges[i] = undefined;
        this.shownEmissions[i] = undefined;
        continue;
      }
      // The slot's next impact took it while the last one still showed: park it
      // first, as a new effect would start there. The callback draws only its final pose.
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
        // A KO impact's bodies all park together, and almost every frame has none flying.
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
    const depth = kind === IMPACT_STAR_KO ? STAR_KO_DEPTH : 0.0;
    BlzSetSpecialEffectAlpha(model, pose.alpha);
    BlzSetSpecialEffectScale(model, pose.scale * impactModelScale(kind));
    BlzSetSpecialEffectPitch(model, pose.pitch);
    placeEffect(model, this.x + pose.x, this.y + depth, this.z + pose.z);
  }

  /** Records a contact spark drawn from `state`, once per emission. */
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

  /**
   * Checks each newly confirmed hit against the sparks drawn, after this
   * callback's, then shows the late sparks in the handles `state` leaves free.
   * Late sparks age once a presented frame, so a pause holds them.
   */
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
      // A spark `state` draws in this handle wins it; the late one keeps aging.
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
