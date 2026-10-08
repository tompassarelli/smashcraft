import { withExKit } from "../exSpecialAuthoring";
import { type AuthoredSpecial, type FighterSpecials, frames } from "../heroSpecials";
import { peonHit } from "./peonMoves";

const lumberToss = (air: boolean): AuthoredSpecial => ({
  endFrame: 40, landingLag: air ? 20 : undefined,
  projectiles: [{
    model: "Abilities\\Weapons\\AncientProtectorMissile\\AncientProtectorMissile.mdl",
    spawnFrame: 14, offsetX: 34.0, offsetZ: 48.0, velocityX: 9.0, velocityZ: 0.0,
    life: 70, radius: 18.0, effect: peonHit(8.0, 35, 75.0, 18.0), reflectable: true, limit: 1,
  }],
});

const BURROW: AuthoredSpecial = {
  endFrame: 52, groundOnly: true,
  placement: {
    frame: 26, offsetX: 80.0, radius: 28.0, height: 76.0, durability: 32.0, life: 240,
    fireAges: [45, 85, 125, 165, 205],
    shot: {
      model: "Abilities\\Weapons\\HunterMissile\\HunterMissile.mdl",
      spawnFrame: 0, offsetX: 28.0, offsetZ: 48.0, velocityX: 12.0, velocityZ: 0.0,
      life: 36, radius: 12.0, effect: peonHit(5.0, 35, 75.0, 18.0), reflectable: true, limit: 3,
    },
  },
};

const vault = (x: number, z: number): AuthoredSpecial => ({
  endFrame: 28, motion: [{ ...frames(8, 28), velocityX: 0.0, velocityZ: z, driftSpeed: x }],
  oncePerAirtime: true, helpless: true, facesStick: true,
});

const repair = (air: boolean): AuthoredSpecial => ({
  endFrame: 38, landingLag: air ? 20 : undefined,
  intangible: frames(4, 7), guard: { ...frames(4, 7), heal: 4.0 },
});

export const PEON_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Lumber Toss", description: "Toss a slow bundle of lumber to clear some working room.", ground: lumberToss(false), air: lumberToss(true) }, { damage: 1.25 }),
  side: withExKit({ name: "Burrow", description: "Build a fragile burrow that fires spears; press again to pack it up.", ground: BURROW, recall: { name: "Pack Up", endFrame: 52, groundOnly: true, recall: true } }, { durability: 1.25, damage: 1.25, recallProtection: 4 }),
  up: withExKit({ name: "Worksite Launch", description: "Vault toward the stage, then fall helpless.", ground: vault(6.0, 16.0) }, { travel: 1.25 }),
  down: withExKit({ name: "Repair", description: "Duck behind the tools; a correctly timed hit repairs a little damage.", ground: repair(false), air: repair(true) }, { guardFrames: 4 }),
};
