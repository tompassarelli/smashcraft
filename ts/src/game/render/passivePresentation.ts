// A fighter's passive in the arena (#148): its ready effect on the fighter's
// feet while the passive is ready, and its proc effect where it procced,
// shown for a moment once per proc serial. Created with the fighter's other
// renderers; numerical state owns every outcome.
import { PASSIVE_PROC_UPDATES, type ProcCursor, newPassiveProc, passiveLook, passiveVictim } from "../presentation/passiveLook";
import type { Character } from "../sim/codes";
import { passivePips } from "../sim/passives";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { type WorldOrigin, hideEffect, placeEffect } from "./effects";

export class PassivePresentation {
  private readonly ready: effect | undefined;
  private readonly proc: effect | undefined;
  private readonly onVictim: boolean;
  private readyShown = false;
  private readyX = 0.0;
  private readyZ = 0.0;
  private readonly cursor: ProcCursor = { seen: -1 };
  private procLeft = 0;
  private procShown = false;

  constructor(character: Character, private readonly origin: WorldOrigin) {
    const look = passiveLook(character);
    this.onVictim = look.onVictim;
    this.ready = look.ready === undefined ? undefined : AddSpecialEffect(look.ready, origin.x, origin.y);
    this.proc = look.proc === undefined ? undefined : AddSpecialEffect(look.proc, origin.x, origin.y);
    if (this.ready !== undefined) hideEffect(this.ready, origin);
    if (this.proc !== undefined) hideEffect(this.proc, origin);
  }

  present(world: Readonly<Roster>, slot: number, playing: boolean): void {
    const fighter = playing && isActive(world, slot) ? fighterAt(world, slot) : undefined;
    if (fighter === undefined || fighter.status.out) {
      this.hideReady();
      this.hideProc();
      return;
    }
    const { origin } = this;
    if (this.ready !== undefined) {
      if (passivePips(fighter).ready) {
        if (!this.readyShown) BlzSetSpecialEffectScale(this.ready, 1.0);
        // Only a moved fighter moves its effect: this runs every rendered frame.
        if (!this.readyShown || fighter.motion.x !== this.readyX || fighter.motion.z !== this.readyZ) {
          this.readyX = fighter.motion.x;
          this.readyZ = fighter.motion.z;
          placeEffect(this.ready, origin.x + fighter.motion.x, origin.y, origin.z + fighter.motion.z);
        }
        this.readyShown = true;
      } else this.hideReady();
    }
    if (newPassiveProc(this.cursor, fighter.passive.serial)) this.procLeft = PASSIVE_PROC_UPDATES;
    if (this.proc === undefined) return;
    if (this.procLeft <= 0) {
      this.hideProc();
      return;
    }
    this.procLeft--;
    this.procShown = true;
    const at = this.onVictim ? passiveVictim(world, slot) : fighter;
    BlzSetSpecialEffectScale(this.proc, 1.0);
    placeEffect(this.proc, origin.x + at.motion.x, origin.y - 8.0, origin.z + at.motion.z + 60.0);
  }

  private hideReady(): void {
    if (!this.readyShown || this.ready === undefined) return;
    hideEffect(this.ready, this.origin);
    this.readyShown = false;
  }

  private hideProc(): void {
    this.procLeft = 0;
    if (!this.procShown || this.proc === undefined) return;
    hideEffect(this.proc, this.origin);
    this.procShown = false;
  }

  destroy(): void {
    // Each by name: in Lua a list whose first element is nil ends there, so
    // a fighter with only a proc effect would leave it behind every match.
    this.destroyModel(this.ready);
    this.destroyModel(this.proc);
  }

  private destroyModel(model: effect | undefined): void {
    if (model === undefined) return;
    hideEffect(model, this.origin);
    DestroyEffect(model);
  }
}
