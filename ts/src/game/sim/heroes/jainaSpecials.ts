import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../heroSpecials";
import { jainaCastBody, jainaHit } from "./jainaMoves";

const h = (n: number) => f32(HERO_REFERENCE_HEIGHT * f32(n));
const WATER_SHOT: SpecialProjectile = {
  model: "Abilities\\Weapons\\WaterElementalMissile\\WaterElementalMissile.mdx",
  spawnFrame: 0, offsetX: 15.0, offsetZ: 55.0, velocityX: h(f32(0.1)), velocityZ: 0.0,
  life: 48, radius: h(f32(0.12)), effect: jainaHit(4.760000228881836, 35, 73.70999908447266, 20.0), reflectable: true, limit: 3,
};
const FROSTBOLT: AuthoredSpecial = {
  endFrame: 37, landingLag: 20, hurt: jainaCastBody(13, 22),
  projectiles: [{
    model: "Abilities\\Weapons\\SorceressMissile\\SorceressMissile.mdx",
    spawnFrame: 17, offsetX: h(f32(0.35)), offsetZ: 55.0, velocityX: h(f32(0.12)), velocityZ: 0.0,
    life: 64, radius: h(f32(0.12)), effect: jainaHit(6.664000034332275, 35, 78.9749984741211, 18.0), reflectable: true, limit: 1,
  }],
};
const ice = (activeFrom: number, life: number, damage: number): SpecialProjectile => ({
  model: "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx",
  spawnFrame: 8, offsetX: h(f32(1.6)), offsetZ: 45.0, velocityX: 0.0, velocityZ: 0.0,
  life, activeFrom, radius: h(f32(0.55)), effect: jainaHit(damage, 80, damage === 4.760000228881836 ? 57.915000915527344 : 105.30000305175781, 24.0),
  reflectable: false, limit: 1, cancelOnInterrupt: true, needsLineOfSight: true,
});
const BLIZZARD: AuthoredSpecial = {
  endFrame: 48, landingLag: 20, hurt: jainaCastBody(5, 48),
  projectiles: [ice(21, 40, 4.760000228881836), ice(45, 48, 7.616000175476074)],
};
const blink = (distance: number): AuthoredSpecial => ({
  endFrame: 34, aimFrames: 13,
  motion: [{ ...frames(1, 13), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(14, 14), velocityX: 0.0, velocityZ: h(distance), aimedSpeed: h(distance), throughEdge: true },
    { ...frames(15, 34), velocityX: 0.0, velocityZ: 0.0 }],
  intangible: frames(14, 17), oncePerAirtime: true, helpless: true,
});
const SUMMON: AuthoredSpecial = {
  endFrame: 52, groundOnly: true, hurt: jainaCastBody(20, 33),
  placement: {
    frame: 27, offsetX: h(f32(0.65)), radius: 25.0, height: 92.0, durability: 24.0,
    life: 240, fireAges: [36, 84, 132, 180], shot: WATER_SHOT,
  },
};

export const JAINA_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Frostbolt", description: "A straight frost bolt; jump it or shield it.", ground: FROSTBOLT }, { damage: 1.25 }),
  side: withExKit({ name: "Blizzard", description: "Ice falls twice on the marked patch ahead; leave it before the first strike.", ground: BLIZZARD }, { damage: 1.25 }),
  up: withExKit({ name: "Blink", description: "Aim a teleport, then fall helpless.", ground: blink(f32(3.2)) }, { travel: 1.25 }),
  down: withExKit({ name: "Summon Water Elemental", description: "Summon a fragile ally that fires four water bolts. Press again to recall it.", ground: SUMMON,
    recall: { endFrame: 26, groundOnly: true, recall: true } }, { damage: 1.25, durability: 1.25, recallProtection: 4 }),
};
