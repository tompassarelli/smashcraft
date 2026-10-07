// One fighter's move cues: a startup and an active stock spell effect per
// special (presentation/specialCues.ts) and the effects its signature normals
// show where their hit region is live (presentation/attackCues.ts), created
// with the fighter's renderers. Presentation follows numerical state (the
// running special or attack and its frame), so a restore reapplies it without
// spawning anything.
import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type AttackCueState, attackCueState, fighterRenderedCues } from "../presentation/attackCues";
import { characterModelScale } from "../presentation/modelScale";
import { CUE_ANCHORS, type Cue, specialCueState } from "../presentation/specialCues";
import { type ParkedFlags, type WorldOrigin, facingYaw, parkOnce } from "./effects";

interface CueModel {
  readonly cue: Cue;
  readonly model: effect;
}

export class SpecialCueEffects {
  private readonly cues: CueModel[] = [];
  private parked: ParkedFlags | undefined;
  /** The cue and key shown last, so a new phase or hit restarts its effect from its first frame. */
  private shown: Cue | undefined;
  private shownKey = 0;
  private readonly front: number;
  private readonly scale: number;
  private readonly attack: AttackCueState = { cue: undefined, x: 0.0, z: 0.0, key: 0 };

  constructor(character: Character, private readonly origin: WorldOrigin) {
    this.front = origin.y - 12.0;
    this.scale = characterModelScale(character);
    for (const cue of fighterRenderedCues(character)) this.cues.push({ cue, model: AddSpecialEffect(cue.model, origin.x, origin.y) });
    this.clear();
  }

  clear(): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) parkOnce(entry.model, this.origin, parked, index);
    }
    this.shown = undefined;
    this.shownKey = 0;
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    let cue: Cue | undefined;
    let x = 0.0;
    let z = 0.0;
    let key = 0;
    if (fighter !== undefined && playing) {
      const special = specialCueState(fighter);
      if (special.cues !== undefined && special.phase !== "none") {
        cue = special.phase === "startup" ? special.cues.startup : special.cues.active;
        const anchor = CUE_ANCHORS[cue.anchor];
        x = anchor.x * this.scale;
        z = anchor.z * this.scale;
        key = fighter.special.action;
      } else {
        const attack = attackCueState(fighter, this.attack);
        cue = attack.cue;
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
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry === undefined) continue;
      if (fighter === undefined || entry.cue !== cue) {
        parkOnce(entry.model, this.origin, parked, index);
        continue;
      }
      const { model } = entry;
      if (this.shown !== cue || this.shownKey !== key) {
        if (entry.cue.sequence !== undefined) BlzSetSpecialEffectAnimation(model, entry.cue.sequence);
        BlzSetSpecialEffectTime(model, entry.cue.seconds ?? 0.0);
      }
      parked[index] = false;
      BlzSetSpecialEffectPosition(model, this.origin.x + fighter.motion.x + fighter.facing * x, this.front, this.origin.z + fighter.motion.z + z);
      BlzSetSpecialEffectYaw(model, facingYaw(fighter.facing));
      BlzSetSpecialEffectScale(model, entry.cue.scale * this.scale);
      BlzSetSpecialEffectAlpha(model, 255);
      BlzSetSpecialEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
    }
    this.shown = cue;
    this.shownKey = key;
  }

  setPaused(paused: boolean): void {
    for (const { model } of this.cues) BlzSetSpecialEffectTimeScale(model, paused ? 0.0 : 1.0);
  }

  destroy(): void {
    this.clear();
    for (const { model } of this.cues) DestroyEffect(model);
    this.cues.length = 0;
  }
}
