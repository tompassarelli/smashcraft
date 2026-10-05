// Impact sparks, dust and KO bodies. Every handle is created with the match;
// effects never feed back into combat, and playback creates or destroys none.
import {
  IMPACT_DUST_MODEL,
  IMPACT_ELECTRIC_MODEL,
  IMPACT_HIT_MODEL,
  IMPACT_JUMP_MODEL,
  IMPACT_KO_MODEL,
  IMPACT_MISS_MODEL,
  IMPACT_RESPAWN_MODEL,
  IMPACT_ROLL_MODEL,
  IMPACT_SHIELD_MODEL,
  IMPACT_TECH_MODEL,
} from "../assets/impactAssetInfo";
import { DEMON_HUNTER_MODEL_FILE } from "../presentation/demonHunterAssetInfo";
import { ARCHER_MODEL_FILE, RIFLEMAN_MODEL_FILE } from "../presentation/fighterAssetInfo";
import {
  IMPACT_CHARGE,
  IMPACT_COUNT,
  IMPACT_GRAB,
  IMPACT_LEDGE_CATCH,
  IMPACT_LEDGE_RECOVERY,
  IMPACT_READY,
  IMPACT_STAR_KO,
  IMPACT_THROW,
  IMPACTS_PER_KIND,
  type ImpactState,
  projectImpact,
  projectKo,
} from "../presentation/impactState";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { Character } from "../sim/codes";
import { type WorldOrigin, hideEffect } from "./effects";
import { characterModelScale } from "../presentation/modelScale";

/** A KO body per star-KO impact and character, so any fighter can fly off as itself. */
const KO_BODY_COUNT = IMPACTS_PER_KIND * 2 * 3;
const STAR_KO_FIRST = IMPACT_STAR_KO * IMPACTS_PER_KIND;
/** Star-KO sparkles play far behind the stage, against the sky. */
const STAR_KO_DEPTH = 1400.0;

function impactModel(kind: number): string {
  if (kind === 0) return IMPACT_HIT_MODEL;
  if (kind === 1) return IMPACT_TECH_MODEL;
  if (kind === 2) return IMPACT_MISS_MODEL;
  if (kind === 3) return IMPACT_DUST_MODEL;
  if (kind === 5) return IMPACT_ELECTRIC_MODEL;
  if (kind === 6) return IMPACT_SHIELD_MODEL;
  if (kind === 7) return IMPACT_JUMP_MODEL;
  if (kind === 8) return IMPACT_KO_MODEL;
  if (kind === 9) return IMPACT_RESPAWN_MODEL;
  if (kind === IMPACT_GRAB || kind === IMPACT_CHARGE) return IMPACT_SHIELD_MODEL;
  if (kind === IMPACT_THROW || kind === IMPACT_LEDGE_RECOVERY) return IMPACT_JUMP_MODEL;
  if (kind === IMPACT_STAR_KO || kind === IMPACT_READY || kind === IMPACT_LEDGE_CATCH) return IMPACT_TECH_MODEL;
  return IMPACT_ROLL_MODEL;
}

function fighterModel(character: number): string {
  return character === Character.archer ? ARCHER_MODEL_FILE : character === Character.rifleman ? RIFLEMAN_MODEL_FILE : DEMON_HUNTER_MODEL_FILE;
}

export class CombatEffects {
  private readonly impacts: effect[] = [];
  private readonly koBodies: effect[] = [];
  /** Each impact slot's age when last shown; created on first use, so a pool retained across a reload gains it. */
  private shownAges: (number | undefined)[] | undefined;
  /** The impacts' plane, just in front of the fighters; hidden models park beneath it. */
  readonly x: number;
  readonly y: number;
  readonly z: number;

  constructor(origin: WorldOrigin) {
    this.x = origin.x;
    this.y = origin.y - 8.0;
    this.z = origin.z;
    for (let i = 0; i < IMPACT_COUNT; i++) {
      const model = AddSpecialEffect(impactModel(floorDiv(i, IMPACTS_PER_KIND)), origin.x, origin.y);
      hideEffect(model, this);
      this.impacts.push(model);
    }
    for (let i = 0; i < KO_BODY_COUNT; i++) {
      const model = AddSpecialEffect(fighterModel(floorMod(i, 3)), origin.x, origin.y);
      BlzSetSpecialEffectAnimation(model, "stand hit");
      BlzSetSpecialEffectAnimationBlendTime(model, 0.0);
      BlzSetSpecialEffectTimeScale(model, 0.0);
      BlzSetSpecialEffectTime(model, f32(0.1));
      hideEffect(model, this);
      this.koBodies.push(model);
    }
  }

  clear(): void {
    for (const model of this.impacts) hideEffect(model, this);
    for (const model of this.koBodies) hideEffect(model, this);
    this.shownAges = undefined;
  }

  /** KO impacts come from confirmed state, so a rollback never replays one; the rest from `state`. */
  present(state: Readonly<ImpactState>, confirmed: Readonly<ImpactState>, playing: boolean): void {
    const shownAges = (this.shownAges ??= []);
    for (let i = 0; i < this.impacts.length; i++) {
      const model = this.impacts[i];
      if (model === undefined) continue;
      const source = i >= STAR_KO_FIRST ? confirmed : state;
      const pose = projectImpact(source, i);
      const age = source.ages[i];
      if (!playing || !pose.visible) {
        hideEffect(model, this);
        shownAges[i] = undefined;
        continue;
      }
      // The slot's next impact took it while the last one still showed: park it
      // first, as a new effect would start there. The callback draws only its final pose.
      const last = shownAges[i];
      if (last !== undefined && age !== undefined && age < last) hideEffect(model, this);
      shownAges[i] = age;
      const depth = floorDiv(i, IMPACTS_PER_KIND) === IMPACT_STAR_KO ? STAR_KO_DEPTH : 0.0;
      BlzSetSpecialEffectAlpha(model, pose.alpha);
      BlzSetSpecialEffectScale(model, pose.scale);
      BlzSetSpecialEffectPitch(model, pose.pitch);
      BlzSetSpecialEffectPosition(model, this.x + pose.x, this.y + depth, this.z + pose.z);
    }
    for (let i = 0; i < this.koBodies.length; i++) {
      const model = this.koBodies[i];
      if (model === undefined) continue;
      const pose = projectKo(confirmed, STAR_KO_FIRST + floorDiv(i, 3));
      if (!playing || !pose.visible || pose.character !== floorMod(i, 3)) {
        hideEffect(model, this);
        continue;
      }
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
