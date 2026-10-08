import { imod } from "wisp/src/sim/intMath";
import { SurfaceContact } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { elementLook } from "./elementLooks";
import { SWING_SOUND, TIER_HIT_VOLUME, TIER_SWING_PITCH, TIER_SWING_VOLUME, tierHitPath } from "./moveTiers";
import { at } from "wisp/src/runtime/lookup";
import { type ImpactEvents, ImpactLanding, JumpCue } from "./impactEvents";
import { IMPACT_FIRE_HIT, IMPACT_SLASH_HIT, IMPACT_ICE_HIT, IMPACT_ELECTRIC_SHIELD, IMPACT_PUMMEL } from "./impactState";
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL, IMPACT_JUMP_MODEL, IMPACT_SHIELD_MODEL, IMPACT_HIT_MODEL, IMPACT_KO_MODEL } from "../assets/impactAssetInfo";

/** Stock Lightning Shield: a looping ball of electric orbs about 340 units across at scale 1. */
export const ELECTRIC_IMPACT_MODEL = "Abilities\\Spells\\Orc\\LightningShield\\LightningShieldTarget.mdx";

/** Movement uses small authored geometry so pooled dust respects scale and fading. */
export function impactModel(kind: number): string {
  switch (kind) {
    case 0: case IMPACT_PUMMEL: return IMPACT_HIT_MODEL;
    case 1: return IMPACT_TECH_MODEL;
    case 13: case 16: return "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
    case 2: return "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx";
    case 3: return IMPACT_DUST_MODEL;
    case 4: return IMPACT_ROLL_MODEL;
    // Forked Lightning target drew a 40 px speck natively (f9d0fbf3); Lightning Shield's orbs are geometry.
    case 5: case IMPACT_ELECTRIC_SHIELD: return ELECTRIC_IMPACT_MODEL;
    // Ledge catch is Melee's contact spark at the lip, the same spark shield contact uses.
    // Defend caster and Cleave target drew nothing as standalone effects in native capture (2f1115cd).
    case 6: case 10: case 12: case 14: return IMPACT_SHIELD_MODEL;
    case 7: return IMPACT_JUMP_MODEL;
    case 11: return IMPACT_JUMP_MODEL;
    // Ledge recovery is Melee's climb dust.
    case 15: return IMPACT_DUST_MODEL;
    case 8: return IMPACT_KO_MODEL;
    case 9: return "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx";
    case IMPACT_FIRE_HIT: return IMPACT_HIT_MODEL;
    case IMPACT_SLASH_HIT: return IMPACT_HIT_MODEL;
    case IMPACT_ICE_HIT: return "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx";
    default: return "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
  }
}

/** These stock impacts name their only visible sequence Stand, rather than Birth. */
export function impactAnimation(kind: number): string {
  return kind === 0 || kind === 1 || kind === 2 || kind === 3 || kind === 4 || kind === 6 || kind === 7 || kind === 8 || kind === 9 || kind === 10
    || kind === 11 || kind === 12 || kind === 14 || kind === 15 || kind === IMPACT_FIRE_HIT || kind === IMPACT_PUMMEL
    || kind === IMPACT_SLASH_HIT || kind === 5 || kind === IMPACT_ELECTRIC_SHIELD ? "Stand" : "Birth";
}

/** Dispel Magic's first sparkle ring starts after 0.17 s; ready and star-KO cues skip that gap. */
export function impactStartSeconds(kind: number): number {
  switch (kind) {
    case 13: case 16: return 0.25;
    default: return 0.0;
  }
}

/**
 * Normal contact draws at 1.5 so even the small tier reads at gameplay zoom.
 * Lightning Shield's orbs span about 340 units at scale 1: an electric hit
 * draws them about a fighter across, a shield hit a little smaller.
 */
export function impactModelScale(kind: number): number {
  if (kind === 5) return 1.0;
  if (kind === IMPACT_ELECTRIC_SHIELD) return 0.6000000238418579;
  return kind === 0 || kind === IMPACT_PUMMEL ? 1.5 : 1.0;
}

/** Plays a sound label, or with `file` a sound file by path, at a position. */
type ImpactSoundSink = (sound: string, x: number, z: number, volume: number, pitch: number, file: boolean) => void;

/**
 * Confirmed event audio; the renderer's frame cursor suppresses repeats.
 * Element, floor-tech and run/dash cues play near full volume: at the volume
 * of an ordinary hit (70) or walk, native capture didn't pick them out.
 */
export function presentImpactSounds(events: Readonly<ImpactEvents>, sink: ImpactSoundSink): void {
  const play = (label: string, volume = 100, pitch = 1.0) => sink(label, events.x, events.z, volume, pitch, false);
  if (events.swing >= 0) sink(SWING_SOUND, events.x, events.z, at(TIER_SWING_VOLUME, events.swing), at(TIER_SWING_PITCH, events.swing), true);
  if (events.throwRelease) play("BlinkTarget");
  else if (events.pummel) play("Defend", 75, 1.5);
  else if (events.hit) {
    // A cut or a blunt hit plays the game's own weapon sound of its tier; an element plays its own sound, louder by tier.
    const electric = events.element !== HitElement.fire && events.electric;
    const file = electric ? undefined : tierHitPath(events.element, events.tier, events.variant);
    const volume = at(TIER_HIT_VOLUME, events.tier);
    if (file !== undefined) sink(file, events.x, events.z, volume, 1.0, true);
    else play(electric ? "LightningBolt" : elementLook(events.element).sound ?? "LightningBolt", volume);
  }
  if (events.shieldHit || events.shieldReflect) play(events.shieldElectric ? "LightningBolt" : "Defend", 90, events.shieldReflect ? 1.5 : 1.0);
  if (events.shieldBreak) play("ThunderClap");
  if (events.grab) play("EntanglingRoots", 70);
  if (events.landing === ImpactLanding.tech || events.surface === SurfaceContact.techWall || events.surface === SurfaceContact.techCeiling) play("DispelMagic", 120);
  else if (events.landing === ImpactLanding.missedTech || events.surfaceMissedTech) play("Warstomp", 90);
  else if (events.ordinaryLanding) play("DeepFootstep", 65, 0.75);
  if (events.ledgeCatch || events.ledgeRecovery) play("BlinkTarget", 55, 1.5);
  if (events.jump !== JumpCue.none) play("BlinkTarget", events.jump === JumpCue.ground ? 45 : 60, 1.5);
  if (events.footstep !== "none") play(events.footstep === "walk" ? "DeepFootstep" : "DeepFootstep2", events.footstep === "walk" ? 35 : events.footstep === "dash" ? 115 : 90, events.footstep === "walk" ? 1.0 : 1.25);
  if (events.koDirectionX !== 0 || events.koDirectionZ !== 0) play("ThunderClap");
}

/** No position enters gameplay. Hitlag's remaining frame drives a bounded visual vibration. */
export function hitlagShake(fighter: Readonly<Fighter>): number {
  if (fighter.launch.hitlag <= 0 || fighter.shield.stun > 0 || fighter.launch.hitstun <= 0 && !(fighter.visuals.hitPummel && fighter.grab.owner !== undefined)) return 0.0;
  const magnitude = fighter.visuals.hitElectric || fighter.visuals.hitElement === HitElement.electric ? 3.0 : 2.0;
  return imod(fighter.launch.hitlag, 2) === 0 ? magnitude : -magnitude;
}

/** A damage hue follows the contact freeze and reeling, ending when control returns. */
export function damageTint(fighter: Readonly<Fighter>): Readonly<{ red: number; green: number; blue: number }> | undefined {
  if (fighter.status.out || fighter.shield.stun > 0 || fighter.launch.hitstun <= 0 && !(fighter.launch.hitlag > 0 && fighter.visuals.hitPummel && fighter.grab.owner !== undefined)) return undefined;
  return elementLook(fighter.visuals.hitElement).tint;
}
