import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion, NO_HIT_REGION } from "../sim/hitRegions";
import { fighterHurtParts } from "../sim/hurtboxes";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { attackDurationFramesForGrounding } from "../sim/moves";
import { DEMONHUNTER_GLIDE_SLASH_FIRST, DEMONHUNTER_GLIDE_SLASH_LAST, DEMONHUNTER_GLIDE_SLASH_FORM, DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, felRushRegion, flameCrashRegion, immolationRegion, glideSlashRegion } from "../sim/specials";

/** Warcraft's own moving spell/weapon art, used as a held contact accent. */
export const DISJOINT_MODELS: { readonly [character: number]: string } = {
  [Character.archer]: "Abilities\\Weapons\\Arrow\\ArrowMissile.mdx",
  [Character.rifleman]: "Abilities\\Weapons\\GyroCopter\\GyroCopterMissile.mdx",
  [Character.demonHunter]: "Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx",
  [Character.blademaster]: "Abilities\\Weapons\\SentinelMissile\\SentinelMissile.mdx",
  [Character.mountainKing]: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
  [Character.warden]: "Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx",
  [Character.lich]: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
  [Character.uther]: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx",
  [Character.dreadlord]: "Abilities\\Weapons\\BansheeMissile\\BansheeMissile.mdx",
  [Character.shadowHunter]: "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx",
  [Character.pitLord]: "Abilities\\Weapons\\GreenDragonMissile\\GreenDragonMissile.mdx",
  [Character.beastmaster]: "Abilities\\Weapons\\Axe\\AxeMissile.mdx",
  [Character.lichKing]: "Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathMissile.mdx",
  [Character.kaelthas]: "Abilities\\Weapons\\PhoenixMissile\\Phoenix_Missile.mdx",
};

/** Beyond the current body by more than half its standing width, along either gameplay axis. */
export function isDisjointRegion(fighter: Readonly<Fighter>, region: Readonly<HitRegion>): boolean {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const part of fighterHurtParts(fighter)) {
    minX = Math.min(minX, part.x1 - part.radius, part.x2 - part.radius);
    maxX = Math.max(maxX, part.x1 + part.radius, part.x2 + part.radius);
    minZ = Math.min(minZ, part.z1 - part.radius, part.z2 - part.radius);
    maxZ = Math.max(maxZ, part.z1 + part.radius, part.z2 + part.radius);
  }
  const halfWidth = hurtCapsule(fighter.character).radius;
  return region.effect.damage > 0.0 && (region.minX < minX - halfWidth || region.maxX > maxX + halfWidth || region.minZ < minZ - halfWidth || region.maxZ > maxZ + halfWidth);
}

/** Called once while creating a fighter's presentation, never during a callback. */
export function disjointNormals(fighter: Fighter): readonly AttackStyle[] {
  const styles: AttackStyle[] = [];
  const scratch = emptyHitRegion();
  const previousStyle = fighter.attack.style, previousFrame = fighter.attack.frame;
  for (const style of Object.values(AttackStyle)) {
    if (style === AttackStyle.demonHunterDashAttack && fighter.character !== Character.demonHunter) continue;
    if (style === AttackStyle.dashAttack && fighter.tuning.moves?.dashAttack !== style) continue;
    if ((style === AttackStyle.jab2 || style === AttackStyle.jab3) && fighter.tuning.moves?.normals[style] === undefined) continue;
    fighter.attack.style = style;
    const count = authoredHitRegionCount(style, fighter.tuning.moves);
    const duration = attackDurationFramesForGrounding(style, true, fighter.tuning.moves);
    let found = false;
    for (let frame = 0; frame < duration && !found; frame++) {
      fighter.attack.frame = frame;
      for (let index = 0; index < count; index++) {
        const region = authoredHitRegion(scratch, fighter.character, style, frame, 0, index, fighter.tuning.moves);
        if (isDisjointRegion(fighter, region)) { found = true; break; }
      }
    }
    if (found) styles.push(style);
  }
  fighter.attack.style = previousStyle;
  fighter.attack.frame = previousFrame;
  return styles;
}

/** The same special regions the collision code reads, on its entry-one clock. */
export function specialAreaRegion(fighter: Readonly<Fighter>, index: number): Readonly<HitRegion> {
  const move = runningHeroSpecial(fighter);
  if (move !== undefined) {
    const region = move.regions?.[index];
    const frame = fighter.special.frame - 1;
    return region !== undefined && frame >= region.firstFrame && frame <= region.lastFrame ? region.hit : NO_HIT_REGION;
  }
  if (index > 0 || fighter.character !== Character.demonHunter) return NO_HIT_REGION;
  const { action, form, frame } = fighter.special;
  if (action === SpecialAction.demonHunterFelRush) return felRushRegion(form, frame);
  if (action === SpecialAction.demonHunterWingAscent && form === DEMONHUNTER_GLIDE_SLASH_FORM && frame >= DEMONHUNTER_GLIDE_SLASH_FIRST && frame <= DEMONHUNTER_GLIDE_SLASH_LAST) return glideSlashRegion();
  if (action !== SpecialAction.demonHunterImmolate) return NO_HIT_REGION;
  if (form !== 0) return flameCrashRegion(form, frame);
  return frame >= DEMONHUNTER_IMMOLATE_STARTUP && frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE ? immolationRegion(fighter.motion.grounded) : NO_HIT_REGION;
}

export interface HitAreaPose { visible: boolean; x: number; z: number; scale: number; }

/** World centre, independent of fighter model scale, camera or facing. */
export function hitAreaPose(fighter: Readonly<Fighter>, region: Readonly<HitRegion>, out: HitAreaPose): HitAreaPose {
  out.visible = region.effect.damage > 0.0 && !fighter.status.out;
  out.x = f32(fighter.motion.x + f32(fighter.facing * f32(f32(region.minX + region.maxX) * 0.5)));
  out.z = f32(fighter.motion.z + f32(f32(region.minZ + region.maxZ) * 0.5));
  out.scale = f32(Math.max(0.5, f32(Math.max(f32(region.maxX - region.minX), f32(region.maxZ - region.minZ)) / 100.0)));
  return out;
}
