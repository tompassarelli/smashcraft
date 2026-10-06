// Blademaster's four specials (smashcraft:docs/design/roster.md, "Blademaster",
// "B specials"), as data for sim/heroSpecials.ts. Brief frame numbering: the
// entry tick is frame 1 and windows are inclusive.
import { f32 } from "wisp/src/sim/f32";
import { type AuthoredSpecial, type FighterSpecials, type SpecialPlacement, FollowUpInput, ROSTER_MANA, Relocation, frames } from "../heroSpecials";
import { hurtPose } from "../hurtboxes";
import { BLADE_RADIUS, L, M, capsule, cut, hit, length, path, reach } from "./blademasterMoves";

// The sword arm reaches toward each strike, from just before it into early
// recovery, as the normals' bodies do; the blade past the hand stays disjoint.
const LOW_CUT_ARM = reach(46.0, 56.0);

// Non-mobility specials used in the air end on landing with the roster's default lag.
const AIR_LANDING_LAG = 20;

/** Wind Cutter: one short reflectable blade wave; free. Spawn f18, end f40. */
const windCutter: AuthoredSpecial = {
  cost: 0,
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
    effect: hit(6.0, "POKE", 35),
    reflectable: true,
    limit: 1,
  }],
};

// Wind Walk (smashcraft:docs/design/kit-review-1.md, #124): a 7-frame fade,
// then a 2.2H walk over f8-31 that passes bodies and stops at a raised shield.
// From f10 an attack press slashes (Backstab; the stick held at the press
// picks the side, so walking through and slashing back is the cross-up), a
// special press steps out of it, and nothing recovers to f44.
const WALK_FRAMES = 24;
const WALK_SPEED = f32(length(f32(2.2)) / WALK_FRAMES);
const STOP = { velocityX: 0.0, velocityZ: 0.0 };
const walkMotion = [{ ...frames(8, 31), velocityX: WALK_SPEED, velocityZ: 0.0, stopsAtShield: true }, { ...frames(32, 32), ...STOP }];
const WALK_BRANCHES = frames(10, 31);

/** Backstab: active f6-8 from its press, 12% EDGE at 40 degrees, ends f28. */
const backstab: AuthoredSpecial = { cost: 0, endFrame: 28, hurt: [hurtPose(4, 12, LOW_CUT_ARM)], motion: [{ ...frames(1, 1), ...STOP }], regions: cut(6, [52.0, 45.0, 38.0], L, hit(12.0, "EDGE", 40)) };
/** Step out: the walk stops and the action ends 8 frames later. */
const stepOut: AuthoredSpecial = { cost: 0, endFrame: 8, motion: [{ ...frames(1, 1), ...STOP }] };

const windWalk = (air: boolean): AuthoredSpecial => {
  const finish = (special: AuthoredSpecial): AuthoredSpecial => (air ? { ...special, helpless: true } : special);
  return finish({
    cost: 18,
    endFrame: 44,
    motion: walkMotion,
    oncePerAirtime: air ? true : undefined,
    followUps: [
      { window: WALK_BRANCHES, input: FollowUpInput.attack, facesStick: true, special: finish(backstab) },
      { window: WALK_BRANCHES, input: FollowUpInput.special, special: finish(stepOut) },
    ],
  });
};

// Rising Blade climbs evenly over f7-24 and stops at the top on f25, so the
// row's travel is its peak; the helpless fall starts from rest. Its lateral
// travel follows the held stick, so it can drift back toward the stage.
const RISE_FRAMES = 18;
const rise = (ascent: number, drift: number) => [
  { ...frames(7, 24), velocityX: 0.0, velocityZ: f32(length(ascent) / RISE_FRAMES), driftSpeed: f32(length(drift) / RISE_FRAMES) },
  { ...frames(25, 25), velocityX: 0.0, velocityZ: 0.0 },
];
const BLADE_TOP = f32(M - BLADE_RADIUS);

/** Rising Blade: 2.0H up and 0.5H forward, one 9-damage hit f7-12, then helpless; 15 mana; no intangibility. */
const risingBlade: AuthoredSpecial = {
  cost: 15,
  endFrame: 25,
  motion: rise(f32(2.0), f32(0.5)),
  regions: path(7, [
    capsule(40.0, 30.0, 70.0, 70.0),
    capsule(30.0, 40.0, 55.0, 90.0),
    capsule(20.0, 50.0, 35.0, BLADE_TOP),
    capsule(10.0, 55.0, 15.0, BLADE_TOP),
    capsule(5.0, 60.0, 5.0, BLADE_TOP),
    capsule(0.0, 60.0, 0.0, BLADE_TOP),
  ], hit(9.0, "LAUNCH", 80)),
  hurt: [hurtPose(5, 14, reach(18.0, 128.0))],
  oncePerAirtime: true,
  helpless: true,
};

/** The zero-mana recovery: 1.4H of the same path and no attack. */
const risingBladeFree: AuthoredSpecial = {
  cost: 0,
  endFrame: 25,
  motion: rise(f32(1.4), f32(0.35)),
  oncePerAirtime: true,
  helpless: true,
};

// Mirror Image (#124): a tell, then on f8 an image stays where he stood (one
// hit shatters it; 150 frames) while he steps 1.0H back over f8-11; ends f24.
// Down with a side turns him to that side first, so he steps away from it.
const IMAGE_STEP_SPEED = f32(-f32(length(f32(1.0)) / 4));
const MIRROR_IMAGE_OBJECT: SpecialPlacement = { frame: 8, offsetX: 0.0, radius: 22.0, height: f32(length(f32(1.05))), durability: 1.0, life: 150, fireAges: [] };
const mirrorImage: AuthoredSpecial = {
  cost: 15,
  endFrame: 24,
  facesStick: true,
  placement: MIRROR_IMAGE_OBJECT,
  motion: [
    { ...frames(8, 11), velocityX: IMAGE_STEP_SPEED, velocityZ: 0.0 },
    { ...frames(12, 12), ...STOP },
  ],
};

/**
 * Swap: down special while the image stands. The image flashes over f1-5, he
 * takes its place on f6 facing its way, and slashes f8-10 (10% EDGE at 40
 * degrees); ends f30. Free; the image is spent.
 */
const imageSwap: AuthoredSpecial = {
  cost: 0,
  endFrame: 30,
  hurt: [hurtPose(6, 14, LOW_CUT_ARM)],
  motion: [{ ...frames(6, 6), ...STOP, relocate: Relocation.placed }],
  regions: cut(8, [52.0, 45.0, 38.0], L, hit(10.0, "EDGE", 40)),
};

const inAir = (special: AuthoredSpecial): AuthoredSpecial => ({ ...special, landingLag: AIR_LANDING_LAG });

export const BLADEMASTER_SPECIALS: FighterSpecials = {
  mana: ROSTER_MANA,
  neutral: { ground: windCutter, air: inAir(windCutter) },
  side: { ground: windWalk(false), air: windWalk(true) },
  up: { ground: risingBlade, free: risingBladeFree },
  down: { ground: mirrorImage, air: inAir(mirrorImage), recall: imageSwap },
};

