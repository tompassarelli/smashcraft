import { HitElement } from "../sim/hitRegions";
import { SurfaceContact } from "../sim/codes";
import { ImpactLanding, JumpCue } from "../presentation/impactEvents";

/**
 * Native mapping inspection: each case names an observable effect and sound.
 * Contact, ledge and jump cues carry their own position: the event default is
 * the floor origin, which buries them.
 */
export const HIT_PRESENTATION_CASES = [
      { cue: { hit: true }, sound: "StampedeHit", model: "StampedeMissileDeath" },
      { cue: { hit: true, strength: 2 }, sound: "StampedeHit", model: "StampedeMissileDeath" },
      { cue: { hit: true, element: HitElement.electric, electric: true }, sound: "LightningBolt", model: "BoltImpact" },
      { cue: { hit: true, element: HitElement.fire }, sound: "Fireball", model: "FireLordDeathExplode" },
      { cue: { hit: true, element: HitElement.slash }, sound: "RelentlessCleave", model: "CleaveDamageTarget" },
      { cue: { hit: true, element: HitElement.ice }, sound: "FrostNova", model: "FrostNovaTarget" },
      { cue: { shieldHit: true }, sound: "Defend", model: "DefendCaster" },
      { cue: { shieldHit: true, shieldElectric: true }, sound: "LightningBolt", model: "BoltImpact" },
      { cue: { shieldReflect: true }, sound: "Defend", model: "DefendCaster" },
      { cue: { shieldBreak: true }, sound: "ThunderClap", model: "DefendCaster" },
      { cue: { landing: ImpactLanding.missedTech }, sound: "Warstomp", model: "WarStompCaster" },
      { cue: { landing: ImpactLanding.tech }, sound: "DispelMagic", model: "ImpactTech-" },
      { cue: { surface: SurfaceContact.techWall, contactX: 0.0, contactZ: 50.0, normalX: 1.0 }, sound: "DispelMagic", model: "ImpactTech-" },
      { cue: { surface: SurfaceContact.techCeiling, contactX: 0.0, contactZ: 50.0, normalZ: -1.0 }, sound: "DispelMagic", model: "ImpactTech-" },
      { cue: { ledgeCatch: true, ledgeX: 0.0, ledgeZ: 50.0 }, sound: "BlinkTarget", model: "DispelMagicTarget" },
      { cue: { ledgeRecovery: true, ledgeX: 0.0, ledgeZ: 50.0 }, sound: "BlinkTarget", model: "BlinkTarget" },
      { cue: { grab: true }, sound: "EntanglingRoots", model: "DefendCaster" },
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
