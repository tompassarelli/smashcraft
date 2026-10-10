


import { withExKit } from "../exSpecialAuthoring";
import { f32 } from "wisp/src/sim/f32";
import { type AuthoredSpecial, type FighterSpecials, type SpecialPlacement, CHARGED_AIM_FRAMES, FollowUpInput, Relocation, chargedAngleMotion, frames, recovery } from "../heroSpecials";
import { hurtPose } from "../hurtboxes";
import { BLADE_RADIUS, L, M, capsule, cut, hit, length, reach } from "./blademasterMoves";
import { path } from "./authoring";



const LOW_CUT_ARM = reach(46.0, 56.0);


const AIR_LANDING_LAG = 20;


const windCutter: AuthoredSpecial = {
  endFrame: 40,
  hurt: [hurtPose(16, 24, LOW_CUT_ARM)],
  projectiles: [{
    model: "Abilities\\Weapons\\WingedSerpentMissile\\WingedSerpentMissile.mdx",
    spawnFrame: 18,
    offsetX: 40.0,
    offsetZ: 45.0,
    velocityX: length(f32(0.14)),
    velocityZ: 0.0,
    life: 24,
    radius: length(f32(0.16)),
    effect: hit(5.323170185089111, "POKE", 35),
    reflectable: true,
    limit: 1,
  }],
};






const WALK_FRAMES = 24;
const WALK_SPEED = f32(length(f32(2.2)) / WALK_FRAMES);
const STOP = { velocityX: 0.0, velocityZ: 0.0 };
const walkMotion = [{ ...frames(8, 31), velocityX: WALK_SPEED, velocityZ: 0.0, stopsAtShield: true }, { ...frames(32, 32), ...STOP }];
const WALK_BRANCHES = frames(10, 31);


const backstab: AuthoredSpecial = { name: "Backstab", endFrame: 30, hurt: [hurtPose(4, 12, LOW_CUT_ARM)], motion: [{ ...frames(1, 1), ...STOP }], regions: cut(6, [52.0, 45.0, 38.0], L, hit(10.646340370178223, "EDGE", 40)) };

const stepOut: AuthoredSpecial = { name: "Step Out", endFrame: 8, motion: [{ ...frames(1, 1), ...STOP }] };

const windWalk = (air: boolean): AuthoredSpecial => {
  const finish = (special: AuthoredSpecial): AuthoredSpecial => (air ? { ...special, helpless: true } : special);
  return finish({
    endFrame: 44,
    motion: walkMotion,
    oncePerAirtime: air ? true : undefined,
    followUps: [
      { window: WALK_BRANCHES, input: FollowUpInput.attack, facesStick: true, special: finish(backstab) },
      { window: WALK_BRANCHES, input: FollowUpInput.special, special: finish(stepOut) },
    ],
  });
};





const RISE_FRAMES = 14;
const rise = (distance: number) => chargedAngleMotion(length(distance), RISE_FRAMES);
const BLADE_TOP = f32(M - BLADE_RADIUS);


const risingBlade = recovery({
  endFrame: 24,
  aimFrames: CHARGED_AIM_FRAMES,
  motion: rise(f32(4.1)),
  regions: path(9, [
    capsule(40.0, 30.0, 70.0, 70.0),
    capsule(30.0, 40.0, 55.0, 90.0),
    capsule(20.0, 50.0, 35.0, BLADE_TOP),
    capsule(10.0, 55.0, 15.0, BLADE_TOP),
    capsule(5.0, 60.0, 5.0, BLADE_TOP),
    capsule(0.0, 60.0, 0.0, BLADE_TOP),
  ], hit(7.984755039215088, "LAUNCH", 80)),
  hurt: [hurtPose(7, 16, reach(18.0, 128.0))],
});




const IMAGE_STEP_SPEED = f32(-f32(length(f32(1.0)) / 4));
const MIRROR_IMAGE_OBJECT: SpecialPlacement = { frame: 8, offsetX: 0.0, radius: 22.0, height: f32(length(f32(1.05))), durability: 1.0, life: 150, fireAges: [] };
const mirrorImage: AuthoredSpecial = {
  endFrame: 24,
  facesStick: true,
  placement: MIRROR_IMAGE_OBJECT,
  motion: [
    { ...frames(8, 11), velocityX: IMAGE_STEP_SPEED, velocityZ: 0.0 },
    { ...frames(12, 12), ...STOP },
  ],
};






const imageSwap: AuthoredSpecial = {
  name: "Image Swap",

  endFrame: 30,
  hurt: [hurtPose(6, 14, LOW_CUT_ARM)],
  motion: [{ ...frames(6, 6), ...STOP, relocate: Relocation.placed }],
  regions: cut(8, [52.0, 45.0, 38.0], L, hit(8.871950149536133, "EDGE", 40)),
};

const inAir = (special: AuthoredSpecial): AuthoredSpecial => ({ ...special, landingLag: AIR_LANDING_LAG });

export const BLADEMASTER_SPECIALS: FighterSpecials = {
  neutral: withExKit({ name: "Wind Cutter", description: "A short blade wave.", ground: windCutter, air: inAir(windCutter) }, { damage: 1.25 }),
  side: withExKit({ name: "Wind Walk", description: "Fade and walk through bodies; attack to Backstab on either side, special to step out.", ground: windWalk(false), air: windWalk(true) }, { damage: 1.25 }),
  up: withExKit({ name: "Rising Whirlwind", description: "Hold a direction as he gathers, then a slashing dash that way and a helpless fall.", ground: risingBlade }, { travel: 1.25 }),
  down: withExKit({ name: "Mirror Image", description: "Step back and leave an image; press again to swap to it with a slash. One hit breaks it.", ground: mirrorImage, air: inAir(mirrorImage), recall: imageSwap }, { damage: 1.25, durability: 2.0 }),
};
