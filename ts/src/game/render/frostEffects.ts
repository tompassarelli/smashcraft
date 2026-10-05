// Freeze traps and ice shells, one of each per participant slot, created with
// the match. Presentation follows numerical state, so it can be reapplied after
// a restore without spawning another trap or shell.
import { FROST_ICE_MODEL, FROST_TRAP_MODEL } from "../assets/frostAssetInfo";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "../sim/fighter";
import { type ParkedFlags, type WorldOrigin, parkOnce } from "./effects";

interface FrostSlot {
  readonly trap: effect;
  readonly ice: effect;
}

export class FrostEffects {
  private readonly slots: readonly FrostSlot[];
  /** A slot's trap at twice the slot, its shell after it. */
  private parked: ParkedFlags | undefined;

  constructor(private readonly origin: WorldOrigin) {
    this.slots = PARTICIPANT_SLOTS.map(() => ({
      trap: AddSpecialEffect(FROST_TRAP_MODEL, origin.x, origin.y),
      ice: AddSpecialEffect(FROST_ICE_MODEL, origin.x, origin.y),
    }));
    this.clear();
  }

  clear(): void {
    for (let slot = 0; slot < this.slots.length; slot++) this.hideSlot(slot);
  }

  hideSlot(slot: number): void {
    const frost = this.slots[slot];
    if (frost === undefined) return;
    const parked = (this.parked ??= []);
    parkOnce(frost.trap, this.origin, parked, 2 * slot);
    parkOnce(frost.ice, this.origin, parked, 2 * slot + 1);
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const frost = this.slots[slot];
    if (frost === undefined) return;
    const { x, y, z } = this.origin;
    const out = fighter.status.out;
    const trap = fighter.freezeTrap;
    const parked = (this.parked ??= []);
    if (trap.life > 0 && !out) {
      parked[2 * slot] = false;
      BlzSetSpecialEffectPosition(frost.trap, x + trap.x, y, z + trap.z);
      BlzSetSpecialEffectScale(frost.trap, 1.0);
      BlzSetSpecialEffectAlpha(frost.trap, trap.arming > 0 ? 100 : 255);
    } else {
      parkOnce(frost.trap, this.origin, parked, 2 * slot);
    }
    if (fighter.status.frozenFrames > 0 && !out) {
      parked[2 * slot + 1] = false;
      BlzSetSpecialEffectPosition(frost.ice, x + fighter.motion.x, y, z + fighter.motion.z);
      BlzSetSpecialEffectScale(frost.ice, 1.0);
      BlzSetSpecialEffectAlpha(frost.ice, 255);
    } else {
      parkOnce(frost.ice, this.origin, parked, 2 * slot + 1);
    }
  }

  destroy(): void {
    for (const { trap, ice } of this.slots) {
      DestroyEffect(trap);
      DestroyEffect(ice);
    }
  }
}
