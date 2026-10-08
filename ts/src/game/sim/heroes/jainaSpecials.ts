import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../heroSpecials";
import { jainaCastBody, jainaHit } from "./jainaMoves";

const h = (n: number) => f32(HERO_REFERENCE_HEIGHT * f32(n));
const WATER_SHOT: SpecialProjectile = {
  model: "Abilities\\Weapons\\WaterElementalMissile\\WaterElementalMissile.mdx",
  spawnFrame: 0, offsetX: 15.0, offsetZ: 55.0, velocityX: h(f32(0.1)), velocityZ: 0.0,
  life: 48, radius: h(f32(0.12)), effect: jainaHit(5.0, 35, 70.0, 20.0), reflectable: true, limit: 3,
};
const FROSTBOLT: AuthoredSpecial = {
  cost: 6, endFrame: 37, landingLag: 20, hurt: jainaCastBody(13, 22),
  projectiles: [{
    model: "Abilities\\Weapons\\SorceressMissile\\SorceressMissile.mdx",
    spawnFrame: 17, offsetX: h(f32(0.35)), offsetZ: 55.0, velocityX: h(f32(0.12)), velocityZ: 0.0,
    life: 64, radius: h(f32(0.12)), effect: jainaHit(7.0, 35, 75.0, 18.0), reflectable: true, limit: 1,
  }],
};
const ice = (activeFrom: number, life: number, damage: number): SpecialProjectile => ({
  model: "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx",
  spawnFrame: 8, offsetX: h(f32(1.6)), offsetZ: 45.0, velocityX: 0.0, velocityZ: 0.0,
  life, activeFrom, radius: h(f32(0.55)), effect: jainaHit(damage, 80, damage === 5.0 ? 55.0 : 100.0, 24.0),
  reflectable: false, limit: 1, cancelOnInterrupt: true, needsLineOfSight: true,
});
const BLIZZARD: AuthoredSpecial = {
  cost: 18, endFrame: 48, landingLag: 20, hurt: jainaCastBody(5, 48),
  projectiles: [ice(21, 40, 5.0), ice(45, 48, 8.0)],
};
const blink = (cost: number, distance: number): AuthoredSpecial => ({
  cost, endFrame: 34, aimFrames: 13,
  motion: [{ ...frames(1, 13), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(14, 14), velocityX: 0.0, velocityZ: h(distance), aimedSpeed: h(distance), throughEdge: true },
    { ...frames(15, 34), velocityX: 0.0, velocityZ: 0.0 }],
  intangible: frames(14, 17), oncePerAirtime: true, helpless: true,
});
const SUMMON: AuthoredSpecial = {
  cost: 24, endFrame: 52, groundOnly: true, hurt: jainaCastBody(20, 33),
  placement: {
    frame: 27, offsetX: h(f32(0.65)), radius: 25.0, height: 92.0, durability: 24.0,
    life: 240, fireAges: [36, 84, 132, 180], shot: WATER_SHOT,
  },
};

export const JAINA_SPECIALS: FighterSpecials = {
  neutral: { name: "Frostbolt", description: "A straight frost bolt; jump it or shield it.", ground: FROSTBOLT },
  side: { name: "Blizzard", description: "Ice falls twice on the marked patch ahead; leave it before the first strike.", ground: BLIZZARD },
  up: { name: "Blink", description: "Aim a teleport, then fall helpless. Empty mana shortens its reach.", ground: blink(15, f32(3.2)), free: blink(0, f32(1.85)) },
  down: { name: "Summon Water Elemental", description: "Summon a fragile ally that fires four water bolts. Press again to recall it.", ground: SUMMON,
    recall: { cost: 0, endFrame: 26, groundOnly: true, recall: true } },
};
