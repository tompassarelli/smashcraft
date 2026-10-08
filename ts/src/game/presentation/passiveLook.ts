// How each fighter's passive shows (#148, smashcraft:docs/design/passives.md,
// "Presentation"): a stock effect on the fighter while it is ready, and one
// where it procs. Local presentation read from the simulation.
import { Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { PARTICIPANT_SLOTS } from "../input/participants";

interface PassiveLook {
  /** Shown on the fighter's feet while the passive is ready. */
  readonly ready?: string | undefined;
  /** Played once per proc. */
  readonly proc?: string | undefined;
  /** The proc shows over the fighter it struck rather than the fighter itself. */
  readonly onVictim: boolean;
}

export const PASSIVE_MODELS = {
  trueshot: "Abilities\\Spells\\NightElf\\TrueshotAura\\TrueshotAura.mdx",
  frostArmor: "Abilities\\Spells\\Undead\\FrostArmor\\FrostArmorTarget.mdx",
  devotion: "Abilities\\Spells\\Human\\DevotionAura\\DevotionAura.mdx",
  vampiric: "Abilities\\Spells\\Undead\\VampiricAura\\VampiricAuraTarget.mdx",
  voodoo: "Abilities\\Spells\\Orc\\Voodoo\\VoodooAura.mdx",
  bash: "Abilities\\Spells\\Human\\Thunderclap\\ThunderclapTarget.mdx",
  blink: "Abilities\\Spells\\NightElf\\Blink\\BlinkTarget.mdx",
  critical: "Abilities\\Spells\\Other\\Cleave\\CleaveDamageTarget.mdx",
  longRifle: "Abilities\\Weapons\\Bolt\\BoltImpact.mdx",
  cleave: "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx",
  packHunt: "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx",
  endurance: "Abilities\\Spells\\Orc\\CommandAura\\CommandAura.mdx",
  pillage: "UI\\Feedback\\GoldCredit\\GoldCredit.mdl",
  heal: "Abilities\\Spells\\Human\\Heal\\HealTarget.mdx",
  frostProc: "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx",
} as const;

const NONE: PassiveLook = { onVictim: false };

export function passiveLook(character: Character): PassiveLook {
  switch (character) {
    case Character.cairne: return { ready: PASSIVE_MODELS.endurance, onVictim: false };
    case Character.thrall: return { proc: PASSIVE_MODELS.longRifle, onVictim: true };
    case Character.chen:
    case Character.blademaster: return { ready: PASSIVE_MODELS.endurance, proc: PASSIVE_MODELS.critical, onVictim: true };
    case Character.mountainKing: return { ready: PASSIVE_MODELS.devotion, proc: PASSIVE_MODELS.bash, onVictim: true };
    case Character.warden: return { ready: PASSIVE_MODELS.trueshot, proc: PASSIVE_MODELS.blink, onVictim: false };
    case Character.rifleman: return { ready: PASSIVE_MODELS.trueshot, proc: PASSIVE_MODELS.longRifle, onVictim: false };
    case Character.tinker: return { proc: PASSIVE_MODELS.longRifle, onVictim: true };
    case Character.archer: return { ready: PASSIVE_MODELS.trueshot, proc: PASSIVE_MODELS.longRifle, onVictim: true };
    case Character.lich: return { ready: PASSIVE_MODELS.frostArmor, proc: PASSIVE_MODELS.frostProc, onVictim: true };
    case Character.forsakenPaladin: return { ready: PASSIVE_MODELS.devotion, proc: PASSIVE_MODELS.devotion, onVictim: false };
    case Character.dreadlord: return { ready: PASSIVE_MODELS.vampiric, proc: PASSIVE_MODELS.heal, onVictim: false };
    case Character.shadowHunter: return { ready: PASSIVE_MODELS.voodoo, proc: PASSIVE_MODELS.bash, onVictim: true };
    case Character.sylvanas: return { ready: PASSIVE_MODELS.voodoo, onVictim: false };
    case Character.pitLord: return { ready: PASSIVE_MODELS.vampiric, proc: PASSIVE_MODELS.cleave, onVictim: true };
    case Character.beastmaster: return { ready: PASSIVE_MODELS.endurance, proc: PASSIVE_MODELS.packHunt, onVictim: true };
    case Character.peon: return { proc: PASSIVE_MODELS.pillage, onVictim: false };
    default: return NONE;
  }
}

/** Rendered updates a proc's effect stays up. */
export const PASSIVE_PROC_UPDATES = 30;

/** The fighter `slot`'s latest hit landed on, or `slot` itself when none shows that. */
export function passiveVictim(world: Readonly<Roster>, slot: number): Readonly<Fighter> {
  for (const other of PARTICIPANT_SLOTS) {
    if (other === slot || !isActive(world, other)) continue;
    const fighter = fighterAt(world, other);
    if (fighter.hits.lastAttacker === slot) return fighter;
  }
  return fighterAt(world, slot);
}

/** The proc serial a renderer last presented; -1 before its first update. */
export interface ProcCursor {
  seen: number;
}

/**
 * True once for each new proc. The first update only reads the serial, and a
 * rollback below it keeps the highest presented serial.
 */
export function newPassiveProc(cursor: ProcCursor, serial: number): boolean {
  if (cursor.seen < 0) {
    cursor.seen = serial;
    return false;
  }
  if (serial <= cursor.seen) return false;
  cursor.seen = serial;
  return true;
}
