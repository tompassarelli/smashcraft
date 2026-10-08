import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { kaelCastBody, kaelHit } from "./kaelthasMoves";

const flameStrike: AuthoredSpecial = {
  cost: 20, endFrame: 43, landingLag: 20,
  hurt: kaelCastBody(5, 26, 38.0, 66.0),
  projectiles: [{
    model: "Abilities\\Spells\\Human\\FlameStrike\\FlameStrike1.mdx",
    modelAnimation: { sequence: "birth", warningSeconds: 0.5, activeSeconds: 1.5 },
    spawnFrame: 12, offsetX: 50.0, offsetZ: 45.0, velocityX: 9.0, velocityZ: 0.0,
    life: 34, radius: 40.0, effect: kaelHit(12.0, 80, 95.0, 24.0),
    reflectable: true, limit: 1, needsLineOfSight: true,
  }],
};
const siphon: AuthoredSpecial = {
  cost: 5, endFrame: 42, landingLag: 20,
  hurt: kaelCastBody(10, 23, 46.0, 60.0),
  regions: [heroRegion(15, 17, { x1: 28.0, z1: 60.0, x2: 133.0, z2: 60.0, radius: 12.0 }, { ...kaelHit(4.0, 55, 65.0, 18.0), manaSteal: 25 })],
};
const flight = (cost: number, speed: number): AuthoredSpecial => ({
  cost, endFrame: 36, aimFrames: 10, oncePerAirtime: true, helpless: true, landingLag: 24,
  motion: [{ ...frames(11, 30), velocityX: 0.0, velocityZ: speed, aimedSpeed: speed }],
  regions: [heroRegion(11, 20, { x1: -18.0, z1: 45.0, x2: 18.0, z2: 45.0, radius: 25.0 }, kaelHit(6.0, 70))],
});
const banish: AuthoredSpecial = {
  cost: 15, endFrame: 38, landingLag: 20, intangible: frames(5, 12), defensiveUse: true,
  regions: [heroRegion(13, 15, { x1: -40.0, z1: 50.0, x2: 40.0, z2: 50.0, radius: 25.0 }, kaelHit(5.0, 55))],
};

export const KAELTHAS_SPECIALS: FighterSpecials = {
  neutral: { name: "Flame Strike", description: "Send a wall of flame along the ground that launches the first enemy it reaches. Shield it or jump over it.", ground: flameStrike },
  side: { name: "Siphon Mana", description: "Reach ahead to take mana from an enemy. Shields stop it.", ground: siphon },
  up: { name: "Phoenix Flight", description: "Aim, then ride a burst of fire. You fall helpless after the flight.", ground: flight(15, 14.0), free: flight(0, 9.0) },
  down: { name: "Banish", description: "Briefly turn ethereal, then push nearby enemies away.", ground: banish },
};
