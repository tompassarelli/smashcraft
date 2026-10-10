import { downSmashHit } from "../downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { HERO_REFERENCE_HEIGHT, jabStep, heroHurtPose, heroMove, heroRegion, type FighterMoves, type MoveRegion, tipperMove } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, hurtPart } from "../hurtboxes";
import { capsuleOf, limbOf, makeHit, path, reaching } from "./authoring";



export const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
export const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
export const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const AXE_RADIUS = 9.0;


export const hit = makeHit({
  LINK: { growth: 71.01447296142578, base: 12.0 },
  POKE: { growth: 96.8379135131836, base: 18.0 },
  LAUNCH: { growth: 135.5730743408203, base: 20.0 },
  EDGE: { growth: 142.02894592285156, base: 22.0 },
  KILL: { growth: 154.94065856933594, base: 26.0 },
  SPIKE: { growth: 129.11721801757812, base: 22.0 },

  JUGGLE: { growth: 71.01447296142578, base: 50.0 },
  CHASE: { growth: 51.646888732910156, base: 75.0 },
}, HitElement.slash);


export const capsule = capsuleOf(AXE_RADIUS);



function chop(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(24.0, 55.0, f32(reach - AXE_RADIUS), z)), effect);
}



const BODY_RADIUS = hurtCapsule(Character.beastmaster).radius;
const BODY_TOP = hurtCapsule(Character.beastmaster).z2;
const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const LIMB_RADIUS = 10.0;
const limb = limbOf(BODY, LIMB_RADIUS);

const FORWARD_ARM = limb(12.0, 65.0, 62.0, 58.0);
const RAISED_ARMS = limb(5.0, 100.0, 10.0, 150.0);
const HALF_BOOT = limb(-12.0, 34.0, -45.0, 34.0, 11.0);

const BEASTMASTER_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    [AttackStyle.jab]: reaching(4, 2, limb(12.0, 60.0, 48.0, 56.0)),
    [AttackStyle.jab2]: reaching(4, 2, limb(12.0, 60.0, 50.0, 58.0)),
    [AttackStyle.jab3]: reaching(6, 3, limb(10.0, 50.0, 46.0, 50.0, 16.0)),
    [AttackStyle.forwardTilt]: reaching(10, 3, FORWARD_ARM),
    [AttackStyle.forwardTiltUp]: reaching(10, 3, limb(12.0, 70.0, 58.0, 88.0)),
    [AttackStyle.forwardTiltDown]: reaching(10, 3, limb(12.0, 58.0, 58.0, 38.0)),
    [AttackStyle.upTilt]: reaching(9, 4, RAISED_ARMS),
    [AttackStyle.downTilt]: reaching(8, 3, limb(12.0, 35.0, 52.0, 18.0)),
    [AttackStyle.dashAttack]: reaching(11, 5, limb(10.0, 50.0, 48.0, 62.0, 18.0)),
    [AttackStyle.forwardSmash]: reaching(21, 4, limb(12.0, 85.0, 70.0, 80.0)),
    [AttackStyle.upSmash]: reaching(18, 5, RAISED_ARMS),
    [AttackStyle.downSmash]: [
      heroHurtPose(15, 19, limb(12.0, 40.0, 60.0, 20.0)),
      heroHurtPose(20, 24, limb(-12.0, 40.0, -60.0, 20.0)),
    ],
    [AttackStyle.neutralAir]: [
      heroHurtPose(6, 10, limb(12.0, 62.0, 55.0, 58.0)),
      heroHurtPose(11, 15, limb(-12.0, 62.0, -55.0, 58.0)),
    ],
    [AttackStyle.forwardAir]: reaching(13, 4, limb(12.0, 85.0, 65.0, 70.0)),

    [AttackStyle.backAir]: [
      heroHurtPose(5, 8, HALF_BOOT),
      heroHurtPose(9, 13, limb(-12.0, 34.0, -f32(M - 24.0), 36.0, 11.0)),
      heroHurtPose(14, 16, HALF_BOOT),
    ],
    [AttackStyle.upAir]: reaching(8, 4, RAISED_ARMS),
    [AttackStyle.downAir]: reaching(16, 4, limb(5.0, 40.0, 5.0, -10.0)),
    [AttackStyle.grab]: reaching(8, 2, limb(12.0, 55.0, f32(S - 8.0), 52.0)),
  },
};

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const BEASTMASTER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: BEASTMASTER_BODY,
  normals: {

    [AttackStyle.jab]: jabStep(heroMove(4, 2, 14, 0, path(4, [
      capsule(18.0, 58.0, f32(S - 9.0), 56.0, 9.0),
      capsule(18.0, 56.0, f32(S - 9.0), 52.0, 9.0),
    ], hit(2.891230344772339, "LINK", 35, 1.0, HitElement.normal)))),

    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 14, 0, path(4, [
      capsule(18.0, 60.0, f32(S - 6.0), 58.0, 9.0),
      capsule(18.0, 58.0, f32(S - 6.0), 54.0, 9.0),
    ], hit(2.1684226989746094, "LINK", 70, 1.0, HitElement.normal)))),
    [AttackStyle.jab3]: heroMove(6, 3, 19, 0, path(6, [
      capsule(10.0, 40.0, f32(S + 6.0), 50.0, 14.0),
      capsule(10.0, 40.0, f32(S + 8.0), 48.0, 14.0),
      capsule(10.0, 40.0, f32(S + 4.0), 46.0, 14.0),
    ], hit(4.336845397949219, "POKE", 40, 1.0, HitElement.normal))),

    [AttackStyle.forwardTilt]: heroMove(10, 3, 23, 0, chop(10, [75.0, 50.0, 28.0], L, hit(7.950883388519287, "EDGE", 35))),
    [AttackStyle.forwardTiltUp]: heroMove(10, 3, 23, 0, chop(10, [115.0, 135.0, 150.0], L, hit(7.950883388519287, "EDGE", 50))),
    [AttackStyle.forwardTiltDown]: heroMove(10, 3, 23, 0, chop(10, [10.0, -10.0, -30.0], L, hit(7.950883388519287, "EDGE", 20))),

    [AttackStyle.upTilt]: heroMove(9, 4, 23, 0, path(9, [
      capsule(25.0, 70.0, 55.0, 105.0),
      capsule(15.0, 80.0, 22.0, f32(M + 40.0)),
      capsule(0.0, 80.0, 0.0, f32(M + 45.0)),
      capsule(-15.0, 80.0, -28.0, f32(M + 35.0)),
    ], hit(6.505268573760986, "LAUNCH", 85))),


    [AttackStyle.downTilt]: heroMove(8, 3, 22, 0, path(8, [
      capsule(20.0, 16.0, f32(M - AXE_RADIUS), 14.0),
      capsule(20.0, 12.0, f32(M - AXE_RADIUS), 8.0),
      capsule(20.0, 10.0, f32(M - AXE_RADIUS), 4.0),
    ], { ...hit(5.059652805328369, "LINK", 80), growth: 0.0, base: 45.0 })),


    [AttackStyle.dashAttack]: heroMove(11, 5, 28, 0, path(11, [
      capsule(10.0, 55.0, f32(M - 22.0), 60.0, 22.0),
      capsule(10.0, 55.0, f32(M - 22.0), 58.0, 22.0),
      capsule(10.0, 54.0, f32(M - 22.0), 56.0, 22.0),
      capsule(10.0, 52.0, f32(M - 24.0), 54.0, 20.0),
      capsule(10.0, 50.0, f32(M - 26.0), 52.0, 18.0),
    ], hit(8.673690795898438, "LAUNCH", 45, -1.0, HitElement.normal)), f32(HERO_REFERENCE_HEIGHT * f32(0.5))),

    [AttackStyle.forwardSmash]: tipperMove(heroMove(21, 4, 36, 0, chop(21, [120.0, 85.0, 50.0, 20.0], L, hit(14.456151962280273, "KILL", 40))), 0.25),

    [AttackStyle.upSmash]: heroMove(18, 5, 33, 0, path(18, [
      capsule(30.0, 80.0, 55.0, f32(L - 10.0)),
      capsule(15.0, 85.0, 22.0, f32(L + 20.0)),
      capsule(0.0, 85.0, 0.0, f32(L + 25.0)),
      capsule(-15.0, 85.0, -22.0, f32(L + 20.0)),
      capsule(-30.0, 80.0, -55.0, f32(L - 10.0)),
    ], hit(12.287728309631348, "KILL", 85))),

    [AttackStyle.downSmash]: heroMove(17, 6, 22, 0, [
      ...path(17, [
        capsule(22.0, 18.0, f32(L - AXE_RADIUS), 20.0),
        capsule(22.0, 12.0, f32(L - AXE_RADIUS), 10.0),
        capsule(22.0, 10.0, f32(L - AXE_RADIUS), 2.0),
      ], downSmashHit(hit(14.309999465942383, "EDGE", 25))),
      ...path(20, [
        capsule(-22.0, 18.0, -f32(L - AXE_RADIUS), 20.0),
        capsule(-22.0, 12.0, -f32(L - AXE_RADIUS), 10.0),
        capsule(-22.0, 10.0, -f32(L - AXE_RADIUS), 2.0),
      ], downSmashHit(hit(14.309999465942383, "EDGE", 25, -1.0))),
    ]),

    [AttackStyle.neutralAir]: heroMove(8, 6, 23, 15, [
      ...path(8, [
        capsule(20.0, 40.0, f32(M - AXE_RADIUS), 40.0),
        capsule(15.0, 60.0, 65.0, 95.0),
        capsule(0.0, 65.0, 0.0, f32(M + 20.0)),
      ], hit(7.228075981140137, "POKE", 50)),
      ...path(11, [
        capsule(-15.0, 60.0, -65.0, 95.0),
        capsule(-20.0, 40.0, -f32(M - AXE_RADIUS), 40.0),
        capsule(-15.0, 20.0, -60.0, 0.0),
      ], hit(7.228075981140137, "POKE", 50, -1.0)),
    ]),

    [AttackStyle.forwardAir]: heroMove(13, 4, 28, 18, chop(13, [110.0, 75.0, 40.0, 10.0], L, hit(10.119305610656738, "KILL", 40))),

    [AttackStyle.backAir]: heroMove(9, 3, 24, 14, path(9, [
      capsule(-12.0, 28.0, -f32(M - 12.0), 30.0, 12.0),
      capsule(-12.0, 32.0, -f32(M - 12.0), 40.0, 12.0),
      capsule(-12.0, 34.0, -f32(M - 12.0), 50.0, 12.0),
    ], hit(7.950883388519287, "EDGE", 35, -1.0, HitElement.normal))),

    [AttackStyle.upAir]: heroMove(8, 4, 23, 14, path(8, [
      capsule(8.0, 80.0, 14.0, f32(M + 45.0)),
      capsule(0.0, 80.0, 0.0, f32(M + 50.0)),
      capsule(-8.0, 80.0, -14.0, f32(M + 45.0)),
      capsule(-12.0, 75.0, -30.0, f32(M + 30.0)),
    ], hit(6.505268573760986, "LAUNCH", 85))),

    [AttackStyle.downAir]: heroMove(16, 4, 32, 22, path(16, [
      capsule(10.0, 10.0, 20.0, -f32(M - 30.0)),
      capsule(5.0, 10.0, 10.0, -f32(M - 25.0)),
      capsule(0.0, 10.0, 0.0, -f32(M - 25.0)),
      capsule(-5.0, 10.0, -10.0, -f32(M - 30.0)),
    ], hit(9.396498680114746, "SPIKE", 270), hit(9.396498680114746, "SPIKE", 55))),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [heroRegion(8, 9,
      capsule(18.0, 52.0, f32(f32(HERO_REFERENCE_HEIGHT * f32(0.60)) - 10.0), 50.0, 10.0),
      { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {

    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 2.861999750137329, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 13, totalFrames: 35, effect: hit(5.782460689544678, "EDGE", 35, 1.0, HitElement.normal) },
    [GrabAction.throwBack]: { contactFrame: 17, totalFrames: 43, effect: hit(6.505268573760986, "EDGE", 40, -1.0, HitElement.normal) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 24, effect: hit(5.059652805328369, "JUGGLE", 85, 1.0, HitElement.normal) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 44, effect: hit(4.336845397949219, "CHASE", 70, 1.0, HitElement.normal) },
  },
};
