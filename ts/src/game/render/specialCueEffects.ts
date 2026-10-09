





import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { ATTACK_CUES, type AttackCueState, attackCueState, fighterRenderedCues } from "../presentation/attackCues";
import { characterModelScale } from "../presentation/modelScale";
import { CUE_ANCHORS, MISSING_CUE_MODEL, type Cue, specialCueState } from "../presentation/specialCues";
import { type ParkedFlags, type WorldOrigin, facingYaw, parkOnce, placeEffect } from "./effects";
import { HitAreaEffects } from "./hitAreaEffects";
import { DEFINITIVE_CUE_EMITTERS } from "../presentation/cueEmitterInfo";
import { modelFailed } from "wisp/src/platform/modelFailures";
import { fighterName } from "../sim/heroes/registry";

declare global { var __smashcraftCueDefinitive: boolean | undefined; }

function definitiveCues(): boolean {
  if (globalThis.__smashcraftCueDefinitive === undefined) {
    BlzLoadTOCFile("war3mapImported\\CueGraphics.toc");
    globalThis.__smashcraftCueDefinitive = GetLocalizedString("SMASHCRAFT_CUE_GRAPHICS") === "definitive";
  }
  return globalThis.__smashcraftCueDefinitive;
}

interface CueModel {
  readonly cue: Cue;
  readonly model: effect;
}

interface PopcornCue {
  readonly cue: Cue;
  readonly model: effect;
  readonly born: number;
  seekStep: number;
}

export class SpecialCueEffects {
  private readonly missing: effect;
  private readonly missingParked: ParkedFlags = [];
  private readonly reported: Record<string, boolean | undefined> = {};
  private readonly areas: HitAreaEffects;
  private readonly cues: CueModel[] = [];
  private parked: ParkedFlags | undefined;

  private shown: Cue | undefined;
  private shownKey = 0;
  private seekAgain = false;
  private readonly popcorn: PopcornCue[] = [];
  private confirmedCue: Cue | undefined;
  private confirmedKey = 0;
  private readonly definitive: boolean;
  private readonly front: number;
  private readonly scale: number;
  private readonly attack: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };

  constructor(private readonly character: Character, private readonly origin: WorldOrigin) {
    this.missing = AddSpecialEffect(MISSING_CUE_MODEL, origin.x, origin.y);
    this.areas = new HitAreaEffects(character, origin);
    this.front = origin.y - 12.0;
    this.scale = characterModelScale(character);
    this.definitive = definitiveCues();
    for (const cue of fighterRenderedCues(character)) {
      if (DEFINITIVE_CUE_EMITTERS[cue.model] !== true) this.cues.push({ cue, model: AddSpecialEffect(cue.model, origin.x, origin.y) });
    }
    this.clear();
  }

  clear(): void {
    parkOnce(this.missing, this.origin, this.missingParked, 0);
    this.areas.clear();
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) parkOnce(entry.model, this.origin, parked, index);
    }
    this.shown = undefined;
    this.shownKey = 0;
    this.seekAgain = false;
    for (const entry of this.popcorn) { parkOnce(entry.model, this.origin, [], 0); DestroyEffect(entry.model); }
    this.popcorn.length = 0;
    this.confirmedCue = undefined;
    this.confirmedKey = 0;
  }


  confirm(fighter: Readonly<Fighter> | undefined, playing: boolean, now: number): void {
    const state = fighter === undefined || !playing ? undefined : specialCueState(fighter);
    const cue = state?.cues === undefined || state.phase === "none" ? undefined
      : state.phase === "startup" ? state.cues.startup : state.cues.active;
    const key = fighter === undefined ? 0 : fighter.special.action * 100 + fighter.special.form;
    if (cue !== undefined && DEFINITIVE_CUE_EMITTERS[cue.model] === true && (cue !== this.confirmedCue || key !== this.confirmedKey)) {
      const model = AddSpecialEffect(cue.model, this.origin.x, this.origin.y);
      this.popcorn.push({ cue, model, born: now, seekStep: 0 });
    }
    for (let index = this.popcorn.length - 1; index >= 0; index--) {
      const entry = this.popcorn[index];
      if (entry !== undefined && entry.cue !== cue && now - entry.born >= 1.0) {
        parkOnce(entry.model, this.origin, [], 0);
        DestroyEffect(entry.model);
        this.popcorn.splice(index, 1);
      }
    }
    this.confirmedCue = cue;
    this.confirmedKey = key;
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    this.areas.present(fighter, playing);
    let cue: Cue | undefined;
    let x = 0.0;
    let z = 0.0;
    let key = 0;
    let cueName = "normal attack";
    if (fighter !== undefined && playing) {
      const special = specialCueState(fighter);
      if (special.cues !== undefined && special.phase !== "none") {
        cue = special.phase === "startup" ? special.cues.startup : special.cues.active;
        cueName = `${special.cues.spell} ${special.phase}`;
        const anchor = CUE_ANCHORS[cue.anchor];
        x = anchor.x * this.scale;
        z = anchor.z * this.scale;
        key = fighter.special.action * 100 + fighter.special.form;
      } else {
        const attack = attackCueState(fighter, this.attack);
        cue = attack.cue;
        for (const entries of Object.values(ATTACK_CUES[this.character] ?? {})) for (const entry of entries ?? []) if (entry.cue === cue) cueName = entry.name;
        if (cue !== undefined && cue.anchor === "overhead") {
          x = 0.0;
          z = CUE_ANCHORS.overhead.z * this.scale;
        } else {
          x = attack.x;
          z = attack.z;
        }
        key = 100 + attack.key;
      }
    }
    const parked = (this.parked ??= []);
    const failed = cue !== undefined && modelFailed(cue.model);
    if (failed && fighter !== undefined && cue !== undefined) {
      this.missingParked[0] = false;
      placeEffect(this.missing, this.origin.x + fighter.motion.x + fighter.facing * x, this.front, this.origin.z + fighter.motion.z + z);
      BlzSetSpecialEffectScale(this.missing, 1.5 * this.scale);
      BlzSetSpecialEffectColor(this.missing, 255, 0, 255);
      BlzSetSpecialEffectAlpha(this.missing, 255);
      const identity = `${cueName}: ${cue.model}`;
      if (this.reported[identity] !== true) {
        this.reported[identity] = true;
        DisplayTimedTextToPlayer(GetLocalPlayer(), 0.0, 0.0, 30.0, `Missing effect: ${fighterName(this.character)} / ${identity}`);
      }
    } else parkOnce(this.missing, this.origin, this.missingParked, 0);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry === undefined) continue;
      if (fighter === undefined || entry.cue !== cue || failed) {
        parkOnce(entry.model, this.origin, parked, index);
        continue;
      }
      const { model } = entry;
      parked[index] = false;
      placeEffect(model, this.origin.x + fighter.motion.x + fighter.facing * x, this.front, this.origin.z + fighter.motion.z + z);
      if (this.shown !== cue || this.shownKey !== key) {
        if (entry.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(model, entry.cue.sequence);
        BlzSetSpecialEffectTime(model, entry.cue.seconds ?? 0.0);
        this.seekAgain = true;
      } else if (this.seekAgain) {
        // Warcraft discards animation seeks in the callback selecting the animation (#58 native rulers).
        BlzSetSpecialEffectTime(model, entry.cue.seconds ?? 0.0);
        this.seekAgain = false;
      }
      BlzSetSpecialEffectYaw(model, facingYaw(fighter.facing));
      BlzSetSpecialEffectPitch(model, entry.cue.pitch ?? 0.0);
      BlzSetSpecialEffectScale(model, entry.cue.scale * this.scale);
      BlzSetSpecialEffectAlpha(model, 255);
      BlzSetSpecialEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
    }
    if (fighter !== undefined && playing) {
      for (const entry of this.popcorn) {
        if (modelFailed(entry.cue.model)) {
          parkOnce(entry.model, this.origin, [], 0);
          continue;
        }
        if (!this.definitive && entry.cue !== cue) {
          parkOnce(entry.model, this.origin, [], 0);
          continue;
        }
        const anchor = CUE_ANCHORS[entry.cue.anchor];
        placeEffect(entry.model, this.origin.x + fighter.motion.x + fighter.facing * anchor.x * this.scale, this.front, this.origin.z + fighter.motion.z + anchor.z * this.scale);
        BlzSetSpecialEffectYaw(entry.model, facingYaw(fighter.facing));
        BlzSetSpecialEffectPitch(entry.model, entry.cue.pitch ?? 0.0);
        BlzSetSpecialEffectScale(entry.model, entry.cue.scale * this.scale);
        if (!this.definitive) {
          if (entry.seekStep === 0 && entry.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(entry.model, entry.cue.sequence);
          if (entry.seekStep < 2) { BlzSetSpecialEffectTime(entry.model, entry.cue.seconds ?? 0.0); entry.seekStep++; }
          BlzSetSpecialEffectTimeScale(entry.model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
        }
      }
    }
    this.shown = cue;
    this.shownKey = key;
  }

  setPaused(paused: boolean): void {
    for (const { model } of this.cues) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
    if (!this.definitive) for (const { model } of this.popcorn) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  destroy(): void {
    this.clear();
    this.areas.destroy();
    DestroyEffect(this.missing);
    for (const { model } of this.cues) DestroyEffect(model);
    this.cues.length = 0;
  }
}
