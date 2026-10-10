import { f32 } from "wisp/src/sim/f32";
import { withExKit } from "../exSpecialAuthoring";
import { HitElement } from "../codes";
import { heroRegion } from "../heroMoves";
import { frames, type AuthoredSpecial, type FighterSpecials, type SpecialProjectile } from "../heroSpecials";
import { claw, tinkerHit } from "./tinkerMoves";

const rocket = (spawnFrame: number): SpecialProjectile => ({
  model: "Abilities\\Weapons\\RocketMissile\\RocketMissile.mdl",
  spawnFrame, offsetX: 35.0, offsetZ: 45.0, velocityX: 10.0, velocityZ: 2.0,
  gravity: f32(0.12), life: 44, radius: 15.0, effect: tinkerHit(3.581239938735962, "poke", 55, 1.0, HitElement.fire),
  reflectable: true, limit: 3,
});
const rockets = (air: boolean): AuthoredSpecial => ({ endFrame: 43, projectiles: [rocket(14), rocket(20), rocket(26)], landingLag: air ? 20 : undefined });
const boots = (rise: number, drift: number): AuthoredSpecial => ({
  endFrame: 32, motion: [{ ...frames(1, 6), velocityX: 0.0, velocityZ: 0.0 }, { ...frames(7, 29), velocityX: 0.0, velocityZ: rise, driftSpeed: drift }],
  oncePerAirtime: true, helpless: true, facesStick: true,
  regions: [heroRegion(7, 10, claw(0.0, 10.0, 0.0, 90.0, 26.0), tinkerHit(4.4765496253967285, "juggle", 85, 1.0, HitElement.fire))],
});
const robo = (air: boolean): AuthoredSpecial => ({
  endFrame: 46, armor: { ...frames(8, 23), maxDamage: 10.0, shell: true },
  motion: [{ ...frames(12, 23), velocityX: 4.0, velocityZ: 0.0, stopsAtBody: true }],
  regions: [heroRegion(14, 18, claw(18.0, 45.0, 113.0, 40.0, 16.0), tinkerHit(11.639029502868652, "kill", 35))],
  landingLag: air ? 20 : undefined,
});

export const TINKER_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Cluster Rockets", description: "Three rockets cover the approach and charge the next claw hit.", ground: rockets(false), air: rockets(true) }, { damage: 1.25 }),
  side: withExKit({
    name: "Pocket Factory", description: "Build a breakable factory that sends out Clockwerk Goblins; press again to recall it.",
    ground: { endFrame: 48, groundOnly: true, placement: {
      frame: 24, offsetX: 88.0, radius: 24.0, height: 65.0, durability: 24.0, life: 240,
      fireAges: [35, 80, 125, 170, 215], shot: {
        model: "Units\\Creeps\\HeroTinkerRobot\\HeroTinkerRobot.mdl",
        spawnFrame: 0, offsetX: 20.0, offsetZ: 16.0, velocityX: 7.0, velocityZ: 0.0,
        life: 44, radius: 18.0, effect: tinkerHit(5.371860027313232, "poke", 35, 1.0, HitElement.fire), reflectable: true, limit: 3,
      },
    } },
    recall: { endFrame: 36, groundOnly: true, recall: true },
  }, { damage: 1.25, durability: 1.25, recallProtection: 4 }),
  up: withExKit({ name: "Rocket Boots", description: "Blast off, burn upward and steer left or right, then fall helplessly.", ground: boots(18.0, 7.0) }, { travel: 1.25 }),
  down: withExKit({ name: "Robo-Goblin", description: "Transform for an armored hammer-tank charge; grabs and heavy hits beat the armor.", ground: robo(false), air: robo(true) }, { damage: 1.25 }),
};
