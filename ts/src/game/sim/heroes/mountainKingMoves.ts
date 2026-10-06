import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroMove, heroRegion, type FighterMoves, type StrikeCapsule } from "../heroMoves";
import { HitElement, type HitEffect } from "../hitRegions";

// smashcraft:docs/design/roster.md adopts these timings and damages. Geometry
// is original and provisional until the matching weapon/body poses are seen.
const SHORT = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const MEDIUM = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const LONG = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = f32(HERO_REFERENCE_HEIGHT * 0.5);

// Named class hypotheses in the existing growth/base formula, not calibrated
// displacement bands or promises of guaranteed follow-ups.
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
  75: { x: f32(0.25881904510252074), z: f32(0.9659258262890683) },
  85: { x: f32(0.08715574274765814), z: f32(0.9961946980917455) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

function hit(damage: number, launchClass: LaunchClass, angle: keyof typeof DIRECTIONS, backwards = false, element: HitElement = HitElement.normal): Readonly<HitEffect> {
  const direction = DIRECTIONS[angle];
  const strength = CLASS_HYPOTHESES[launchClass];
  return { damage, growth: strength.growth, base: strength.base, launchX: backwards ? -direction.x : direction.x, launchZ: direction.z, electric: false, element };
}

const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const circle = (x: number, z: number, radius: number): StrikeCapsule => capsule(x, z, x, z, radius);
const frame = (active: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>) => heroRegion(active, active, strike, effect, groundedEffect);

const JAB = hit(4.0, "POKE", 35);
const FORWARD_TILT = hit(10.0, "EDGE", 35, false, HitElement.slash);
const UP_TILT = hit(9.0, "LAUNCH", 90);
const DOWN_TILT = hit(7.0, "LINK", 70);
const DASH = hit(12.0, "LAUNCH", 40);
const FORWARD_SMASH_HEAD = hit(21.0, "KILL", 40);
const FORWARD_SMASH_HANDLE = hit(16.0, "KILL", 40);
const UP_SMASH = hit(17.0, "KILL", 85);
const DOWN_SMASH_FRONT = hit(16.0, "EDGE", 25);
const DOWN_SMASH_BACK = hit(16.0, "EDGE", 25, true);
const NEUTRAL_AIR_FRONT = hit(10.0, "POKE", 50);
const NEUTRAL_AIR_BACK = hit(10.0, "POKE", 50, true);
const FORWARD_AIR_HEAD = hit(16.0, "SPIKE", 270);
const FORWARD_AIR_GROUNDED_HEAD = hit(16.0, "LAUNCH", 55);
const FORWARD_AIR_HANDLE = hit(11.0, "LAUNCH", 45);
const BACK_AIR = hit(13.0, "KILL", 35, true, HitElement.slash);
const UP_AIR = hit(10.0, "LAUNCH", 85);
const DOWN_AIR = hit(13.0, "SPIKE", 270);
const DOWN_AIR_GROUNDED = hit(13.0, "LAUNCH", 55);
const GRAB_CONTACT = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const MOUNTAIN_KING_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  normals: {
    [AttackStyle.jab]: heroMove(5, 2, 15, 0, [
      frame(5, capsule(18.0, 38.0, f32(SHORT - 10.0), 42.0, 10.0), JAB),
      frame(6, capsule(18.0, 40.0, f32(SHORT - 10.0), 36.0, 10.0), JAB),
    ]),
    [AttackStyle.forwardTilt]: heroMove(9, 3, 21, 0, [
      frame(9, capsule(22.0, 63.0, f32(MEDIUM - 12.0), 70.0, 12.0), FORWARD_TILT),
      frame(10, capsule(22.0, 46.0, f32(MEDIUM - 12.0), 42.0, 12.0), FORWARD_TILT),
      frame(11, capsule(22.0, 32.0, 86.0, 16.0, 12.0), FORWARD_TILT),
    ]),
    [AttackStyle.forwardTiltUp]: heroMove(9, 3, 21, 0, [
      frame(9, capsule(22.0, 63.0, 72.0, f32(MEDIUM - 12.0), 12.0), FORWARD_TILT),
      frame(10, capsule(22.0, 54.0, f32(MEDIUM - 12.0), 80.0, 12.0), FORWARD_TILT),
      frame(11, capsule(22.0, 46.0, 86.0, 56.0, 12.0), FORWARD_TILT),
    ]),
    [AttackStyle.forwardTiltDown]: heroMove(9, 3, 21, 0, [
      frame(9, capsule(22.0, 48.0, f32(MEDIUM - 12.0), 28.0, 12.0), FORWARD_TILT),
      frame(10, capsule(22.0, 36.0, f32(MEDIUM - 12.0), 8.0, 12.0), FORWARD_TILT),
      frame(11, capsule(22.0, 26.0, 86.0, -8.0, 12.0), FORWARD_TILT),
    ]),
    [AttackStyle.upTilt]: heroMove(8, 4, 22, 0, [
      frame(8, capsule(20.0, 56.0, 68.0, 78.0, 14.0), UP_TILT),
      frame(9, capsule(16.0, 68.0, 40.0, f32(MEDIUM - 14.0), 14.0), UP_TILT),
      frame(10, capsule(4.0, 72.0, -12.0, f32(MEDIUM - 14.0), 14.0), UP_TILT),
      frame(11, capsule(-8.0, 68.0, -24.0, 78.0, 14.0), UP_TILT),
    ]),
    [AttackStyle.downTilt]: heroMove(7, 3, 18, 0, [
      frame(7, capsule(12.0, 8.0, f32(SHORT - 12.0), 12.0, 12.0), DOWN_TILT),
      frame(8, capsule(12.0, 8.0, f32(SHORT - 12.0), 4.0, 12.0), DOWN_TILT),
      frame(9, capsule(12.0, 8.0, 48.0, -2.0, 12.0), DOWN_TILT),
    ]),
    // Body actions stay inside the exposed torso instead of filling M reach
    // with a disjoint volume. Dwarf Charge carries its reach by movement.
    [AttackStyle.dashAttack]: heroMove(11, 5, 28, 0, [
      heroRegion(11, 15, capsule(0.0, 12.0, 0.0, 65.0, 24.0), DASH),
    ], f32(MEDIUM - 24.0)),
    [AttackStyle.forwardSmash]: heroMove(20, 3, 36, 0, [
      frame(20, circle(108.0, 92.0, 18.0), FORWARD_SMASH_HEAD),
      frame(21, circle(f32(LONG - 18.0), 56.0, 18.0), FORWARD_SMASH_HEAD),
      frame(22, circle(115.0, 18.0, 18.0), FORWARD_SMASH_HEAD),
      frame(20, capsule(18.0, 50.0, 100.0, 86.0, 8.0), FORWARD_SMASH_HANDLE),
      frame(21, capsule(18.0, 50.0, 115.0, 55.0, 8.0), FORWARD_SMASH_HANDLE),
      frame(22, capsule(18.0, 50.0, 105.0, 24.0, 8.0), FORWARD_SMASH_HANDLE),
    ]),
    [AttackStyle.upSmash]: heroMove(17, 5, 32, 0, [
      frame(17, capsule(35.0, 66.0, 65.0, 80.0, 16.0), UP_SMASH),
      frame(18, capsule(20.0, 70.0, 40.0, f32(MEDIUM - 16.0), 16.0), UP_SMASH),
      frame(19, capsule(14.0, 78.0, -14.0, f32(MEDIUM - 16.0), 16.0), UP_SMASH),
      frame(20, capsule(-20.0, 72.0, -40.0, 85.0, 16.0), UP_SMASH),
      frame(21, capsule(-24.0, 65.0, -50.0, 72.0, 16.0), UP_SMASH),
    ]),
    [AttackStyle.downSmash]: heroMove(16, 6, 34, 0, [
      frame(16, capsule(18.0, 12.0, f32(MEDIUM - 14.0), 24.0, 14.0), DOWN_SMASH_FRONT),
      frame(17, capsule(18.0, 10.0, f32(MEDIUM - 14.0), 8.0, 14.0), DOWN_SMASH_FRONT),
      frame(18, capsule(18.0, 10.0, 70.0, -2.0, 14.0), DOWN_SMASH_FRONT),
      frame(19, capsule(-18.0, 12.0, -f32(MEDIUM - 14.0), 24.0, 14.0), DOWN_SMASH_BACK),
      frame(20, capsule(-18.0, 10.0, -f32(MEDIUM - 14.0), 8.0, 14.0), DOWN_SMASH_BACK),
      frame(21, capsule(-18.0, 10.0, -70.0, -2.0, 14.0), DOWN_SMASH_BACK),
    ]),
    [AttackStyle.neutralAir]: heroMove(8, 6, 22, 15, [
      heroRegion(8, 10, capsule(0.0, 18.0, 0.0, 62.0, 24.0), NEUTRAL_AIR_FRONT),
      heroRegion(11, 13, capsule(0.0, 18.0, 0.0, 62.0, 24.0), NEUTRAL_AIR_BACK),
    ]),
    [AttackStyle.forwardAir]: heroMove(16, 3, 30, 21, [
      frame(16, circle(72.0, 32.0, 20.0), FORWARD_AIR_HEAD, FORWARD_AIR_GROUNDED_HEAD),
      frame(17, circle(f32(MEDIUM - 20.0), 5.0, 20.0), FORWARD_AIR_HEAD, FORWARD_AIR_GROUNDED_HEAD),
      frame(18, circle(72.0, -25.0, 20.0), FORWARD_AIR_HEAD, FORWARD_AIR_GROUNDED_HEAD),
      frame(16, capsule(16.0, 54.0, 62.0, 36.0, 8.0), FORWARD_AIR_HANDLE),
      frame(17, capsule(16.0, 50.0, 74.0, 13.0, 8.0), FORWARD_AIR_HANDLE),
      frame(18, capsule(16.0, 46.0, 64.0, -13.0, 8.0), FORWARD_AIR_HANDLE),
    ]),
    [AttackStyle.backAir]: heroMove(10, 3, 25, 15, [
      frame(10, capsule(-18.0, 60.0, -f32(MEDIUM - 12.0), 65.0, 12.0), BACK_AIR),
      frame(11, capsule(-18.0, 45.0, -f32(MEDIUM - 12.0), 40.0, 12.0), BACK_AIR),
      frame(12, capsule(-18.0, 30.0, -80.0, 18.0, 12.0), BACK_AIR),
    ]),
    [AttackStyle.upAir]: heroMove(7, 4, 22, 13, [
      heroRegion(7, 10, capsule(0.0, 52.0, 0.0, f32(SHORT - 12.0), 12.0), UP_AIR),
    ]),
    [AttackStyle.downAir]: heroMove(12, 5, 29, 20, [
      heroRegion(12, 16, capsule(0.0, 5.0, 0.0, -f32(SHORT - 14.0), 14.0), DOWN_AIR, DOWN_AIR_GROUNDED),
    ]),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [
      heroRegion(8, 9, capsule(14.0, 14.0, f32(GRAB - 14.0), 24.0, 14.0), GRAB_CONTACT),
    ]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 1.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 36, effect: hit(9.0, "EDGE", 35) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 45, effect: hit(10.0, "KILL", 40, true) },
    [GrabAction.throwUp]: { contactFrame: 16, totalFrames: 39, effect: hit(8.0, "LAUNCH", 90) },
    [GrabAction.throwDown]: { contactFrame: 20, totalFrames: 46, effect: hit(7.0, "LINK", 75) },
  },
};
