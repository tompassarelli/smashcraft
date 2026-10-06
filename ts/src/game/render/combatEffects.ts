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
  projectImpact,
  projectKo,
} from "../presentation/impactState";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { impactAnimation, impactModel, presentImpactSounds } from "../presentation/hitPresentation";
import type { ImpactEvents } from "../presentation/impactEvents";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS, heroDefinition } from "../sim/heroes/registry";
import { type ParkedFlags, type WorldOrigin, hideEffect, parkOnce } from "./effects";
import { characterModelScale } from "../presentation/modelScale";

/** A KO body per star-KO impact and selectable fighter, so any fighter can fly off as itself. */
const KO_FIGHTERS = SELECTABLE_CHARACTERS.length;
const KO_BODY_COUNT = IMPACTS_PER_KIND * 2 * KO_FIGHTERS;
const STAR_KO_FIRST = IMPACT_STAR_KO * IMPACTS_PER_KIND;
/** Star-KO sparkles play far behind the stage, against the sky. */
const STAR_KO_DEPTH = 1400.0;


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
  }

  /** Only completed frames dispatch sounds; replay never calls this method. */
  presentConfirmed(frame: number, slot: number, events: Readonly<ImpactEvents>): void {
    const previous = this.soundFrames[slot];
    if (previous !== undefined && frame <= previous) return;
    this.soundFrames[slot] = frame;
    presentImpactSounds(events, (label, x, z, volume, pitch) => {
      const cue = CreateSoundFromLabel(label, false, true, true, 10000, 10000);
      SetSoundPosition(cue, this.x + x, this.y, this.z + z);
      SetSoundVolume(cue, volume);
      SetSoundPitch(cue, pitch);
      StartSound(cue);
      KillSoundWhenDone(cue);
    });
  }

  /** KO impacts come from confirmed state, so a rollback never replays one; the rest from `state`. */
  present(state: Readonly<ImpactState>, confirmed: Readonly<ImpactState>, playing: boolean): void {
    const shownAges = (this.shownAges ??= []);
    const parked = (this.parked ??= []);
    for (let i = 0; i < this.impacts.length; i++) {
      const model = this.impacts[i];
      if (model === undefined) continue;
      const kind = floorDiv(i, IMPACTS_PER_KIND);
      const source = kind === IMPACT_STAR_KO || kind === IMPACT_SCREEN_KO ? confirmed : state;
      const age = source.ages[i];
      // An empty slot projects hidden, and most of the pool is empty for most of a match.
      const pose = playing && age !== undefined ? projectImpact(source, i) : undefined;
      if (pose === undefined || !pose.visible) {
        parkOnce(model, this, parked, i);
        shownAges[i] = undefined;
        continue;
      }
      // The slot's next impact took it while the last one still showed: park it
      // first, as a new effect would start there. The callback draws only its final pose.
      const last = shownAges[i];
      if (last !== undefined && age !== undefined && age < last) hideEffect(model, this);
      if (last === undefined || age !== undefined && age < last) {
        BlzSetSpecialEffectAnimation(model, impactAnimation(floorDiv(i, IMPACTS_PER_KIND)));
        BlzSetSpecialEffectTime(model, 0.0);
      }
      shownAges[i] = age;
      parked[i] = false;
      const depth = floorDiv(i, IMPACTS_PER_KIND) === IMPACT_STAR_KO ? STAR_KO_DEPTH : 0.0;
      BlzSetSpecialEffectAlpha(model, pose.alpha);
      BlzSetSpecialEffectScale(model, pose.scale);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectPosition(model, this.x + pose.x, this.y + depth, this.z + pose.z);
    }
    for (let i = 0; i < this.koBodies.length; i++) {
      const model = this.koBodies[i];
      if (model === undefined) continue;
      const impact = STAR_KO_FIRST + floorDiv(i, KO_FIGHTERS);
      const pose = playing && confirmed.ages[impact] !== undefined ? projectKo(confirmed, impact) : undefined;
      if (pose === undefined || !pose.visible || pose.character !== at(SELECTABLE_CHARACTERS, floorMod(i, KO_FIGHTERS))) {
        parkOnce(model, this, parked, IMPACT_COUNT + i);
        continue;
      }
      parked[IMPACT_COUNT + i] = false;
      BlzSetSpecialEffectPosition(model, this.x + pose.x, this.y + pose.y, this.z + pose.z);
      BlzSetSpecialEffectScale(model, characterModelScale(pose.character) * pose.scale);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectYaw(model, pose.yaw);
      BlzSetSpecialEffectRoll(model, pose.roll);
      BlzSetSpecialEffectAlpha(model, pose.alpha);
    }
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
