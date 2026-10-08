// Hero passives (#148, smashcraft:docs/design/passives.md): one counted,
// visible passive per fighter, never a chance. A fighter's counter fills on
// the events its passive counts; full, the next qualifying hit procs, and a
// ready proc that meets a shield is spent with no bonus. All state lives in
// `Fighter.passive`, so snapshots, the checksum and rollback carry it.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { roundToFloat32 } from "wisp/src/sim/binary32";
import { Character, GrabAction, HitOrigin, LedgeState, PassiveKind, ProjectileKind } from "./codes";
import { isAerialAttack } from "./moves";
import type { Fighter, Projectile } from "./fighter";
import { gainMana } from "./mana";

interface PassiveSpec {
  readonly kind: PassiveKind;
  /** Stacks at which the passive is ready (Shadow Hunter's spend at any stack). */
  readonly stacks: number;
  /** Frames a counted event keeps the stacks; 0 keeps them until spent or the stock ends. */
  readonly window: number;
}

const NONE: PassiveSpec = { kind: PassiveKind.none, stacks: 0, window: 0 };
const WINDFURY: PassiveSpec = { kind: PassiveKind.criticalStrike, stacks: 2, window: 180 };
const ENDURANCE: PassiveSpec = { kind: PassiveKind.endurance, stacks: 2, window: 180 };
const PILLAGE: PassiveSpec = { kind: PassiveKind.pillage, stacks: 2, window: 0 };
const ENGINEERING_UPGRADE: PassiveSpec = { kind: PassiveKind.voodoo, stacks: 2, window: 240 };

/** By Character code. Illidan has none: his attacks drain mana on hit (his kit data). */
const SPECS: Readonly<Record<number, PassiveSpec>> = {
  1: { kind: PassiveKind.longRifles, stacks: 3, window: 0 },
  2: NONE,
  3: { kind: PassiveKind.criticalStrike, stacks: 3, window: 180 },
  4: { kind: PassiveKind.bash, stacks: 2, window: 120 },
  5: { kind: PassiveKind.blink, stacks: 1, window: 0 },
  6: { kind: PassiveKind.frostArmor, stacks: 2, window: 180 },
  7: { kind: PassiveKind.devotion, stacks: 3, window: 0 },
  8: { kind: PassiveKind.vampiric, stacks: 2, window: 240 },
  9: { kind: PassiveKind.voodoo, stacks: 2, window: 240 },
  10: { kind: PassiveKind.cleave, stacks: 2, window: 180 },
  11: { kind: PassiveKind.packHunt, stacks: 1, window: 0 },
  12: { kind: PassiveKind.souls, stacks: 3, window: 0 },
};

const DRUNKEN_BRAWLER: PassiveSpec = { kind: PassiveKind.criticalStrike, stacks: 3, window: 180 };

export function passiveSpec(character: Character): PassiveSpec {
  if (character === Character.sylvanas) return SPECS[Character.shadowHunter] ?? NONE;
  if (character === Character.thrall) return WINDFURY;
  if (character === Character.cairne) return ENDURANCE;
  if (character === Character.chen) return DRUNKEN_BRAWLER;
  if (character === Character.peon) return PILLAGE;
  if (character === Character.tinker) return ENGINEERING_UPGRADE;
  return SPECS[character] ?? NONE;
}

const CRITICAL_STRIKE_SCALE = f32(1.5);
const CRITICAL_STRIKE_MAX_BONUS = 6.0;
export const BASH_HITSTUN_FRAMES = 10;
const DEVOTION_KNOCKBACK_SCALE = f32(0.8);
const VAMPIRIC_HEAL = 2.0;
export const VAMPIRIC_HEAL_CAP = 8.0;
const VOODOO_BONUS_PER_STACK = 2.0;
const CLEAVE_BONUS = 3.0;
const PACK_HUNT_BONUS = 3.0;
/** Frames between Beastmaster's hit and his bear's bite (either order) that make a pair. */
const PACK_HUNT_WINDOW = 40;
/** Long Rifles: the shot's life, 1.5 times the blaster's 60 frames. */
export const LONG_RIFLE_LIFE = 90;

/** What a contact did to its source's passive, for the resolver and presentation. */
export const PassiveProc = { none: 0, damage: 1, bash: 2, heal: 3, spent: 4, cleaveShield: 5 } as const;
export type PassiveProc = (typeof PassiveProc)[keyof typeof PassiveProc];

/** A new stock or a rematch starts every passive empty. */
export function resetPassive(f: Fighter): void {
  const { passive } = f;
  passive.stacks = 0;
  passive.window = 0;
  passive.spent = 0.0;
  passive.used = false;
  passive.lastKey = -1;
  passive.lastTarget = -1;
}

/** Counts the window down; at zero the stacks clear. Warden's restore renews on the ground. */
export function advancePassive(f: Fighter): void {
  const { passive } = f;
  if (passive.window > 0) {
    passive.window--;
    if (passive.window === 0) {
      passive.stacks = 0;
      if (f.character === Character.cairne) passive.used = false;
    }
  }
  if (f.character === Character.warden && (f.motion.grounded || f.ledge.state !== LedgeState.none)) passive.used = false;
}

function addStack(f: Fighter, spec: PassiveSpec): void {
  const { passive } = f;
  passive.stacks = min(spec.stacks, passive.stacks + 1);
  passive.window = spec.window;
}

function proc(f: Fighter): void {
  const { passive } = f;
  passive.stacks = 0;
  passive.window = 0;
  passive.serial++;
}

/** Whether the origin is one the source's own passive counts on its side of a hit. */
function counts(source: Readonly<Fighter>, kind: PassiveKind, origin: HitOrigin, direct: boolean): boolean {
  switch (kind) {
    case PassiveKind.criticalStrike: return origin === HitOrigin.melee;
    case PassiveKind.pillage: return origin === HitOrigin.melee;
    case PassiveKind.bash: return origin !== HitOrigin.pummel && origin !== HitOrigin.foreign && origin !== HitOrigin.summon;
    case PassiveKind.vampiric: return origin === HitOrigin.melee || origin === HitOrigin.throw;
    case PassiveKind.voodoo: return origin === HitOrigin.voodoo || origin === HitOrigin.melee;
    case PassiveKind.blink: return origin === HitOrigin.melee && direct && isAerialAttack(source.attack.style);
    case PassiveKind.cleave: return origin === HitOrigin.melee;
    case PassiveKind.endurance: return origin === HitOrigin.melee;
    case PassiveKind.packHunt: return origin === HitOrigin.melee || origin === HitOrigin.summon;
    // Frostmourne Hungers: a landed normal or aerial, or Harvest Soul (his down throw).
    case PassiveKind.souls: return (origin === HitOrigin.melee && source.attack.style !== undefined)
      || (origin === HitOrigin.throw && source.grab.action === GrabAction.throwDown);
    default: return false;
  }
}

/**
 * The source's side of one contact as it is collected: counts it, and on a
 * proc changes `damage` in place. `key` identifies the attack so a multi-hit
 * move counts once per target (-1: every contact counts). Returns the proc.
 */
export function sourcePassiveContact(
  source: Fighter, targetSlot: number, origin: HitOrigin, direct: boolean, blocked: boolean, key: number,
  effect: { damage: number },
): PassiveProc {
  const spec = passiveSpec(source.character);
  const { passive } = source;
  if (!counts(source, spec.kind, origin, direct)) return PassiveProc.none;
  if (spec.kind === PassiveKind.endurance && key >= 0 && key === passive.lastKey) return PassiveProc.none;
  if (key >= 0 && key === passive.lastKey && targetSlot === passive.lastTarget) return PassiveProc.none;
  const previousTarget = passive.lastTarget;
  passive.lastKey = key;
  passive.lastTarget = targetSlot;
  const ready = passive.stacks >= spec.stacks;
  switch (spec.kind) {
    case PassiveKind.endurance: {
      if (blocked || passive.used) return PassiveProc.none;
      addStack(source, spec);
      if (passive.stacks >= spec.stacks) {
        passive.used = true;
        passive.window = 120;
        passive.serial++;
      }
      return PassiveProc.none;
    }
    case PassiveKind.voodoo: {
      if (origin === HitOrigin.voodoo) {
        if (!blocked) addStack(source, spec);
        return PassiveProc.none;
      }
      if (passive.stacks === 0) return PassiveProc.none;
      const bonus = f32(VOODOO_BONUS_PER_STACK * passive.stacks);
      proc(source);
      if (blocked) return PassiveProc.spent;
      effect.damage = roundToFloat32(f32(effect.damage + bonus));
      return PassiveProc.damage;
    }
    case PassiveKind.blink: {
      if (blocked || passive.used || source.motion.grounded) return PassiveProc.none;
      passive.used = true;
      passive.serial++;
      // Airborne, a fighter holds at most its one aerial jump (stocks.ts gives 2 on the ground).
      source.jump.remaining = max(source.jump.remaining, 1);
      return PassiveProc.none;
    }
    case PassiveKind.packHunt: {
      if (blocked) return PassiveProc.none;
      // `stacks` holds which body opened the pair: 1 Beastmaster, 2 the bear.
      const by = origin === HitOrigin.summon ? 2 : 1;
      if (passive.window > 0 && passive.stacks !== by && previousTarget === targetSlot) {
        proc(source);
        effect.damage = roundToFloat32(f32(effect.damage + PACK_HUNT_BONUS));
        return PassiveProc.damage;
      }
      passive.stacks = by;
      passive.window = PACK_HUNT_WINDOW;
      return PassiveProc.none;
    }
    case PassiveKind.souls: {
      // Souls are banked, never procced: his soul-empowered specials spend them (heroSpecialRules.ts).
      if (!blocked) addStack(source, spec);
      return PassiveProc.none;
    }
    case PassiveKind.cleave: {
      // The one passive that counts a shield: his third cleaver contact, hit or blocked, cleaves.
      if (!ready) {
        addStack(source, spec);
        return PassiveProc.none;
      }
      proc(source);
      if (blocked) return PassiveProc.cleaveShield;
      effect.damage = roundToFloat32(f32(effect.damage + CLEAVE_BONUS));
      return PassiveProc.damage;
    }
    default: break;
  }
  if (!ready) {
    if (!blocked) addStack(source, spec);
    return PassiveProc.none;
  }
  proc(source);
  if (blocked) return PassiveProc.spent;
  switch (spec.kind) {
    case PassiveKind.criticalStrike: {
      const bonus = min(CRITICAL_STRIKE_MAX_BONUS, f32(effect.damage * f32(CRITICAL_STRIKE_SCALE - 1.0)));
      effect.damage = roundToFloat32(f32(effect.damage + bonus));
      return PassiveProc.damage;
    }
    case PassiveKind.bash: return PassiveProc.bash;
    case PassiveKind.vampiric: return PassiveProc.heal;
    case PassiveKind.pillage:
      gainMana(source, 8);
      return PassiveProc.none;
    default: return PassiveProc.none;
  }
}

/** Dreadlord's Vampiric Aura heal, within its per-stock cap and never below 0%. */
export function vampiricHeal(f: Fighter): void {
  const { passive, status } = f;
  const healed = min(min(VAMPIRIC_HEAL, max(0.0, f32(VAMPIRIC_HEAL_CAP - passive.spent))), max(0.0, status.damage));
  status.damage = f32(status.damage - healed);
  passive.spent = f32(passive.spent + healed);
}

/** Lich's Frost Armor: a melee hit reaching him counts; true when this one chills its striker. */
export function frostArmorStruck(target: Fighter, sourceSlot: number, origin: HitOrigin, direct: boolean, key: number): boolean {
  const spec = passiveSpec(target.character);
  if (spec.kind !== PassiveKind.frostArmor || origin !== HitOrigin.melee || !direct) return false;
  // Lich's own hits never count, so the last-attack memory tracks the strikes he takes.
  const { passive } = target;
  if (key >= 0 && key === passive.lastKey && sourceSlot === passive.lastTarget) return false;
  passive.lastKey = key;
  passive.lastTarget = sourceSlot;
  if (target.passive.stacks < spec.stacks) {
    addStack(target, spec);
    return false;
  }
  proc(target);
  return true;
}

/** Forsaken Paladin's Devotion Aura: a hit his shield blocked counts. */
export function devotionBlocked(target: Fighter): void {
  const spec = passiveSpec(target.character);
  if (spec.kind === PassiveKind.devotion) addStack(target, spec);
}

/** Forsaken Paladin's Devotion Aura: the launch scale for a launching, non-throw hit, spending it. */
export function devotionLaunchScale(target: Fighter, isThrow: boolean): number {
  const spec = passiveSpec(target.character);
  if (spec.kind !== PassiveKind.devotion || isThrow || target.passive.stacks < spec.stacks) return 1.0;
  proc(target);
  return DEVOTION_KNOCKBACK_SCALE;
}

/** Rifleman's Long Rifles: counts a blaster shot fired; true when this one is the Long Rifle shot. */
export function longRifleShot(f: Fighter): boolean {
  const spec = passiveSpec(f.character);
  if (spec.kind !== PassiveKind.longRifles) return false;
  if (f.passive.stacks < spec.stacks) {
    addStack(f, spec);
    return false;
  }
  proc(f);
  return true;
}

interface PassivePipsState {
  lit: number;
  of: number;
  ready: boolean;
}

// Presentation reads pips every rendered frame for every slot, so they are written into scratch, never allocated.
const scratchPips: PassivePipsState = { lit: 0, of: 0, ready: false };

/** Pips to draw and whether they show the ready state, written into `out` (by default a shared scratch read at once). */
export function passivePips(f: Readonly<Fighter>, out: PassivePipsState = scratchPips): Readonly<PassivePipsState> {
  const spec = passiveSpec(f.character);
  const { passive } = f;
  if (spec.kind === PassiveKind.blink) {
    out.lit = passive.used ? 0 : 1;
    out.ready = !passive.used;
  } else if (spec.kind === PassiveKind.packHunt) {
    out.lit = passive.window > 0 ? 1 : 0;
    out.ready = passive.window > 0;
  } else {
    out.lit = passive.stacks;
    out.ready = spec.stacks > 0 && passive.stacks >= spec.stacks;
  }
  out.of = spec.stacks;
  return out;
}

/** What a projectile's hit counts as: one its owner didn't fire (a reflection) counts for no passive. */
export function projectileOrigin(owner: Readonly<Fighter>, projectile: Readonly<Projectile>): HitOrigin {
  if (projectile.visualFamily !== owner.character) return HitOrigin.foreign;
  switch (projectile.kind) {
    case ProjectileKind.blaster: return HitOrigin.blaster;
    default: return projectile.spec?.feedsPassive === true ? HitOrigin.voodoo : HitOrigin.projectile;
  }
}

/** The Lich King's banked souls (Frostmourne Hungers); 0 for every other fighter. */
export function heldSouls(f: Readonly<Fighter>): number {
  return passiveSpec(f.character).kind === PassiveKind.souls ? f.passive.stacks : 0;
}

/** Spends one banked soul on a soul-empowered special; the proc serial lets presentation show it. */
export function spendSoul(f: Fighter): void {
  if (heldSouls(f) <= 0) return;
  f.passive.stacks--;
  f.passive.serial++;
}

/** Endurance Aura changes ground speed only; its window lives in the replayed passive record. */
export function enduranceGroundSpeed(f: Readonly<Fighter>, speed: number): number {
  return f.character === Character.cairne && f.passive.used && f.passive.window > 0 ? f32(speed * f32(1.1)) : speed;
}
