import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion, NO_HIT_REGION } from "../sim/hitRegions";
import { fighterHurtParts } from "../sim/hurtboxes";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import { attackDurationFramesForGrounding } from "../sim/moves";
import { DEMONHUNTER_GLIDE_SLASH_FIRST, DEMONHUNTER_GLIDE_SLASH_LAST, DEMONHUNTER_GLIDE_SLASH_FORM, DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, felRushRegion, flameCrashRegion, immolationRegion, glideSlashRegion } from "../sim/specials";


export const DISJOINT_MODELS: { readonly [character: number]: string } = {
  [Character.rifleman]: "Abilities\\Weapons\\FlyingMachine\\FlyingMachineImpact.mdx",
  [Character.demonHunter]: "Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx",
  [Character.blademaster]: "Abilities\\Weapons\\SentinelMissile\\SentinelMissile.mdx",
  [Character.mountainKing]: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
  [Character.warden]: "Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx",
  [Character.lich]: "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx",
  [Character.forsakenPaladin]: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx",
  [Character.dreadlord]: "Abilities\\Weapons\\BansheeMissile\\BansheeMissile.mdx",
  [Character.shadowHunter]: "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx",
  [Character.pitLord]: "Abilities\\Weapons\\GreenDragonMissile\\GreenDragonMissile.mdx",
  [Character.beastmaster]: "Abilities\\Weapons\\Axe\\AxeMissile.mdx",
  [Character.lichKing]: "Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathMissile.mdx",
  [Character.chen]: "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx",
  [Character.kaelthas]: "Abilities\\Weapons\\PhoenixMissile\\Phoenix_Missile.mdx",
  [Character.kobold]: "Abilities\\Weapons\\Axe\\AxeMissile.mdx",
  [Character.thrall]: "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx",
  [Character.jaina]: "Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx",
  [Character.sylvanas]: "Abilities\\Spells\\Other\\BlackArrow\\BlackArrowMissile.mdl",
  [Character.cairne]: "Abilities\\Weapons\\RockBoltMissile\\RockBoltMissile.mdx",
  [Character.peon]: "Abilities\\Weapons\\catapult\\CatapultMissile.mdx",
  [Character.tinker]: "Abilities\\Spells\\Other\\AcidBomb\\BottleMissile.mdx",
  [Character.murloc]: "Abilities\\Weapons\\MurgulMagicMissile\\MurgulMagicMissile.mdx",
  [Character.grom]: "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx",
  [Character.anubarak]: "Abilities\\Weapons\\CryptFiendMissile\\CryptFiendMissile.mdx",
  [Character.malfurion]: "Abilities\\Weapons\\KeeperGroveMissile\\KeeperGroveMissile.mdx",
  [Character.medivh]: "Abilities\\Weapons\\DruidoftheTalonMissile\\DruidoftheTalonMissile.mdx",
};


export const DEFINITIVE_ACCENT_REDRAWS: { readonly [model: string]: string } = {
  "Abilities\\Weapons\\DemonHunterMissile\\DemonHunterMissile.mdx": "Popcorn glaive missile",
  "Abilities\\Weapons\\SentinelMissile\\SentinelMissile.mdx": "HD glaive",
  "Abilities\\Spells\\Other\\FrostBolt\\FrostBoltMissile.mdx": "HD frost bolt with Popcorn trail",
  "Abilities\\Spells\\NightElf\\FanOfKnives\\FanOfKnivesMissile.mdx": "Popcorn knife",
  "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx": "Popcorn holy light",
  "Abilities\\Weapons\\BansheeMissile\\BansheeMissile.mdx": "Popcorn banshee wisp",
  "Abilities\\Weapons\\ShadowHunterMissile\\ShadowHunterMissile.mdx": "HD glaive with Popcorn trail",
  "Abilities\\Weapons\\Axe\\AxeMissile.mdx": "HD thrown axe",
  "Abilities\\Spells\\Undead\\FreezingBreath\\FreezingBreathMissile.mdx": "Popcorn frost breath",
  "Abilities\\Spells\\Other\\BreathOfFire\\BreathOfFireDamage.mdx": "Popcorn flame",
  "Abilities\\Weapons\\PhoenixMissile\\Phoenix_Missile.mdx": "Popcorn fireball",
  "Abilities\\Weapons\\FarseerMissile\\FarseerMissile.mdx": "Popcorn lightning orb",
  "Abilities\\Spells\\Other\\FrostDamage\\FrostDamage.mdx": "Popcorn frost burst",
  "Abilities\\Spells\\Other\\BlackArrow\\BlackArrowMissile.mdl": "Popcorn black arrow",
  "Abilities\\Weapons\\RockBoltMissile\\RockBoltMissile.mdx": "HD rock bolt",
  "Abilities\\Weapons\\catapult\\CatapultMissile.mdx": "HD catapult stone",
  "Abilities\\Spells\\Other\\AcidBomb\\BottleMissile.mdx": "HD acid bottle",
  "Abilities\\Weapons\\MurgulMagicMissile\\MurgulMagicMissile.mdx": "HD Mur'gul bolt",
  "Abilities\\Spells\\Other\\ImmolationRed\\ImmolationRedDamage.mdx": "Popcorn red flame",
  "Abilities\\Weapons\\CryptFiendMissile\\CryptFiendMissile.mdx": "HD crypt fiend web",
  "Abilities\\Weapons\\KeeperGroveMissile\\KeeperGroveMissile.mdx": "HD Keeper bolt",
  "Abilities\\Weapons\\DruidoftheTalonMissile\\DruidoftheTalonMissile.mdx": "Popcorn raven bolt",
};

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

export interface FanKnifePose extends HitAreaPose { yaw: number; pitch: number; alpha: number; }


export function fanKnifePose(fighter: Readonly<Fighter>, index: number, out: FanKnifePose): FanKnifePose {
  const ray = specialAreaRegion(fighter, index).strike;
  out.visible = fighter.character === Character.warden && fighter.special.action === SpecialAction.heroDown
    && !fighter.status.out && ray !== undefined;
  if (!out.visible || ray === undefined) return out;
  out.x = f32(fighter.motion.x + f32(fighter.facing * ray.x2));
  out.z = f32(fighter.motion.z + ray.z2);
  out.yaw = ray.x2 * fighter.facing < 0.0 ? f32(Math.PI) : 0.0;
  const tilt = ray.x2 === 0.0 ? f32(Math.PI * 0.5) : f32(Math.PI * 0.25);
  out.pitch = ray.z2 === 48.0 ? 0.0 : ray.z2 > 48.0 ? -tilt : tilt;
  out.scale = f32(0.6);
  out.alpha = 255;
  return out;
}


export function hitAreaPose(fighter: Readonly<Fighter>, region: Readonly<HitRegion>, out: HitAreaPose): HitAreaPose {
  out.visible = region.effect.damage > 0.0 && !fighter.status.out;
  out.x = f32(fighter.motion.x + f32(fighter.facing * f32(f32(region.minX + region.maxX) * 0.5)));
  out.z = f32(fighter.motion.z + f32(f32(region.minZ + region.maxZ) * 0.5));
  out.scale = f32(Math.max(0.5, f32(Math.max(f32(region.maxX - region.minX), f32(region.maxZ - region.minZ)) / 100.0)));
  return out;
}
