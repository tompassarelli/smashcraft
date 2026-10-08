import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { medivhHit } from "./medivhMoves";

const omen = (ex: boolean): AuthoredSpecial => ({
  endFrame: 40, landingLag: 18,
  projectiles: [{ spawnFrame: 12, offsetX: 40.0, offsetZ: 55.0,
    velocityX: ex ? 11.0 : 8.0, velocityZ: 0.0, life: 40, radius: ex ? 40.0 : 32.0,
    effect: medivhHit(ex ? 12.0 : 8.0, 80, 55.0, 50.0), reflectable: true, limit: 1,
    model: "Abilities\\Weapons\\PriestMissile\\PriestMissile.mdl" }],
});
const vanish = (ex: boolean, retreat: boolean): AuthoredSpecial => ({
  endFrame: 38, landingLag: 20, intangible: frames(9, 10), defensiveUse: retreat,
  motion: [{ ...frames(1, 9), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(10, 10), velocityX: retreat ? (ex ? -160.0 : -120.0) : (ex ? 250.0 : 180.0), velocityZ: 0.0, throughEdge: true },
    { ...frames(11, 38), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(retreat ? 13 : 12, retreat ? 15 : 14,
    { x1: retreat ? -35.0 : 15.0, z1: 50.0, x2: retreat ? 35.0 : 100.0, z2: 50.0, radius: retreat ? (ex ? 40.0 : 28.0) : 14.0 },
    medivhHit(retreat ? (ex ? 9.0 : 5.0) : (ex ? 11.0 : 7.0), 80, 45.0, 85.0))],
});
const raven = (ex: boolean): AuthoredSpecial => ({
  endFrame: 36, aimFrames: 8, oncePerAirtime: true, helpless: true, landingLag: 24,
  motion: [{ ...frames(1, 8), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(9, 28), velocityX: 0.0, velocityZ: ex ? 20.0 : 15.0, aimedSpeed: ex ? 20.0 : 15.0 }],
  regions: [heroRegion(9, 15, { x1: -25.0, z1: 45.0, x2: 25.0, z2: 65.0, radius: 20.0 }, medivhHit(ex ? 8.0 : 5.0, 70))],
});

export const MEDIVH_SPECIALS: FighterSpecials = {
  neutral: { name: "Arcane Omen", description: "Send a slow omen ahead. Shield it or jump over it.", ground: { ...omen(false), ex: omen(true) } },
  side: { name: "Vanishing Act", description: "Blink forward and strike. Your arrival is open to a punish.", ground: { ...vanish(false, false), ex: vanish(true, false) } },
  up: { name: "Raven Flight", description: "Aim and become a raven. Fall helpless after the flight.", ground: { ...raven(false), ex: raven(true) } },
  down: { name: "Last Word", description: "Blink back and burst outward. Bait an impatient chase.", ground: { ...vanish(false, true), ex: vanish(true, true) } },
};
