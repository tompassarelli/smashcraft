





import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { ATTACK_CUES, type AttackCueState, attackCueState, fighterRenderedCues } from "../presentation/attackCues";
import { characterModelScale } from "../presentation/modelScale";
import { CUE_ANCHORS, MISSING_CUE_MODEL, type Cue, specialCueState } from "../presentation/specialCues";
import { PARKED_CUE_TIME_SCALE, type ParkedFlags, type WorldOrigin, facingYaw, parkCue, parkOnce, placeEffect } from "./effects";
import { HitAreaEffects } from "./hitAreaEffects";
import { DEFINITIVE_CUE_EMITTERS } from "../presentation/cueEmitterInfo";
import { modelFailed } from "wisp/src/platform/modelFailures";
import { fighterName } from "../sim/heroes/registry";
import { specialAreaRegion } from "../presentation/disjointCues";

declare global { var __smashcraftCueDefinitive: boolean | undefined; }

export function definitiveCues(): boolean {
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

export const POPCORN_VOICES = 2;

interface PopcornVoices {
  readonly models: effect[];
  next: number;
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
  private breathFrame = 0;
  private readonly definitive: boolean;
  private readonly front: number;
  private readonly scale: number;
  private readonly attack: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };
  private readonly confirmedAttack: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };
  private readonly voices: { [model: string]: PopcornVoices | undefined } = {};

  // Online, Warcraft handles must be born on the same turn on every client, so shared play restarts emitters made here instead of making fresh ones on confirmed frames.
  constructor(private readonly character: Character, private readonly origin: WorldOrigin, private readonly shared = false) {
    this.missing = AddSpecialEffect(MISSING_CUE_MODEL, origin.x, origin.y);
    this.areas = new HitAreaEffects(character, origin);
    this.front = origin.y - 12.0;
    this.scale = characterModelScale(character);
    this.definitive = definitiveCues();
    for (const shown of fighterRenderedCues(character)) {
      const cue = this.look(shown);
      if (DEFINITIVE_CUE_EMITTERS[cue.model] !== true) this.cues.push({ cue, model: AddSpecialEffect(cue.model, origin.x, origin.y) });
      else if (shared && this.voices[cue.model] === undefined) {
        const models: effect[] = [];
        const count = character === Character.chen && cue.anchor === "breath" ? 11 : POPCORN_VOICES;
        for (let voice = 0; voice < count; voice++) {
          const model = AddSpecialEffect(cue.model, origin.x, origin.y);
          this.parkPopcorn(model);
          models.push(model);
        }
        this.voices[cue.model] = { models, next: 0 };
      }
    }
    this.clear();
  }

  clear(): void {
    parkOnce(this.missing, this.origin, this.missingParked, 0);
    this.areas.clear();
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) parkCue(entry.model, this.origin, parked, index);
    }
    this.shown = undefined;
    this.shownKey = 0;
    this.seekAgain = false;
    for (const entry of this.popcorn) this.retirePopcorn(entry.model);
    this.popcorn.length = 0;
    this.confirmedCue = undefined;
    this.confirmedKey = 0;
    this.breathFrame = 0;
  }


  confirm(fighter: Readonly<Fighter> | undefined, playing: boolean, now: number): void {
    const state = fighter === undefined || !playing ? undefined : specialCueState(fighter);
    let cue = state?.cues === undefined || state.phase === "none" ? undefined
      : this.look(state.phase === "startup" ? state.cues.startup : state.cues.active);
    let key = fighter === undefined ? 0 : fighter.special.action * 100 + fighter.special.form;
    if (fighter !== undefined && state !== undefined && cue === undefined) {
      const attack = attackCueState(fighter, this.confirmedAttack, this.definitive);
      if (attack.cue !== undefined) {
        cue = this.look(attack.cue);
        key = 100 + attack.key;
      }
    }
    const breath = this.character === Character.chen && cue?.anchor === "breath";
    const strike = breath && fighter !== undefined ? specialAreaRegion(fighter, 0).strike : undefined;
    if (breath && strike === undefined) cue = undefined;
    if (cue !== undefined && DEFINITIVE_CUE_EMITTERS[cue.model] === true && (cue !== this.confirmedCue || key !== this.confirmedKey || (breath && fighter?.special.frame !== this.breathFrame))) {
      const model = this.popcornModel(cue, strike === undefined || fighter === undefined ? undefined : {
        x: this.origin.x + fighter.motion.x + fighter.facing * strike.x2,
        y: this.front,
        z: this.origin.z + fighter.motion.z + strike.z2,
      }, fighter?.facing ?? 1);
      if (model !== undefined) this.popcorn.push({ cue, model, born: now, seekStep: 0 });
    }
    for (let index = this.popcorn.length - 1; index >= 0; index--) {
      const entry = this.popcorn[index];
      if (entry !== undefined && entry.cue !== cue && now - entry.born >= 1.0) {
        this.retirePopcorn(entry.model);
        this.popcorn.splice(index, 1);
      }
    }
    this.confirmedCue = cue;
    this.confirmedKey = key;
    this.breathFrame = breath && strike !== undefined ? fighter?.special.frame ?? 0 : 0;
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
        if (this.character === Character.chen && cue.anchor === "breath") {
          const strike = specialAreaRegion(fighter, 0).strike;
          if (strike === undefined) cue = undefined;
          else { x = strike.x2; z = strike.z2; }
        }
        key = fighter.special.action * 100 + fighter.special.form;
      } else {
        const attack = attackCueState(fighter, this.attack, this.definitive);
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
    if (cue !== undefined) cue = this.look(cue);
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
        parkCue(entry.model, this.origin, parked, index);
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
      BlzSetSpecialEffectAlpha(model, entry.cue.alpha ?? 255);
      BlzSetSpecialEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : entry.cue.timeScale ?? 1.0);
    }
    if (fighter !== undefined && playing) {
      for (const entry of this.popcorn) {
        if (modelFailed(entry.cue.model)) {
          this.parkPopcorn(entry.model);
          continue;
        }
        if (entry.cue !== cue) {
          this.parkPopcorn(entry.model);
          continue;
        }
        placeEffect(entry.model, this.origin.x + fighter.motion.x + fighter.facing * x, this.front, this.origin.z + fighter.motion.z + z);
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

  private look(cue: Cue): Cue {
    return this.definitive ? cue.definitive ?? cue : cue;
  }

  private popcornModel(cue: Cue, breath: WorldOrigin | undefined, facing: number): effect | undefined {
    const path = cue.model;
    if (!this.shared) {
      const model = AddSpecialEffect(path, breath?.x ?? this.origin.x, breath?.y ?? this.origin.y);
      if (breath !== undefined) {
        BlzSetSpecialEffectPosition(model, breath.x, breath.y, breath.z);
        BlzSetSpecialEffectScale(model, cue.scale * this.scale);
        BlzSetSpecialEffectYaw(model, facingYaw(facing));
        BlzPlaySpecialEffect(model, ANIM_TYPE_BIRTH);
      }
      return model;
    }
    const voices = this.voices[path];
    const model = voices?.models[voices.next];
    if (voices === undefined || model === undefined) return undefined;
    voices.next = voices.next + 1 >= voices.models.length ? 0 : voices.next + 1;
    for (let index = this.popcorn.length - 1; index >= 0; index--) if (this.popcorn[index]?.model === model) this.popcorn.splice(index, 1);
    if (breath !== undefined) {
      BlzSetSpecialEffectPosition(model, breath.x, breath.y, breath.z);
      BlzSetSpecialEffectScale(model, cue.scale * this.scale);
      BlzSetSpecialEffectYaw(model, facingYaw(facing));
      BlzSetSpecialEffectTimeScale(model, 1.0);
    }
    BlzSpecialEffectClearSubAnimations(model);
    BlzPlaySpecialEffect(model, ANIM_TYPE_BIRTH);
    return model;
  }

  private retirePopcorn(model: effect): void {
    this.parkPopcorn(model);
    if (!this.shared) DestroyEffect(model);
  }

  private parkPopcorn(model: effect): void {
    if (this.definitive) parkOnce(model, this.origin, [], 0);
    else parkCue(model, this.origin, [], 0);
  }

  setPaused(paused: boolean): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) BlzSetSpecialEffectTimeScale(entry.model, paused ? 0.0 : parked[index] === true ? PARKED_CUE_TIME_SCALE : entry.cue.timeScale ?? 1.0);
    }
    if (!this.definitive) for (const { model } of this.popcorn) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  destroy(): void {
    this.clear();
    this.areas.destroy();
    DestroyEffect(this.missing);
    for (const { model } of this.cues) DestroyEffect(model);
    this.cues.length = 0;
    for (const voices of Object.values(this.voices)) for (const model of voices?.models ?? []) DestroyEffect(model);
  }
}
