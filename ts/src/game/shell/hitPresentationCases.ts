import { HitElement } from "../sim/hitRegions";
import { SurfaceContact } from "../sim/codes";
import { type ImpactEvents, ImpactLanding, JumpCue, createImpactEvents } from "../presentation/impactEvents";
import { presentImpactSounds } from "../presentation/hitPresentation";
import { ELEMENTS } from "../presentation/elementLooks";

/**
 * Native mapping inspection: each case names an observable effect and sound.
 * Contact, ledge and jump cues carry their own position: the event default is
 * the floor origin, which buries them.
 */
export const HIT_PRESENTATION_CASES = [
      { cue: { hit: true }, sound: "WoodLightBashFlesh1", model: "StampedeMissileDeath" },
      { cue: { hit: true, strength: 2, tier: 2 }, sound: "WoodHeavyBashFlesh1", model: "StampedeMissileDeath" },
      { cue: { hit: true, element: HitElement.electric, electric: true }, sound: "LightningBolt", model: "LightningShieldTarget" },
      { cue: { hit: true, element: HitElement.fire }, sound: "Fireball", model: "FireLordDeathExplode" },
      { cue: { hit: true, element: HitElement.slash }, sound: "MetalLightSliceFlesh1", model: "ImpactHit-" },
      { cue: { hit: true, element: HitElement.ice }, sound: "FrostNova", model: "FrostNovaTarget" },
      { cue: { shieldHit: true }, sound: "Defend", model: "ImpactShield-" },
      { cue: { shieldHit: true, shieldElectric: true }, sound: "LightningBolt", model: "LightningShieldTarget" },
      { cue: { shieldReflect: true }, sound: "Defend", model: "ImpactShield-" },
      { cue: { shieldBreak: true }, sound: "ThunderClap", model: "ImpactShield-" },
      { cue: { landing: ImpactLanding.missedTech }, sound: "Warstomp", model: "WarStompCaster" },
      { cue: { landing: ImpactLanding.tech }, sound: "DispelMagic", model: "ImpactTech-" },
      { cue: { surface: SurfaceContact.techWall, contactX: 0.0, contactZ: 50.0, normalX: 1.0 }, sound: "DispelMagic", model: "ImpactTech-" },
      { cue: { surface: SurfaceContact.techCeiling, contactX: 0.0, contactZ: 50.0, normalZ: -1.0 }, sound: "DispelMagic", model: "ImpactTech-" },
      { cue: { ledgeCatch: true, ledgeX: 0.0, ledgeZ: 50.0 }, sound: "BlinkTarget", model: "ImpactShield-" },
      { cue: { ledgeRecovery: true, ledgeX: 0.0, ledgeZ: 50.0 }, sound: "BlinkTarget", model: "ImpaleTargetDust" },
      { cue: { grab: true }, sound: "EntanglingRoots", model: "ImpactShield-" },
      { cue: { hit: true, pummel: true }, sound: "Defend", model: "StampedeMissileDeath" },
      { cue: { throwRelease: true, hit: true }, sound: "BlinkTarget", model: "BlinkTarget" },
      { cue: { koDirectionX: 1 }, sound: "ThunderClap", model: "ThunderClapCaster" },
      { cue: { footstep: "walk" as const, movementDust: true }, sound: "DeepFootstep", model: "ImpactDust-" },
      { cue: { footstep: "run" as const, runningDust: true }, sound: "DeepFootstep2", model: "ImpactDust-" },
      { cue: { footstep: "dash" as const, movementDust: true }, sound: "DeepFootstep2", model: "ImpactDust-" },
      { cue: { jump: JumpCue.ground }, sound: "BlinkTarget", model: "ImpactDust-" },
      { cue: { jump: JumpCue.double, jumpOriginX: 0.0, jumpOriginZ: 55.0 }, sound: "BlinkTarget", model: "ImpactJump-" },
      { cue: { jump: JumpCue.wall, contactX: 0.0, contactZ: 50.0, normalX: 1.0 }, sound: "BlinkTarget", model: "ImpactJump-" },
      { cue: { ordinaryLanding: true }, sound: "DeepFootstep", model: "ImpactDust-" },
] as const;

/** Every sound label hit presentation plays: the cases above and a hit of each element. */
export function hitPresentationSoundLabels(): string[] {
  const labels = new Set<string>();
  const cues: Partial<ImpactEvents>[] = [...HIT_PRESENTATION_CASES.map(({ cue }) => cue), ...ELEMENTS.map((element) => ({ hit: true, element }))];
  for (const cue of cues) presentImpactSounds({ ...createImpactEvents(), ...cue }, (label, _x, _z, _volume, _pitch, file) => { if (!file) labels.add(label); });
  return [...labels].sort();
}
