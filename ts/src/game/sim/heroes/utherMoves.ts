import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroMove, heroRegion, type FighterMoves, type StrikeCapsule } from "../heroMoves";
import { type HitEffect } from "../hitRegions";

// Timings and damage: smashcraft:docs/design/roster.md. Original hammer paths
// are provisional until checked against the matching animation poses.
const SHORT = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const MEDIUM = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
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
  85: { x: f32(0.08715574274765814), z: f32(0.9961946980917455) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

function hit(damage: number, launchClass: LaunchClass, angle: keyof typeof DIRECTIONS, backwards = false): Readonly<HitEffect> {
  const direction = DIRECTIONS[angle];
  const strength = CLASS_HYPOTHESES[launchClass];
  return { damage, growth: strength.growth, base: strength.base, launchX: backwards ? -direction.x : direction.x, launchZ: direction.z, electric: false };
}

const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
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

export const UTHER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  normals: {
    // Until limb hurt poses exist, unarmed contacts stay on the exposed body.
    [AttackStyle.jab]: heroMove(5, 2, 15, 0, [
      frame(5, capsule(10.0, 40.0, 14.0, 46.0, 10.0), JAB),
      frame(6, capsule(10.0, 40.0, 12.0, 43.0, 10.0), JAB),
    ]),
    [AttackStyle.forwardTilt]: heroMove(10, 3, 23, 0, [
      frame(10, capsule(22.0, 64.0, 115.0, 86.0, 12.0), FORWARD_TILT),
      frame(11, capsule(22.0, 52.0, f32(LONG - 12.0), 52.0, 12.0), FORWARD_TILT),
      frame(12, capsule(22.0, 42.0, 115.0, 18.0, 12.0), FORWARD_TILT),
    ]),
    [AttackStyle.forwardTiltUp]: heroMove(10, 3, 23, 0, [
      frame(10, capsule(22.0, 64.0, 80.0, 118.0, 12.0), FORWARD_TILT),
      frame(11, capsule(22.0, 60.0, f32(LONG - 12.0), 96.0, 12.0), FORWARD_TILT),
      frame(12, capsule(22.0, 52.0, 115.0, 68.0, 12.0), FORWARD_TILT),
    ]),
    [AttackStyle.forwardTiltDown]: heroMove(10, 3, 23, 0, [
      frame(10, capsule(22.0, 48.0, 115.0, 42.0, 12.0), FORWARD_TILT),
      frame(11, capsule(22.0, 40.0, f32(LONG - 12.0), 8.0, 12.0), FORWARD_TILT),
      frame(12, capsule(22.0, 30.0, 115.0, -16.0, 12.0), FORWARD_TILT),
    ]),
    [AttackStyle.upTilt]: heroMove(9, 4, 22, 0, [
      frame(9, capsule(20.0, 54.0, 70.0, 78.0, 12.0), UP_TILT),
      frame(10, capsule(14.0, 64.0, 40.0, f32(MEDIUM - 12.0), 12.0), UP_TILT),
      frame(11, capsule(8.0, 70.0, 0.0, f32(MEDIUM - 12.0), 12.0), UP_TILT),
      frame(12, capsule(4.0, 66.0, -28.0, 88.0, 12.0), UP_TILT),
    ]),
    [AttackStyle.downTilt]: heroMove(8, 3, 20, 0, [
      frame(8, capsule(14.0, 14.0, 78.0, 24.0, 9.0), DOWN_TILT),
      frame(9, capsule(14.0, 12.0, f32(MEDIUM - 9.0), 10.0, 9.0), DOWN_TILT),
      frame(10, capsule(14.0, 10.0, 78.0, -2.0, 9.0), DOWN_TILT),
    ]),
    [AttackStyle.dashAttack]: heroMove(12, 5, 29, 0, [
      heroRegion(12, 16, capsule(0.0, 18.0, 0.0, 66.0, 24.0), DASH),
    ], f32(MEDIUM - 24.0)),
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
      frame(9, capsule(-8.0, 16.0, -14.0, 24.0, 10.0), BACK_AIR),
      frame(10, capsule(-8.0, 18.0, -14.0, 18.0, 10.0), BACK_AIR),
      frame(11, capsule(-8.0, 16.0, -10.0, 10.0, 10.0), BACK_AIR),
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
      heroRegion(8, 9, capsule(14.0, 14.0, f32(GRAB - 14.0), 24.0, 14.0), GRAB_CONTACT),
    ]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 1.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 37, effect: hit(8.0, "EDGE", 40) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 44, effect: hit(9.0, "EDGE", 40, true) },
    [GrabAction.throwUp]: { contactFrame: 16, totalFrames: 38, effect: hit(7.0, "LAUNCH", 90) },
    [GrabAction.throwDown]: { contactFrame: 20, totalFrames: 46, effect: hit(6.0, "LINK", 70) },
  },
};
