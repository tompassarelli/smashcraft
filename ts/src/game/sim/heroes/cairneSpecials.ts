import { f32 } from "wisp/src/sim/f32";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { cairneCapsule as c, cairneHit as hit } from "./cairneMoves";

const shockwave = (air: boolean): AuthoredSpecial => ({
  cost: 15, endFrame: 58, landingLag: air ? 24 : undefined,
  projectiles: [{ spawnFrame: 24, offsetX: 72.0, offsetZ: 36.0, velocityX: 13.0, velocityZ: 0.0,
    life: 38, radius: 20.0, effect: hit(10.0, "edge", 35), reflectable: true, limit: 1,
    model: "Abilities\\Spells\\Other\\CrushingWave\\CrushingWaveMissile.mdx" }],
});
const stomp = (air: boolean): AuthoredSpecial => ({
  cost: 20, endFrame: 57, landingLag: air ? 26 : undefined,
  motion: [{ ...frames(12, 17), velocityX: 11.0, velocityZ: 0.0, stopsAtBody: true }, { ...frames(18, 18), velocityX: 0.0, velocityZ: 0.0 }],
  regions: [heroRegion(20, 23, c(0.0, 16.0, 118.0, 16.0, 22.0), hit(13.0, "launch", 80)),
    heroRegion(20, 23, c(0.0, 16.0, -118.0, 16.0, 22.0), hit(13.0, "launch", 80, -1))],
});
const lift = (free: boolean): AuthoredSpecial => ({
  cost: free ? 0 : 15, endFrame: 32, oncePerAirtime: true, helpless: true, facesStick: true,
  motion: [{ ...frames(1, 10), velocityX: 0.0, velocityZ: 0.0 },
    { ...frames(11, 26), velocityX: free ? 6.0 : 10.0, velocityZ: free ? 15.0 : 20.0 },
    { ...frames(27, 32), velocityX: free ? 2.0 : 3.0, velocityZ: free ? 4.0 : 6.0 }],
  regions: free ? undefined : [heroRegion(11, 16, c(0.0, 95.0, 0.0, 200.0, 20.0), hit(9.0, "launch", 80))],
});
export const CAIRNE_SPECIALS: FighterSpecials = {
  neutral: { name: "Shockwave", description: "Plant the totem and send one low wave along the ground.", ground: shockwave(false), air: shockwave(true) },
  side: { name: "War Stomp", description: "Step forward and stomp both sides, lifting nearby foes for a follow-up.", ground: stomp(false), air: stomp(true) },
  up: { name: "Spirit Lift", description: "Rise behind the totem, then fall helplessly with exposed sides.", ground: lift(false), free: lift(true) },
  down: { name: "Reincarnation", description: "Read an incoming strike to heal 12 damage, up to 24 per stock. A wait or grab beats it.",
    ground: { cost: 25, endFrame: 46, groundOnly: true, intangible: frames(6, 9), guard: { ...frames(6, 9), heal: 12.0, healCapPerStock: 24.0 } } },
};
