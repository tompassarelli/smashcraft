import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, type FighterMoves, type StrikeCapsule } from "../heroMoves";
import { UTHER_GROUND, groundPoses } from "./groundNormals";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../hurtboxes";

// Timings and damage: smashcraft:docs/design/roster.md. Original hammer paths
// are provisional until checked against the matching animation poses.
const SHORT = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
export const MEDIUM = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const LONG = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = SHORT;

// Provisional coefficients for the existing formula, not calibrated distance
// bands or guarantees about follow-ups.
const CLASS_HYPOTHESES = {
  LINK: { growth: 65.0, base: 12.0 },
  POKE: { growth: 80.0, base: 16.0 },
  LAUNCH: { growth: 95.0, base: 22.0 },
  EDGE: { growth: 100.0, base: 25.0 },
  KILL: { growth: 110.0, base: 30.0 },
  SPIKE: { growth: 100.0, base: 24.0 },
  // Throw roles (#107): an up throw's guaranteed short juggle and a down throw's tech chase.
  JUGGLE: { growth: 55.0, base: 50.0 },
  CHASE: { growth: 40.0, base: 75.0 },
} as const;
type LaunchClass = keyof typeof CLASS_HYPOTHESES;

const DIRECTIONS = {
  25: { x: f32(0.9063077870366499), z: f32(0.42261826174069944) },
  35: { x: f32(0.8191520442889918), z: f32(0.573576436351046) },
  40: { x: f32(0.766044443118978), z: f32(0.6427876096865393) },
  45: { x: f32(0.7071067811865476), z: f32(0.7071067811865476) },
  50: { x: f32(0.6427876096865394), z: f32(0.766044443118978) },
  55: { x: f32(0.5735764363510462), z: f32(0.8191520442889918) },
  70: { x: f32(0.3420201433256688), z: f32(0.9396926207859083) },
  80: { x: f32(0.17364817766693041), z: f32(0.984807753012208) },
  85: { x: f32(0.08715574274765814), z: f32(0.9961946980917455) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

/** Uther's provisional launch for a roster row: damage, tuning class and facing-relative angle. */
export function hit(damage: number, launchClass: LaunchClass, angle: keyof typeof DIRECTIONS, backwards = false, element: HitElement = HitElement.normal): Readonly<HitEffect> {
  const direction = DIRECTIONS[angle];
  const strength = CLASS_HYPOTHESES[launchClass];
  return { damage, growth: strength.growth, base: strength.base, launchX: backwards ? -direction.x : direction.x, launchZ: direction.z, electric: false, element };
}

export const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const head = (x: number, z: number, radius: number): StrikeCapsule => capsule(x, z, x, z, radius);
const frame = (active: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>) => heroRegion(active, active, strike, effect, groundedEffect);

const JAB = hit(4.0, "POKE", 35);
const FORWARD_TILT = hit(11.0, "EDGE", 35);
const UP_TILT = hit(9.0, "LAUNCH", 85);
const DOWN_TILT = hit(7.0, "LINK", 70);
const DASH = hit(12.0, "LAUNCH", 45);
const FORWARD_SMASH_HEAD = hit(20.0, "KILL", 40);
const FORWARD_SMASH_HANDLE = hit(15.0, "KILL", 40);
const UP_SMASH = hit(17.0, "KILL", 90);
const DOWN_SMASH_FRONT = hit(15.0, "EDGE", 25);
const DOWN_SMASH_BACK = hit(15.0, "EDGE", 25, true);
const NEUTRAL_AIR_FRONT = hit(9.0, "POKE", 50);
const NEUTRAL_AIR_BACK = hit(9.0, "POKE", 50, true);
const FORWARD_AIR = hit(14.0, "KILL", 40);
const BACK_AIR = hit(11.0, "EDGE", 35, true);
const UP_AIR = hit(9.0, "LAUNCH", 85);
const DOWN_AIR = hit(13.0, "SPIKE", 270);
const DOWN_AIR_GROUNDED = hit(13.0, "LAUNCH", 55);
const GRAB_CONTACT = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

// Uther's body (smashcraft:docs/hurtboxes.md, gameplay-design.md "Legible
// hurtboxes"). The hammer stays outside it, so a swing's reach past the
// gauntlet is its disjoint; the swinging arm reaches toward each strike from
// late startup into early recovery, at the hand heights of the Paladin's
// "Attack - 1", "Attack - 2" and "Spell" sequences (utherClips.ts). The jab's
// gauntlet, back air's boot and the grabbing hand are the strikes themselves.
const body = hurtCapsule(Character.uther);
const UTHER_TORSO = hurtPart(body.x1, body.z1, body.x2, body.z2, body.radius);
const ARM_RADIUS = 10.0;
/** The torso and the swinging arm from the shoulder to the hand. */
export const utherReach = (handX: number, handZ: number): readonly HurtPart[] => [UTHER_TORSO, hurtPart(6.0, 88.0, handX, handZ, ARM_RADIUS)];
const JAB_ARM = hurtPart(10.0, 66.0, f32(SHORT - 10.0), 60.0, 10.0);
const GRAB_ARM = hurtPart(10.0, 56.0, f32(GRAB - 12.0), 40.0, 12.0);
// Rearward Boot reaches 0.8H behind through a half-extended leg on each side,
// keeping every body change within 60 units.
const BOOT_TIP = -f32(MEDIUM - 11.0);
const BOOT = hurtPart(-8.0, 42.0, BOOT_TIP, 30.0, 11.0);
const HALF_BOOT = hurtPart(-8.0, 42.0, f32(BOOT_TIP * f32(0.6)), 36.0, 11.0);

const UTHER_HURTBOXES: FighterHurtboxes = {
  stand: [UTHER_TORSO],
  attacks: {
    [AttackStyle.jab]: [heroHurtPose(3, 9, [UTHER_TORSO, JAB_ARM])],
    [AttackStyle.grab]: [heroHurtPose(6, 14, [UTHER_TORSO, GRAB_ARM])],
    ...groundPoses(UTHER_GROUND, utherReach),
    [AttackStyle.forwardSmash]: [heroHurtPose(18, 26, utherReach(48.0, 60.0))],
    [AttackStyle.upSmash]: [heroHurtPose(15, 24, utherReach(8.0, 140.0))],
    [AttackStyle.downSmash]: [heroHurtPose(14, 19, utherReach(44.0, 26.0)), heroHurtPose(20, 25, utherReach(-44.0, 26.0))],
    [AttackStyle.neutralAir]: [heroHurtPose(6, 10, utherReach(44.0, 60.0)), heroHurtPose(11, 15, utherReach(-44.0, 60.0))],
    [AttackStyle.forwardAir]: [heroHurtPose(10, 18, utherReach(46.0, 62.0))],
    [AttackStyle.backAir]: [heroHurtPose(6, 8, [UTHER_TORSO, HALF_BOOT]), heroHurtPose(9, 13, [UTHER_TORSO, BOOT]), heroHurtPose(14, 16, [UTHER_TORSO, HALF_BOOT])],
    [AttackStyle.upAir]: [heroHurtPose(6, 13, utherReach(6.0, 136.0))],
    [AttackStyle.downAir]: [heroHurtPose(12, 20, utherReach(4.0, 20.0))],
  },
};

export const UTHER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: UTHER_HURTBOXES,
  normals: {
    ...UTHER_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(21, 3, 36, 0, [
      frame(21, head(100.0, 105.0, 18.0), FORWARD_SMASH_HEAD),
      frame(22, head(f32(LONG - 18.0), 54.0, 18.0), FORWARD_SMASH_HEAD),
      frame(23, head(114.0, 4.0, 18.0), FORWARD_SMASH_HEAD),
      frame(21, capsule(18.0, 56.0, 86.0, 96.0, 8.0), FORWARD_SMASH_HANDLE),
      frame(22, capsule(18.0, 54.0, 110.0, 54.0, 8.0), FORWARD_SMASH_HANDLE),
      frame(23, capsule(18.0, 48.0, 102.0, 16.0, 8.0), FORWARD_SMASH_HANDLE),
    ]),
    [AttackStyle.upSmash]: heroMove(18, 4, 33, 0, [
      frame(18, capsule(12.0, 68.0, 38.0, 112.0, 14.0), UP_SMASH),
      frame(19, capsule(8.0, 78.0, 18.0, f32(LONG - 14.0), 14.0), UP_SMASH),
      frame(20, capsule(4.0, 78.0, -12.0, f32(LONG - 14.0), 14.0), UP_SMASH),
      frame(21, capsule(-4.0, 68.0, -32.0, 112.0, 14.0), UP_SMASH),
    ]),
    [AttackStyle.downSmash]: heroMove(17, 6, 34, 0, [
      frame(17, capsule(18.0, 18.0, 78.0, 32.0, 12.0), DOWN_SMASH_FRONT),
      frame(18, capsule(18.0, 12.0, f32(MEDIUM - 12.0), 10.0, 12.0), DOWN_SMASH_FRONT),
      frame(19, capsule(18.0, 10.0, 78.0, -4.0, 12.0), DOWN_SMASH_FRONT),
      frame(20, capsule(-18.0, 18.0, -78.0, 32.0, 12.0), DOWN_SMASH_BACK),
      frame(21, capsule(-18.0, 12.0, -f32(MEDIUM - 12.0), 10.0, 12.0), DOWN_SMASH_BACK),
      frame(22, capsule(-18.0, 10.0, -78.0, -4.0, 12.0), DOWN_SMASH_BACK),
    ]),
    [AttackStyle.neutralAir]: heroMove(8, 5, 23, 15, [
      frame(8, capsule(18.0, 56.0, 76.0, 70.0, 12.0), NEUTRAL_AIR_FRONT),
      frame(9, capsule(18.0, 40.0, f32(MEDIUM - 12.0), 30.0, 12.0), NEUTRAL_AIR_FRONT),
      frame(10, capsule(0.0, 20.0, 0.0, -45.0, 12.0), NEUTRAL_AIR_FRONT),
      frame(11, capsule(-18.0, 40.0, -f32(MEDIUM - 12.0), 30.0, 12.0), NEUTRAL_AIR_BACK),
      frame(12, capsule(-18.0, 56.0, -76.0, 70.0, 12.0), NEUTRAL_AIR_BACK),
    ]),
    [AttackStyle.forwardAir]: heroMove(13, 4, 28, 18, [
      frame(13, capsule(18.0, 62.0, 108.0, 90.0, 14.0), FORWARD_AIR),
      frame(14, capsule(18.0, 54.0, f32(LONG - 14.0), 58.0, 14.0), FORWARD_AIR),
      frame(15, capsule(18.0, 48.0, 118.0, 26.0, 14.0), FORWARD_AIR),
      frame(16, capsule(18.0, 42.0, 95.0, 0.0, 14.0), FORWARD_AIR),
    ]),
    [AttackStyle.backAir]: heroMove(9, 3, 24, 14, [
      frame(9, capsule(-30.0, 38.0, -f32(MEDIUM - 10.0), 32.0, 10.0), BACK_AIR),
      frame(10, capsule(-30.0, 36.0, -f32(MEDIUM - 10.0), 30.0, 10.0), BACK_AIR),
      frame(11, capsule(-30.0, 34.0, -f32(MEDIUM - 16.0), 26.0, 10.0), BACK_AIR),
    ]),
    [AttackStyle.upAir]: heroMove(8, 4, 23, 14, [
      frame(8, head(30.0, 82.0, 14.0), UP_AIR),
      frame(9, head(12.0, f32(MEDIUM - 14.0), 14.0), UP_AIR),
      frame(10, head(-12.0, f32(MEDIUM - 14.0), 14.0), UP_AIR),
      frame(11, head(-30.0, 82.0, 14.0), UP_AIR),
    ]),
    [AttackStyle.downAir]: heroMove(15, 4, 31, 22, [
      frame(15, capsule(14.0, 10.0, 20.0, -75.0, 12.0), DOWN_AIR, DOWN_AIR_GROUNDED),
      frame(16, capsule(8.0, 10.0, 8.0, -f32(MEDIUM - 12.0), 12.0), DOWN_AIR, DOWN_AIR_GROUNDED),
      frame(17, capsule(0.0, 10.0, -8.0, -f32(MEDIUM - 12.0), 12.0), DOWN_AIR, DOWN_AIR_GROUNDED),
      frame(18, capsule(-4.0, 10.0, -20.0, -75.0, 12.0), DOWN_AIR, DOWN_AIR_GROUNDED),
    ]),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [
      heroRegion(8, 9, capsule(14.0, 44.0, f32(GRAB - 12.0), 36.0, 12.0), GRAB_CONTACT),
    ]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 37, effect: hit(8.0, "EDGE", 40) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 44, effect: hit(9.0, "EDGE", 40, true) },
    [GrabAction.throwUp]: { contactFrame: 16, totalFrames: 25, effect: hit(7.0, "JUGGLE", 90) },
    [GrabAction.throwDown]: { contactFrame: 20, totalFrames: 46, effect: hit(6.0, "CHASE", 70) },
  },
};
