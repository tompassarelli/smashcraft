import { heroRegion, heroHurtPose } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { CHARGED_AIM_FRAMES, chargedAngleMotion, frames, type AuthoredSpecial, type FighterSpecials } from "../heroSpecials";
import { anubarakHit } from "./anubarakMoves";

const impale = (air: boolean, ex: boolean): AuthoredSpecial => ({
  endFrame: 48, landingLag: air ? 24 : undefined,
  projectiles: [{ model: "Abilities\\Spells\\Undead\\Impale\\ImpaleMissTarget.mdl",
    spawnFrame: 18, offsetX: 40.0, offsetZ: 32.0, velocityX: 10.0, velocityZ: 0.0,
    life: 36, radius: ex ? 28.0 : 18.0, effect: anubarakHit(ex ? 16.103879928588867 : 11.148839950561523, 80, ex ? 82.73651885986328 : 68.3475570678711, 40.0), reflectable: true, limit: 1,
  }],
  ...(ex ? {} : { ex: impale(air, true) }),
});
const burrow = (ex: boolean): AuthoredSpecial => ({
  endFrame: 56, groundOnly: true, facesStick: true,
  motion: [{ ...frames(10, ex ? 29 : 25), velocityX: ex ? 13.0 : 10.0, velocityZ: 0.0, stopsAtShield: true }],
  hurt: [heroHurtPose(10, ex ? 29 : 25, [hurtPart(-20.0, 2.0, 20.0, 8.0, 14.0)])],
  regions: [heroRegion(ex ? 30 : 26, ex ? 33 : 29, { x1: -28.0, z1: 20.0, x2: 44.0, z2: 110.0, radius: ex ? 32.0 : 24.0 }, anubarakHit(ex ? 19.820161819458008 : 14.865119934082031, 80, 82.73651885986328, 38.0))],
  ...(ex ? {} : { ex: burrow(true) }),
});
const eruption = (ex: boolean): AuthoredSpecial => ({
  endFrame: 46, oncePerAirtime: true, helpless: true, aimFrames: CHARGED_AIM_FRAMES,
  motion: chargedAngleMotion(ex ? 640.0 : 400.0, 28),
  regions: [heroRegion(9, 16, { x1: 0.0, z1: 70.0, x2: 0.0, z2: 150.0, radius: ex ? 31.0 : 21.0 }, anubarakHit(ex ? 14.865119934082031 : 9.910080909729004, 80, 76.44135284423828, 28.0))],
  ...(ex ? {} : { ex: eruption(true) }),
});
const beetles = (ex: boolean): AuthoredSpecial => ({
  endFrame: 46, groundOnly: true,
  placement: { frame: 22, offsetX: 55.0, radius: 24.0, height: 35.0, durability: ex ? 36.0 : 24.0, life: 180,
    fireAges: ex ? [1, 37, 73, 109] : [1, 49, 97],
    shot: { model: "Units\\Undead\\Scarab\\Scarab.mdl", spawnFrame: 0, offsetX: 24.0, offsetZ: 32.0,
      velocityX: 7.0, velocityZ: 0.0, life: 55, radius: 16.0, effect: anubarakHit(ex ? 8.671319961547852 : 6.19379997253418, 35, 58.45515060424805, 20.0), reflectable: true, limit: 4 },
  },
  ...(ex ? {} : { ex: beetles(true) }),
});
export const ANUBARAK_SPECIALS: FighterSpecials = {
  neutral: { name: "Impale", description: "Drive a line of spines along the floor. Jump the line or block the stamp.", ground: impale(false, false), air: impale(true, false) },
  side: { name: "Burrow Hunt", description: "Scuttle beneath the floor and erupt. Follow the mound and punish the emergence.", ground: burrow(false) },
  up: { name: "Crypt Eruption", description: "Choose a direction and launch the crown, then fall helpless.", ground: eruption(false) },
  down: { name: "Carrion Beetle", description: "Plant a fragile nest that sends beetles along the ground. Press again to recall it.", ground: beetles(false), recall: { endFrame: 24, groundOnly: true, recall: true, ex: { endFrame: 24, groundOnly: true, recall: true, intangible: { first: 1, last: 4 } } } },
};
