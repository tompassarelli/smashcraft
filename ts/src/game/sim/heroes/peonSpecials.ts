import { type AuthoredSpecial, type FighterSpecials, frames } from "../heroSpecials";
import { peonHit } from "./peonMoves";

const lumberToss = (air: boolean): AuthoredSpecial => ({
  cost: 0, endFrame: 42, landingLag: air ? 20 : undefined,
  projectiles: [{
    model: "Abilities\\Weapons\\AncientProtectorMissile\\AncientProtectorMissile.mdl",
    spawnFrame: 18, offsetX: 34.0, offsetZ: 48.0, velocityX: 9.0, velocityZ: 0.0,
    life: 70, radius: 18.0, effect: peonHit(7.0, 35, 75.0, 18.0), reflectable: true, limit: 1,
  }],
});

const BURROW: AuthoredSpecial = {
  cost: 20, endFrame: 52, groundOnly: true,
  placement: {
    frame: 26, offsetX: 80.0, radius: 28.0, height: 76.0, durability: 24.0, life: 240,
    fireAges: [45, 85, 125, 165, 205],
    shot: {
      model: "Abilities\\Weapons\\OrcBurrowMissile\\OrcBurrowMissile.mdl",
      spawnFrame: 0, offsetX: 28.0, offsetZ: 48.0, velocityX: 12.0, velocityZ: 0.0,
      life: 36, radius: 12.0, effect: peonHit(5.0, 35, 75.0, 18.0), reflectable: true, limit: 3,
    },
  },
};

const vault = (cost: number, x: number, z: number): AuthoredSpecial => ({
  cost, endFrame: 28, motion: [{ ...frames(8, 28), velocityX: x, velocityZ: z }],
  oncePerAirtime: true, helpless: true, facesStick: true,
});

const repair = (air: boolean): AuthoredSpecial => ({
  cost: 20, endFrame: 38, landingLag: air ? 20 : undefined,
  intangible: frames(4, 7), guard: { ...frames(4, 7), heal: 4.0, healCapPerStock: 12.0 },
});

export const PEON_SPECIALS: FighterSpecials = {
  neutral: { name: "Lumber Toss", description: "Toss a slow bundle of lumber to clear some working room.", ground: lumberToss(false), air: lumberToss(true) },
  side: { name: "Burrow", description: "Build a fragile burrow that fires spears; press again to pack it up.", ground: BURROW, recall: { name: "Pack Up", cost: 0, endFrame: 52, groundOnly: true, recall: true } },
  up: { name: "Worksite Launch", description: "Vault toward the stage, then fall helpless.", ground: vault(15, 4.0, 12.0), free: vault(0, 2.0, 9.0) },
  down: { name: "Repair", description: "Duck behind the tools; a correctly timed hit repairs a little damage.", ground: repair(false), air: repair(true) },
};
