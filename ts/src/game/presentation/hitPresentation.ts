import { imod } from "wisp/src/sim/intMath";
import { SurfaceContact } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { type ImpactEvents, ImpactLanding, JumpCue } from "./impactEvents";
import { IMPACT_FIRE_HIT, IMPACT_SLASH_HIT, IMPACT_ICE_HIT, IMPACT_ELECTRIC_SHIELD, IMPACT_PUMMEL } from "./impactState";

/** Warcraft archive paths: no imported art or audio. */
export function impactModel(kind: number): string {
  switch (kind) {
    case 0: case IMPACT_PUMMEL: return "Abilities\\Spells\\Other\\Stampede\\StampedeMissileDeath.mdx";
    case 1: case 13: case 14: case 16: return "Abilities\\Spells\\Human\\DispelMagic\\DispelMagicTarget.mdx";
    case 2: return "Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx";
    case 3: case 4: return "Objects\\Spawnmodels\\Undead\\ImpaleTargetDust\\ImpaleTargetDust.mdx";
    case 5: case IMPACT_ELECTRIC_SHIELD: return "Abilities\\Weapons\\Bolt\\BoltImpact.mdx";
    case 6: case 10: case 12: return "Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx";
    case 7: case 11: case 15: return "Abilities\\Spells\\NightElf\\Blink\\BlinkTarget.mdx";
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
  return kind === 2 || kind === 5 || kind === 8 || kind === 9 || kind === IMPACT_ELECTRIC_SHIELD ? "Stand" : "Birth";
}

type ImpactSoundSink = (label: string, x: number, z: number, volume: number, pitch: number) => void;

/** Confirmed event audio; the renderer's frame cursor suppresses repeats. */
export function presentImpactSounds(events: Readonly<ImpactEvents>, sink: ImpactSoundSink): void {
  const play = (label: string, volume = 100, pitch = 1.0) => sink(label, events.x, events.z, volume, pitch);
  if (events.throwRelease) play("BlinkTarget");
  else if (events.pummel) play("Defend", 75, 1.5);
  else if (events.hit) play(events.element === HitElement.fire ? "Fireball" : events.element === HitElement.electric || events.electric ? "LightningBolt"
    : events.element === HitElement.ice ? "FrostNova" : events.element === HitElement.slash ? "RelentlessCleave" : "StampedeHit", 70 + events.strength * 15, events.strength === 2 ? 0.75 : 1.0);
  if (events.shieldHit || events.shieldReflect) play(events.shieldElectric ? "LightningBolt" : "Defend", 90, events.shieldReflect ? 1.5 : 1.0);
  if (events.shieldBreak) play("ThunderClap");
  if (events.grab) play("EntanglingRoots", 70);
  if (events.landing === ImpactLanding.tech || events.surface === SurfaceContact.techWall || events.surface === SurfaceContact.techCeiling) play("DispelMagic", 80);
  else if (events.landing === ImpactLanding.missedTech || events.surfaceMissedTech) play("Warstomp", 90);
  else if (events.ordinaryLanding) play("DeepFootstep", 65, 0.75);
  if (events.ledgeCatch || events.ledgeRecovery) play("BlinkTarget", 55, 1.5);
  if (events.jump !== JumpCue.none) play("BlinkTarget", events.jump === JumpCue.ground ? 45 : 60, 1.5);
  if (events.footstep !== "none") play(events.footstep === "walk" ? "DeepFootstep" : "DeepFootstep2", events.footstep === "walk" ? 35 : events.footstep === "dash" ? 65 : 50, events.footstep === "walk" ? 1.0 : 1.25);
  if (events.koDirectionX !== 0 || events.koDirectionZ !== 0) play("ThunderClap");
}

const NORMAL = { red: 255, green: 230, blue: 180 } as const;
const FIRE = { red: 255, green: 150, blue: 80 } as const;
const ELECTRIC = { red: 180, green: 220, blue: 255 } as const;
const SLASH = { red: 255, green: 200, blue: 200 } as const;
const ICE = { red: 155, green: 210, blue: 255 } as const;

/** No position enters gameplay. Hitlag's remaining frame drives a bounded visual vibration. */
export function hitlagShake(fighter: Readonly<Fighter>): number {
  if (fighter.launch.hitlag <= 0 || fighter.shield.stun > 0 || fighter.launch.hitstun <= 0 && !(fighter.visuals.hitPummel && fighter.grab.owner !== undefined)) return 0.0;
  const magnitude = fighter.visuals.hitElectric || fighter.visuals.hitElement === HitElement.electric ? 3.0 : 2.0;
  return imod(fighter.launch.hitlag, 2) === 0 ? magnitude : -magnitude;
}

export function hitlagTint(fighter: Readonly<Fighter>): Readonly<{ red: number; green: number; blue: number }> | undefined {
  if (fighter.launch.hitlag <= 0 || fighter.shield.stun > 0 || fighter.launch.hitstun <= 0 && !(fighter.visuals.hitPummel && fighter.grab.owner !== undefined)) return undefined;
  switch (fighter.visuals.hitElement) {
    case HitElement.fire: return FIRE;
    case HitElement.electric: return ELECTRIC;
    case HitElement.slash: return SLASH;
    case HitElement.ice: return ICE;
    default: return NORMAL;
  }
}
