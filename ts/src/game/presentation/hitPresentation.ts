import { imod } from "wisp/src/sim/intMath";
import { SurfaceContact } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { elementLook } from "./elementLooks";
import { SWING_SOUND, TIER_HIT_VOLUME, TIER_SWING_PITCH, TIER_SWING_VOLUME, tierHitPath } from "./moveTiers";
import { at } from "wisp/src/runtime/lookup";
import { type ImpactEvents, ImpactLanding, JumpCue } from "./impactEvents";
import { IMPACT_FIRE_HIT, IMPACT_SLASH_HIT, IMPACT_ICE_HIT, IMPACT_ELECTRIC_SHIELD, IMPACT_PUMMEL } from "./impactState";
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL, IMPACT_JUMP_MODEL } from "../assets/impactAssetInfo";

/** Movement uses small authored geometry so pooled dust respects scale and fading. */
export function impactModel(kind: number): string {
  switch (kind) {
    case 0: case IMPACT_PUMMEL: return "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx";
    case 1: return IMPACT_TECH_MODEL;
    case 13: case 16: return "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
    case 2: return "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx";
    case 3: return IMPACT_DUST_MODEL;
    case 4: return IMPACT_ROLL_MODEL;
    case 5: case IMPACT_ELECTRIC_SHIELD: return "Abilities\\Spells\\Other\\ForkedLightning\\ForkedLightningTarget.mdx";
    // Ledge catch is Melee's contact spark at the lip, the same spark shield contact uses.
    case 6: case 10: case 12: case 14: return "Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx";
    case 7: return IMPACT_JUMP_MODEL;
    case 11: return "Abilities\\Spells\\NightElf\\Blink\\BlinkTarget.mdx";
    // Ledge recovery is Melee's climb dust.
    case 15: return "Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx";
    case 8: return "Abilities\\Spells\\Human\\Thunderclap\\ThunderClapCaster.mdx";
    case 9: return "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx";
    case IMPACT_FIRE_HIT: return "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx";
    case IMPACT_SLASH_HIT: return "Abilities\\Spells\\Other\\Cleave\\CleaveDamageTarget.mdx";
    case IMPACT_ICE_HIT: return "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx";
    default: return "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
  }
}

/** These stock impacts name their only visible sequence Stand, rather than Birth. */
export function impactAnimation(kind: number): string {
  return kind === 1 || kind === 2 || kind === 3 || kind === 4 || kind === 7 || kind === 8 || kind === 9 ? "Stand" : "Birth";
}

/**
 * Seconds into its sequence an impact starts. A pooled cue shows for 9-15
 * frames, but Blink target draws nothing before 0.33 s and peaks at
 * 0.63-0.87 s, and Dispel Magic target's first sparkle ring shows from
 * 0.17 s and peaks at 0.33-0.43 s; Forked Lightning target's flash reaches
 * full size at 0.13 s. Each starts where its model is already drawn. Native
 * capture at 7d58ef69 showed nothing for Blink started at 0.6 s, so a cue
 * that must show uses a model that draws from 0 s instead.
 */
export function impactStartSeconds(kind: number): number {
  switch (kind) {
    case 5: case IMPACT_ELECTRIC_SHIELD: return 0.10000000149011612;
    case 11: return 0.6000000238418579;
    case 13: case 16: return 0.25;
    default: return 0.0;
  }
}

/**
 * Cleave target's sparks are a few units across at scale 1, too small to read
 * as a hit; slash draws them 7.5 times larger. Normal contact draws at 1.5
 * so even the small tier reads at gameplay zoom. An electric hit draws Forked
 * Lightning at least as large as an electric shield hit's (scale 1), which
 * showed natively where a hit's 0.75 lasted one frame.
 */
export function impactModelScale(kind: number): number {
  return kind === IMPACT_SLASH_HIT ? 7.5 : kind === 0 || kind === IMPACT_PUMMEL || kind === 5 ? 1.5 : 1.0;
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
