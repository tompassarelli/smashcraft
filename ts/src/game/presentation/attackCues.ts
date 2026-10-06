// Signature normals that show a stock Warcraft effect where their hit region
// is live (#144): the multi-hit aerials and drills (#152) and Illidan's
// raid-boss normals (#147). Each hit restarts the effect, so a drill reads as
// its separate spins; the effect stands at the live region's centre. Most
// normals show only their swing and hit spark: effects stay on the moves whose
// identity is the effect (Sakurai: effects must not outshine the fighter).
// Presentation only: the region is read, never changed.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { EYE_BLAST_CHARGE_FRAMES, attackStartupFrames } from "../sim/moves";
import { HERO_ROSTER } from "../sim/heroes/registry";
import { type Cue, fighterOwnCues } from "./specialCues";

const cue = (model: string, scale: number): Cue => ({ model, anchor: "body", scale });

/** A normal's effect from an active frame on (0 is the first), the last entry at or before it applying. */
export interface AttackCue {
  readonly name: string;
  readonly fromActive: number;
  readonly cue: Cue;
}

export const ATTACK_CUES: { readonly [character: number]: { readonly [style: number]: readonly AttackCue[] } } = {
  [Character.blademaster]: {
    [AttackStyle.downAir]: [{ name: "Bladestorm", fromActive: 0, cue: cue("Abilities\\Spells\\Other\\Tornado\\Tornado_Target.mdx", f32(0.45)) }],
    [AttackStyle.neutralAir]: [{ name: "Blade Wheel", fromActive: 0, cue: cue("Abilities\\Spells\\Human\\SunderingBlades\\SunderingBlades.mdx", f32(0.7)) }],
  },
  [Character.warden]: {
    [AttackStyle.downAir]: [{ name: "Falling Knives", fromActive: 0, cue: cue("Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx", 1.0) }],
    [AttackStyle.upAir]: [{ name: "Sky Crescent", fromActive: 0, cue: cue("Abilities\\Weapons\\SentinelMissile\\SentinelMissile.mdx", 1.0) }],
  },
  [Character.shadowHunter]: {
    [AttackStyle.downAir]: [{ name: "Glaive drill", fromActive: 0, cue: cue("Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx", f32(1.2)) }],
  },
  [Character.dreadlord]: {
    [AttackStyle.neutralAir]: [{ name: "Batwing Turn", fromActive: 0, cue: cue("Abilities\\Weapons\\BansheeMissile\\BansheeMissile.mdx", f32(1.2)) }],
    // The dash passes through its target: a dark avenger streak marks the cross-up.
    [AttackStyle.dashAttack]: [{ name: "Wing cross-up", fromActive: 0, cue: cue("Abilities\\Weapons\\AvengerMissile\\AvengerMissile.mdx", 1.0) }],
  },
  [Character.lich]: {
    [AttackStyle.neutralAir]: [{ name: "Frost Halo", fromActive: 0, cue: cue("Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx", f32(0.45)) }],
    // The lingering ice crown above his shoulders.
    [AttackStyle.upTilt]: [{ name: "Ice crown", fromActive: 0, cue: cue("Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathMissile.mdx", f32(0.8)) }],
  },
  [Character.pitLord]: {
    // Demonic Bulk, the strongest dash attack: the ground shakes under the heave.
    [AttackStyle.dashAttack]: [{ name: "Demonic Bulk", fromActive: 0, cue: cue("Abilities\\Spells\\Orc\\WarStomp\\WarStompCaster.mdx", f32(0.45)) }],
  },
  [Character.demonHunter]: {
    // Eye Blast: the fel breath of the green dragon along the floor beam.
    [AttackStyle.forwardSmash]: [{ name: "Eye Blast", fromActive: 0, cue: cue("Abilities\\Weapons\\GreenDragonMissile\\GreenDragonMissile.mdx", f32(1.5)) }],
    // Flames of Azzinoth: the planted glaives, then the fire wall.
    [AttackStyle.downSmash]: [
      { name: "Azzinoth glaives", fromActive: 0, cue: cue("Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx", f32(1.4)) },
      { name: "Flames of Azzinoth", fromActive: 3, cue: cue("Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx", f32(0.6)) },
    ],
    // Twin glaives: a crossing link, then the opening launcher.
    [AttackStyle.forwardAir]: [{ name: "Twin glaives", fromActive: 0, cue: cue("Abilities\\Weapons\\IllidanMissile\\IllidanMissile.mdx", 1.0) }],
  },
};

/** Eye Blast's charge: his eyes burn once it has charged long enough to fire the beam. */
export const EYE_BLAST_CHARGE_CUE: Cue = { model: "Abilities\\Spells\\Other\\Drain\\DrainCaster.mdx", anchor: "overhead", scale: f32(0.6) };

/** What a fighter's normal shows this frame: its cue, the live region's centre and a key that changes with each hit. */
export interface AttackCueState {
  cue: Cue | undefined;
  x: number;
  z: number;
  key: number;
}

// Preallocated scratch: presentation queries regions every frame.
const scratch: HitRegion = emptyHitRegion();

/** Writes the cue the fighter's current normal shows into `out`; its cue is undefined when it shows none. */
export function attackCueState(fighter: Readonly<Fighter>, out: AttackCueState): AttackCueState {
  out.cue = undefined;
  const { style, frame, smashCharging, smashChargeFrames } = fighter.attack;
  if (style === undefined || fighter.status.out) return out;
  if (fighter.character === Character.demonHunter && style === AttackStyle.forwardSmash && smashCharging && smashChargeFrames >= EYE_BLAST_CHARGE_FRAMES) {
    out.cue = EYE_BLAST_CHARGE_CUE;
    out.x = 0.0;
    out.z = 125.0;
    out.key = -1;
    return out;
  }
  const cues = ATTACK_CUES[fighter.character]?.[style];
  if (cues === undefined) return out;
  const moves = fighter.tuning.moves;
  const count = authoredHitRegionCount(style, moves);
  for (let index = 0; index < count; index++) {
    const region = authoredHitRegion(scratch, fighter.character, style, frame, smashChargeFrames, index, moves);
    if (region.effect.damage <= 0.0) continue;
    const activeFrame = frame - attackStartupFrames(style, moves);
    let chosen = 0;
    for (let entry = 0; entry < cues.length; entry++) if ((cues[entry]?.fromActive ?? 0) <= activeFrame) chosen = entry;
    out.cue = cues[chosen]?.cue;
    out.x = f32(f32(region.minX + region.maxX) * 0.5);
    out.z = f32(f32(region.minZ + region.maxZ) * 0.5);
    // A new hit: another region, another contact window, or another cue.
    out.key = index * 1000 + region.window * 10 + chosen;
    return out;
  }
  return out;
}

/** Every cue a fighter's normals can show. */
export function fighterAttackCues(character: Character): readonly Cue[] {
  const out: Cue[] = [];
  for (const cues of Object.values(ATTACK_CUES[character] ?? {})) for (const { cue } of cues) if (!out.includes(cue)) out.push(cue);
  if (character === Character.demonHunter) out.push(EYE_BLAST_CHARGE_CUE);
  return out;
}

/** Every model an attack cue draws, every fighter's. */
export function allAttackCueModels(): readonly string[] {
  const models: string[] = [];
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter, ...HERO_ROSTER.map((hero) => hero.character)]) {
    for (const { model } of fighterAttackCues(character)) if (!models.includes(model)) models.push(model);
  }
  return models;
}

/** Every cue a fighter's renderer draws itself, one effect each: its specials' and its normals'. */
export function fighterRenderedCues(character: Character): readonly Cue[] {
  const out: Cue[] = [];
  for (const cue of [...fighterOwnCues(character), ...fighterAttackCues(character)]) if (!out.includes(cue)) out.push(cue);
  return out;
}
