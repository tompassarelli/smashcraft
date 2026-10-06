// One fighter's special cues (presentation/specialCues.ts): a startup and an
// active stock spell effect per special, created with the fighter's
// renderers. Presentation follows numerical state (the running special and
// its frame), so a restore reapplies it without spawning anything.
import type { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { characterModelScale } from "../presentation/modelScale";
import { CUE_ANCHORS, type Cue, type CueState, fighterCueList, specialCueState } from "../presentation/specialCues";
import { type ParkedFlags, type WorldOrigin, facingYaw, parkOnce } from "./effects";

interface CueModel {
  readonly cue: Cue;
  readonly model: effect;
}

export class SpecialCueEffects {
  private readonly cues: CueModel[] = [];
  private parked: ParkedFlags | undefined;
  /** The cue shown last, so entering a phase restarts its spell from its first frame. */
  private shown: Cue | undefined;
  private shownAction = 0;
  private readonly front: number;
  private readonly scale: number;

  constructor(character: Character, private readonly origin: WorldOrigin) {
    this.front = origin.y - 12.0;
    this.scale = characterModelScale(character);
    for (const cue of fighterCueList(character)) {
      if (cue.drawn === true || this.cues.some((known) => known.cue === cue)) continue;
      this.cues.push({ cue, model: AddSpecialEffect(cue.model, origin.x, origin.y) });
    }
    this.clear();
  }

  clear(): void {
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry !== undefined) parkOnce(entry.model, this.origin, parked, index);
    }
    this.shown = undefined;
    this.shownAction = 0;
  }

  present(fighter: Readonly<Fighter> | undefined, playing: boolean, paused: boolean): void {
    const state: CueState | undefined = fighter === undefined || !playing ? undefined : specialCueState(fighter);
    const cue = state === undefined || state.cues === undefined || state.phase === "none" ? undefined : state.phase === "startup" ? state.cues.startup : state.cues.active;
    const parked = (this.parked ??= []);
    for (let index = 0; index < this.cues.length; index++) {
      const entry = this.cues[index];
      if (entry === undefined) continue;
      if (fighter === undefined || entry.cue !== cue) {
        parkOnce(entry.model, this.origin, parked, index);
        continue;
      }
      const { model } = entry;
      if (this.shown !== cue || this.shownAction !== fighter.special.action) BlzSetSpecialEffectTime(model, 0.0);
      parked[index] = false;
      const anchor = CUE_ANCHORS[entry.cue.anchor];
      BlzSetSpecialEffectPosition(model, this.origin.x + fighter.motion.x + fighter.facing * anchor.x * this.scale, this.front, this.origin.z + fighter.motion.z + anchor.z * this.scale);
      BlzSetSpecialEffectYaw(model, facingYaw(fighter.facing));
      BlzSetSpecialEffectScale(model, entry.cue.scale * this.scale);
      BlzSetSpecialEffectAlpha(model, 255);
      BlzSetSpecialEffectTimeScale(model, paused || fighter.launch.hitlag > 0 ? 0.0 : 1.0);
    }
    this.shown = cue;
    this.shownAction = fighter?.special.action ?? 0;
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
