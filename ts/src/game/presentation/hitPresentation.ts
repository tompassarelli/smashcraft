import { imod } from "wisp/src/sim/intMath";
import { SurfaceContact } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { elementLook } from "./elementLooks";
import { SoundTier, SWING_SOUND, TIER_HIT_VOLUME, TIER_SWING_PITCH, TIER_SWING_VOLUME, tierHitPath } from "./moveTiers";
import { at } from "wisp/src/runtime/lookup";
import { type ImpactEvents, ImpactLanding, JumpCue } from "./impactEvents";
import { moveSoundLabels, playHit, playPerform, playShieldHit, soundFiles } from "./moveSounds";
import { VoiceClass } from "./voiceBudget";
import type { Character } from "../sim/codes";
import { ELEMENTS } from "./elementLooks";
import { tierSoundPaths } from "./moveTiers";
import { STRONG_SPARK_SCALE } from "./moveTiers";
import { IMPACT_FIRE_HIT, IMPACT_SLASH_HIT, IMPACT_ICE_HIT, IMPACT_ELECTRIC_SHIELD, IMPACT_PUMMEL } from "./impactState";
import { IMPACT_DUST_MODEL, IMPACT_ROLL_MODEL, IMPACT_TECH_MODEL, IMPACT_JUMP_MODEL, IMPACT_SHIELD_MODEL, IMPACT_HIT_MODEL, IMPACT_KO_MODEL } from "../assets/impactAssetInfo";


export const ELECTRIC_IMPACT_MODEL = "Abilities\\Spells\\Orc\\LightningShield\\LightningShieldTarget.mdx";


export function impactModel(kind: number): string {
  switch (kind) {
    case 0: case IMPACT_PUMMEL: return IMPACT_HIT_MODEL;
    case 1: return IMPACT_TECH_MODEL;
    case 13: case 16: return "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
    case 2: return "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx";
    case 3: return IMPACT_DUST_MODEL;
    case 4: return IMPACT_ROLL_MODEL;

    case 5: case IMPACT_ELECTRIC_SHIELD: return ELECTRIC_IMPACT_MODEL;


    case 6: case 10: case 12: case 14: return IMPACT_SHIELD_MODEL;
    case 7: return IMPACT_JUMP_MODEL;
    case 11: return IMPACT_JUMP_MODEL;

    case 15: return IMPACT_DUST_MODEL;
    case 8: return IMPACT_KO_MODEL;
    case 9: return "Abilities\\Spells\\Human\\Resurrect\\ResurrectTarget.mdx";
    case IMPACT_FIRE_HIT: return IMPACT_HIT_MODEL;
    case IMPACT_SLASH_HIT: return IMPACT_HIT_MODEL;
    case IMPACT_ICE_HIT: return "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx";
    default: return "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
  }
}


const PLAIN_SPARK_COLOUR: readonly number[] = [255, 255, 255];
const FIRE_SPARK_COLOUR: readonly number[] = [255, 100, 25];
export const STRONG_SPARK_COLOUR: readonly number[] = [255, 205, 40];


export function impactColour(kind: number, strength: number): readonly number[] | undefined {
  if (kind !== 0 && kind !== IMPACT_SLASH_HIT && kind !== IMPACT_FIRE_HIT) return undefined;
  if (strength === STRONG_SPARK_SCALE) return STRONG_SPARK_COLOUR;
  return kind === IMPACT_FIRE_HIT ? FIRE_SPARK_COLOUR : PLAIN_SPARK_COLOUR;
}


export function impactAnimation(kind: number): string {
  return kind === 0 || kind === 1 || kind === 2 || kind === 3 || kind === 4 || kind === 6 || kind === 7 || kind === 8 || kind === 9 || kind === 10
    || kind === 11 || kind === 12 || kind === 14 || kind === 15 || kind === IMPACT_FIRE_HIT || kind === IMPACT_PUMMEL
    || kind === IMPACT_SLASH_HIT || kind === 5 || kind === IMPACT_ELECTRIC_SHIELD ? "Stand" : "Birth";
}


export function impactStartSeconds(kind: number): number {
  switch (kind) {
    case 13: case 16: return 0.25;
    default: return 0.0;
  }
}






export function impactModelScale(kind: number): number {
  if (kind === 5) return 1.0;
  if (kind === IMPACT_ELECTRIC_SHIELD) return 0.6000000238418579;
  return kind === 0 || kind === IMPACT_PUMMEL ? 1.5 : 1.0;
}


const IMPACT_LABELS: readonly string[] = ["LightningBolt", "BlinkTarget", "Defend", "ThunderClap", "EntanglingRoots", "DispelMagic", "Warstomp", "DeepFootstep", "DeepFootstep2"];

export interface ImpactSoundNames {
  readonly files: readonly string[];
  readonly labels: readonly string[];
}


export function impactSoundNames(characters: readonly Character[]): ImpactSoundNames {
  const files = new Set<string>(tierSoundPaths());
  const labels = new Set<string>(IMPACT_LABELS);
  for (const element of ELEMENTS) {
    const sound = elementLook(element).sound;
    if (sound === undefined) continue;
    labels.add(sound);
    for (const path of soundFiles(sound)) files.add(path);
  }
  for (const label of moveSoundLabels(characters)) for (const path of soundFiles(label)) files.add(path);
  return { files: [...files], labels: [...labels] };
}

export type ImpactSoundSink = (sound: string, x: number, z: number, volume: number, pitch: number, file: boolean, cls: VoiceClass) => void;






const fileSink = (sink: ImpactSoundSink, x: number, z: number, cls: VoiceClass) => (path: string, volume: number, pitch: number) => sink(path, x, z, volume, pitch, true, cls);


export function presentImpactSounds(events: Readonly<ImpactEvents>, sink: ImpactSoundSink): void {
  // Labels go straight to the sink: closures per call allocated about 1 KB a fighter every frame (#400).
  const { x, z } = events;
  if (events.perform >= 0) playPerform(events.character, events.perform, events.performSerial, fileSink(sink, x, z, VoiceClass.special));
  else if (events.swing >= 0) sink(SWING_SOUND, x, z, at(TIER_SWING_VOLUME, events.swing), at(TIER_SWING_PITCH, events.swing), true, VoiceClass.special);
  if (events.throwRelease) sink("BlinkTarget", x, z, 100, 1.0, false, VoiceClass.hit);
  else if (events.pummel) sink("Defend", x, z, 75, 1.5, false, VoiceClass.hit);
  else if (events.hit && events.hitMove >= 0) playHit(events.hitCharacter, events.hitMove, events.strong, events.element, events.variant, fileSink(sink, x, z, VoiceClass.hit));
  else if (events.hit) {

    const electric = events.element !== HitElement.fire && events.electric;
    const tier = events.strong ? SoundTier.large : events.tier;
    const path = electric ? undefined : tierHitPath(events.element, tier, events.variant);
    const volume = at(TIER_HIT_VOLUME, tier);
    if (path !== undefined) sink(path, x, z, volume, 1.0, true, VoiceClass.hit);
    else sink(electric ? "LightningBolt" : elementLook(events.element).sound ?? "LightningBolt", x, z, volume, 1.0, false, VoiceClass.hit);
  }
  if (events.shieldHit && events.shieldMove >= 0) playShieldHit(events.shieldCharacter, events.shieldMove, events.shieldVariant, fileSink(sink, x, z, VoiceClass.hit));
  if (events.shieldHit || events.shieldReflect) sink(events.shieldElectric ? "LightningBolt" : "Defend", x, z, 90, events.shieldReflect ? 1.5 : 1.0, false, VoiceClass.hit);
  if (events.shieldBreak) sink("ThunderClap", x, z, 100, 1.0, false, VoiceClass.hit);
  if (events.grab) sink("EntanglingRoots", x, z, 70, 1.0, false, VoiceClass.special);
  if (events.landing === ImpactLanding.tech || events.surface === SurfaceContact.techWall || events.surface === SurfaceContact.techCeiling) sink("DispelMagic", x, z, 120, 1.0, false, VoiceClass.movement);
  else if (events.landing === ImpactLanding.missedTech || events.surfaceMissedTech) sink("Warstomp", x, z, 90, 1.0, false, VoiceClass.movement);
  else if (events.ordinaryLanding) sink("DeepFootstep", x, z, 65, 0.75, false, VoiceClass.movement);
  if (events.ledgeCatch || events.ledgeRecovery) sink("BlinkTarget", x, z, 55, 1.5, false, VoiceClass.movement);
  if (events.jump !== JumpCue.none) sink("BlinkTarget", x, z, events.jump === JumpCue.ground ? 45 : 60, 1.5, false, VoiceClass.movement);
  if (events.footstep !== "none") sink(events.footstep === "walk" ? "DeepFootstep" : "DeepFootstep2", x, z, events.footstep === "walk" ? 35 : events.footstep === "dash" ? 115 : 90, events.footstep === "walk" ? 1.0 : 1.25, false, VoiceClass.movement);
  if (events.koDirectionX !== 0 || events.koDirectionZ !== 0) sink("ThunderClap", x, z, 100, 1.0, false, VoiceClass.ko);
}


export function hitlagShake(fighter: Readonly<Fighter>): number {
  if (fighter.launch.hitlag <= 0 || fighter.shield.stun > 0 || fighter.launch.hitstun <= 0 && !(fighter.visuals.hitPummel && fighter.grab.owner !== undefined)) return 0.0;
  const magnitude = fighter.visuals.hitElectric || fighter.visuals.hitElement === HitElement.electric ? 3.0 : 2.0;
  return imod(fighter.launch.hitlag, 2) === 0 ? magnitude : -magnitude;
}


export function damageTint(fighter: Readonly<Fighter>): Readonly<{ red: number; green: number; blue: number }> | undefined {
  if (fighter.status.out || fighter.shield.stun > 0 || fighter.launch.hitstun <= 0 && !(fighter.launch.hitlag > 0 && fighter.visuals.hitPummel && fighter.grab.owner !== undefined)) return undefined;
  return elementLook(fighter.visuals.hitElement).tint;
}
