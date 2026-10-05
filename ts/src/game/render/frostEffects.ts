// Freeze traps and ice shells, one of each per participant slot, created with
// the match. Presentation follows numerical state, so it can be reapplied after
// a restore without spawning another trap or shell.
import { FROST_ICE_MODEL, FROST_TRAP_MODEL } from "../assets/frostAssetInfo";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "../sim/fighter";
import { type WorldOrigin, hideEffect } from "./effects";

interface FrostSlot {
  readonly trap: effect;
  readonly ice: effect;
}

export class FrostEffects {
  private readonly slots: readonly FrostSlot[];

  constructor(private readonly origin: WorldOrigin) {
    this.slots = PARTICIPANT_SLOTS.map(() => ({
      trap: AddSpecialEffect(FROST_TRAP_MODEL, origin.x, origin.y),
      ice: AddSpecialEffect(FROST_ICE_MODEL, origin.x, origin.y),
    }));
    this.clear();
  }

  clear(): void {
    for (const { trap, ice } of this.slots) {
      hideEffect(trap, this.origin);
      hideEffect(ice, this.origin);
    }
  }

  hideSlot(slot: number): void {
    const frost = this.slots[slot];
    if (frost === undefined) return;
    hideEffect(frost.trap, this.origin);
    hideEffect(frost.ice, this.origin);
  }

  present(fighter: Readonly<Fighter>, slot: number): void {
    const frost = this.slots[slot];
    if (frost === undefined) return;
    const { x, y, z } = this.origin;
    const out = fighter.status.out;
    const trap = fighter.freezeTrap;
    if (trap.life > 0 && !out) {
      BlzSetSpecialEffectPosition(frost.trap, x + trap.x, y, z + trap.z);
      BlzSetSpecialEffectScale(frost.trap, 1.0);
      BlzSetSpecialEffectAlpha(frost.trap, trap.arming > 0 ? 100 : 255);
    } else {
      hideEffect(frost.trap, this.origin);
    }
    if (fighter.status.frozenFrames > 0 && !out) {
      BlzSetSpecialEffectPosition(frost.ice, x + fighter.motion.x, y, z + fighter.motion.z);
      BlzSetSpecialEffectScale(frost.ice, 1.0);
      BlzSetSpecialEffectAlpha(frost.ice, 255);
    } else {
      hideEffect(frost.ice, this.origin);
    }
  }

  destroy(): void {
    for (const { trap, ice } of this.slots) {
      DestroyEffect(trap);
      DestroyEffect(ice);
    }
  }
}
