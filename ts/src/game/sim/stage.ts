


import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { min } from "../../runtime/numbers";
import { SurfaceContact } from "./codes";
import { melee } from "./tuning";
import { squareRoot } from "./warcraftMath";


export const SOLID_DECK_TEST_STAGE = 5;

export const FROZEN_THRONE_STAGE = 2;

export const DRIFTING_DECK_STAGE = 3;

export const PATTERNED_DECKS_STAGE = 4;

export const WIND_TEST_STAGE = 10;
export const CARRIED_TEST_STAGE = 11;
export const CANNON_TEST_STAGE = 12;
export const TIMED_TEST_STAGE = 13;
export const HELLFIRE_STAGE = 14;

export const STRATHOLME_STAGE = 6;

export const TOMB_OF_SARGERAS_STAGE = 7;

export const SLOPE_TEST_STAGE = 16;







export const STAGE_AT_REST = -1000000;


export const stageAtRest = (frame: number): boolean => frame <= STAGE_AT_REST / 2;

const MAIN_DECK_LEFT = -600.0;
const MAIN_DECK_RIGHT = 600.0;
const MAIN_DECK_Z = 0.0;


export function mainDeckLeft(_stage: number): number {
  return MAIN_DECK_LEFT;
}


export function mainDeckRight(_stage: number): number {
  return MAIN_DECK_RIGHT;
}


export function mainDeckZ(_stage: number): number {
  return MAIN_DECK_Z;
}


interface PathLeg {
  readonly frames: number;
  readonly x: number;
  readonly z: number;
}


interface RunLeg {
  readonly frames: number;
  readonly fromX: number;
  readonly fromZ: number;
  readonly stepX: number;
  readonly stepZ: number;
}


interface DeckPose {
  frame: number | undefined;
  left: number;
  right: number;
  z: number;
  shiftX: number;
  shiftZ: number;
}






type Deck =
  | { readonly kind: "fixed"; readonly left: number; readonly right: number; readonly z: number; readonly pass: boolean; readonly line: GroundLine | undefined }
  | {
    readonly kind: "moving"; readonly halfWidth: number; readonly phase: number; readonly period: number; readonly legs: readonly RunLeg[]; readonly pose: DeckPose;

    readonly restX: number; readonly restZ: number;
  };


const center = { x: 0.0, z: 0.0 };


function pathCenter(legs: readonly RunLeg[], t: number): void {
  for (const leg of legs) {
    if (t < leg.frames) {
      center.x = leg.stepX === 0 ? leg.fromX : f32(leg.fromX + f32(leg.stepX * t));
      center.z = leg.stepZ === 0 ? leg.fromZ : f32(leg.fromZ + f32(leg.stepZ * t));
      return;
    }
    t -= leg.frames;
  }
}


function fixed(left: number, right: number, z: number, pass: boolean): Deck {
  return { kind: "fixed", left, right, z, pass, line: undefined };
}





export interface GroundLine {
  readonly xs: readonly number[];
  readonly zs: readonly number[];

  readonly grades: readonly number[];

  readonly cosines: readonly number[];

  readonly top: number;
}

function groundLine(points: readonly { readonly x: number; readonly z: number }[]): GroundLine {
  const xs: number[] = [];
  const zs: number[] = [];
  const grades: number[] = [];
  const cosines: number[] = [];
  let top = at(points, 0).z;
  for (let i = 0; i < points.length; i++) {
    const point = at(points, i);
    xs.push(point.x);
    zs.push(point.z);
    if (point.z > top) top = point.z;
    if (i === 0) continue;
    const previous = at(points, i - 1);
    const grade = f32(f32(point.z - previous.z) / f32(point.x - previous.x));
    grades.push(grade);
    cosines.push(grade === 0 ? 1.0 : f32(1.0 / squareRoot(f32(1.0 + f32(grade * grade)))));
  }
  return { xs, zs, grades, cosines, top };
}


function segmentAt(line: GroundLine, x: number): number {
  const last = line.grades.length - 1;
  for (let k = 0; k < last; k++) if (x < at(line.xs, k + 1)) return k;
  return last;
}


export function groundLineZ(line: GroundLine, x: number): number {
  const { xs, zs } = line;
  if (x <= at(xs, 0)) return at(zs, 0);
  if (x >= at(xs, xs.length - 1)) return at(zs, zs.length - 1);
  const k = segmentAt(line, x);
  const grade = at(line.grades, k);
  return grade === 0 ? at(zs, k) : f32(at(zs, k) + f32(grade * f32(x - at(xs, k))));
}


export function groundLineCosine(line: GroundLine, x: number): number {
  return at(line.cosines, segmentAt(line, x));
}






function moving(halfWidth: number, x: number, z: number, phase: number, legs: readonly PathLeg[], rest?: { readonly x: number; readonly z: number }): Deck {
  const run: RunLeg[] = [];
  let fromX = x;
  let fromZ = z;
  let period = 0;
  for (const leg of legs) {
    run.push({ frames: leg.frames, fromX, fromZ, stepX: f32(f32(leg.x - fromX) / leg.frames), stepZ: f32(f32(leg.z - fromZ) / leg.frames) });
    fromX = leg.x;
    fromZ = leg.z;
    period += leg.frames;
  }
  const pose: DeckPose = { frame: undefined, left: 0.0, right: 0.0, z: 0.0, shiftX: 0.0, shiftZ: 0.0 };
  if (rest !== undefined) return { kind: "moving", halfWidth, phase, period, legs: run, pose, restX: rest.x, restZ: rest.z };
  pathCenter(run, floorMod(phase, period));
  return { kind: "moving", halfWidth, phase, period, legs: run, pose, restX: center.x, restZ: center.z };
}

const MAIN_DECK = fixed(MAIN_DECK_LEFT, MAIN_DECK_RIGHT, MAIN_DECK_Z, false);






const SLOPE_LEVEL_HALF_WIDTH = 420.0;
const SLOPE_RISE = melee(3.5);
const SLOPED_MAIN_DECK: Deck = {
  kind: "fixed", left: MAIN_DECK_LEFT, right: MAIN_DECK_RIGHT, z: MAIN_DECK_Z, pass: false,
  line: groundLine([
    { x: MAIN_DECK_LEFT, z: MAIN_DECK_Z },
    { x: -SLOPE_LEVEL_HALF_WIDTH, z: f32(MAIN_DECK_Z + SLOPE_RISE) },
    { x: SLOPE_LEVEL_HALF_WIDTH, z: f32(MAIN_DECK_Z + SLOPE_RISE) },
    { x: MAIN_DECK_RIGHT, z: MAIN_DECK_Z },
  ]),
};
const RAISED_DECKS = [MAIN_DECK, fixed(-420.0, -110.0, 170.0, true), fixed(110.0, 420.0, 170.0, true)];
const FROZEN_THRONE_DECKS = [MAIN_DECK,
  fixed(-505.0, -175.0, melee(27.200000762939453), true),
  fixed(175.0, 505.0, melee(27.200000762939453), true),
  fixed(-165.0, 165.0, melee(54.400001525878906), true),
];
const NORDRASSIL_DECKS = [MAIN_DECK,
  fixed(-490.0, -310.0, melee(30.0), true),
  fixed(310.0, 490.0, melee(30.0), true),
  fixed(-114.0, 114.0, melee(51.5), true),
];
const GRYPHON_DECKS = [MAIN_DECK,
  fixed(-480.0, -291.0, melee(23.5), true),
  fixed(291.0, 480.0, melee(23.5), true),
  fixed(-94.5, 94.5, melee(42.0), true),
];




const BLACKROCK_DECKS = [MAIN_DECK, fixed(-180.0, 180.0, melee(25.0), true)];
const HELLFIRE_DECKS = [MAIN_DECK, fixed(-450.0, -270.0, melee(25.0), true), fixed(270.0, 450.0, melee(25.0), true)];
const STRATHOLME_DECKS = [SLOPED_MAIN_DECK,
  fixed(-510.0, -360.0, melee(18.0), true),
  fixed(360.0, 510.0, melee(18.0), true),
  fixed(-120.0, 120.0, melee(46.0), true),
];

const TOMB_OF_SARGERAS_DECKS = [MAIN_DECK, fixed(-690.0, -435.0, melee(29.0), true), fixed(435.0, 690.0, melee(29.0), true)];
const SOLID_RAISED_DECKS = [MAIN_DECK, fixed(-420.0, -110.0, 170.0, false), fixed(110.0, 420.0, 170.0, false)];






const DRIFTING_DECK = moving(180.0, -300.0, 180.0, 180, [
  { frames: 60, x: -300.0, z: 180.0 },
  { frames: 240, x: 300.0, z: 180.0 },
  { frames: 60, x: 300.0, z: 180.0 },
  { frames: 240, x: -300.0, z: 180.0 },
]);


const LIFT_DECK = moving(130.0, -330.0, 120.0, 0, [
  { frames: 90, x: -330.0, z: 120.0 },
  { frames: 120, x: -330.0, z: 300.0 },
  { frames: 90, x: -330.0, z: 300.0 },
  { frames: 120, x: -330.0, z: 120.0 },
]);






const LOOP_DECK = moving(120.0, 210.0, 150.0, 0, [
  { frames: 140, x: 420.0, z: 150.0 },
  { frames: 30, x: 420.0, z: 150.0 },
  { frames: 80, x: 420.0, z: 270.0 },
  { frames: 140, x: 210.0, z: 270.0 },
  { frames: 30, x: 210.0, z: 270.0 },
  { frames: 80, x: 210.0, z: 150.0 },
]);

const NO_DECKS: readonly Deck[] = [];


const CARRIED_DECK = moving(110.0, -420.0, 120.0, 0, [
  { frames: 60, x: -420.0, z: 120.0 },
  { frames: 280, x: 420.0, z: 120.0 },
  { frames: 60, x: 420.0, z: 120.0 },
  { frames: 60, x: 420.0, z: 300.0 },
  { frames: 60, x: 420.0, z: 300.0 },
  { frames: 280, x: -420.0, z: 300.0 },
  { frames: 60, x: -420.0, z: 300.0 },
  { frames: 60, x: -420.0, z: 120.0 },
], { x: 0.0, z: 120.0 });
const STAGE_DECKS: readonly (readonly Deck[])[] = [
  [MAIN_DECK],
  RAISED_DECKS,
  FROZEN_THRONE_DECKS,
  [MAIN_DECK, DRIFTING_DECK],
  [MAIN_DECK, LIFT_DECK, LOOP_DECK],
  SOLID_RAISED_DECKS,
];

function stageDecks(stage: number): readonly Deck[] {
  if (stage === WIND_TEST_STAGE) return NORDRASSIL_DECKS;
  if (stage === CANNON_TEST_STAGE) return BLACKROCK_DECKS;
  if (stage === HELLFIRE_STAGE) return HELLFIRE_DECKS;
  if (stage === STRATHOLME_STAGE) return STRATHOLME_DECKS;
  if (stage === TOMB_OF_SARGERAS_STAGE) return TOMB_OF_SARGERAS_DECKS;
  if (stage === CARRIED_TEST_STAGE) return CARRIED_DECKS;
  if (stage === TIMED_TEST_STAGE) return TIMED_DECKS;
  if (stage === SLOPE_TEST_STAGE) return SLOPED_DECKS;
  return stage >= 0 && stage < STAGE_DECKS.length ? at(STAGE_DECKS, stage) : NO_DECKS;
}
const CARRIED_DECKS = [MAIN_DECK, CARRIED_DECK, at(GRYPHON_DECKS, 1), at(GRYPHON_DECKS, 2), at(GRYPHON_DECKS, 3)];
const TIMED_DECKS = [MAIN_DECK, LIFT_DECK];
const SLOPED_DECKS = [SLOPED_MAIN_DECK];





export const WATER_FRICTION = 0.5;

const MAIN_DECK_FRICTION: Readonly<Record<number, number | undefined>> = { [TOMB_OF_SARGERAS_STAGE]: WATER_FRICTION };


export function floorFriction(stage: number, motion: { readonly grounded: boolean; readonly surface: number | undefined }): number {
  return motion.grounded && motion.surface === 0 ? MAIN_DECK_FRICTION[stage] ?? 1.0 : 1.0;
}


export function floorTraction(traction: number, friction: number): number {
  return friction === 1.0 ? traction : f32(traction * friction);
}




const DECKS_BY_STAGE: Record<number, readonly Deck[] | undefined> = {};

function decks(stage: number): readonly Deck[] {
  const cached = DECKS_BY_STAGE[stage];
  if (cached !== undefined) return cached;
  const found = stageDecks(stage);
  DECKS_BY_STAGE[stage] = found;
  return found;
}


export function surfaceCount(stage: number): number {
  return decks(stage).length;
}

function placeCenter(deck: Extract<Deck, { kind: "moving" }>, frame: number): void {
  if (stageAtRest(frame)) {
    center.x = deck.restX;
    center.z = deck.restZ;
    return;
  }
  pathCenter(deck.legs, floorMod(frame + deck.phase, deck.period));
}






function poseAt(deck: Extract<Deck, { kind: "moving" }>, frame: number): Readonly<DeckPose> {
  const { pose } = deck;
  if (pose.frame === frame) return pose;
  placeCenter(deck, frame - 1);
  const previousX = center.x;
  const previousZ = center.z;
  placeCenter(deck, frame);
  pose.frame = frame;
  pose.left = f32(center.x - deck.halfWidth);
  pose.right = f32(center.x + deck.halfWidth);
  pose.z = center.z;
  pose.shiftX = f32(center.x - previousX);
  pose.shiftZ = f32(center.z - previousZ);
  return pose;
}


export function surfaceLine(stage: number, index: number): GroundLine | undefined {
  const found = decks(stage);
  if (index >= found.length) return undefined;
  const deck = at(found, index);
  return deck.kind === "fixed" ? deck.line : undefined;
}


export function surfaceZAt(stage: number, index: number, frame: number, x: number): number {
  const deck = at(decks(stage), index);
  if (deck.kind !== "fixed") return poseAt(deck, frame).z;
  return deck.line === undefined ? deck.z : groundLineZ(deck.line, x);
}


export function surfaceTopZ(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  if (deck.kind !== "fixed") return poseAt(deck, frame).z;
  return deck.line === undefined ? deck.z : deck.line.top;
}


export function mainDeckZAt(stage: number, x: number): number {
  const found = decks(stage);
  const main = found.length > 0 ? at(found, 0) : undefined;
  return main !== undefined && main.kind === "fixed" && main.line !== undefined ? groundLineZ(main.line, x) : MAIN_DECK_Z;
}


export function surfaceLeft(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? deck.left : poseAt(deck, frame).left;
}


export function surfaceRight(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? deck.right : poseAt(deck, frame).right;
}


export function surfaceZ(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? deck.z : poseAt(deck, frame).z;
}


export function surfaceMoves(stage: number, index: number): boolean {
  return at(decks(stage), index).kind === "moving";
}


export function surfaceWaitFrames(stage: number, index: number, frame: number): number | undefined {
  const deck = at(decks(stage), index);
  if (deck.kind === "fixed" || stageAtRest(frame)) return undefined;
  let t = floorMod(frame + deck.phase, deck.period);
  for (const leg of deck.legs) {
    if (t < leg.frames) return leg.stepX === 0 && leg.stepZ === 0 ? leg.frames - t : undefined;
    t -= leg.frames;
  }
  return undefined;
}


export function surfaceShiftX(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? 0.0 : poseAt(deck, frame).shiftX;
}


export function surfaceShiftZ(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? 0.0 : poseAt(deck, frame).shiftZ;
}


export function surfacePass(stage: number, index: number): boolean {
  const deck = at(decks(stage), index);
  return deck.kind === "moving" || deck.pass;
}






export interface SolidSurface {
  readonly kind: SurfaceContact;
  readonly startX: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endZ: number;
  readonly normalX: number;
  readonly normalZ: number;
}

function solidSurface(kind: SurfaceContact, startX: number, startZ: number, endX: number, endZ: number): SolidSurface {
  const alongX = f32(endX - startX);
  const alongZ = f32(endZ - startZ);
  const length = squareRoot(f32(f32(alongX * alongX) + f32(alongZ * alongZ)));
  return { kind, startX, startZ, endX, endZ, normalX: f32(f32(startZ - endZ) / length), normalZ: f32(alongX / length) };
}

interface ReferencePoint {
  readonly x: number;
  readonly z: number;
}

// Final Destination collision lines retain GrNLa.dat coll_data order (GALE01 revision 2, scale 1).





const REFERENCE_RIGHT_SIDE: readonly ReferencePoint[] = [
  { x: 85.5656967163086, z: 0.0 },
  { x: 85.5656967163086, z: -10.5 },
  { x: 65.79930114746094, z: -20.453800201416016 },
  { x: 65.83740234375, z: -31.34429931640625 },
  { x: 61.419498443603516, z: -47.36629867553711 },
  { x: 53.77360153198242, z: -54.258399963378906 },
  { x: 47.45600128173828, z: -55.38819885253906 },
];








const DECK_PROFILES: Readonly<Record<number, readonly ReferencePoint[]>> = {

  [FROZEN_THRONE_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -5.0 }, { x: -3.0, z: -9.0 }, { x: -12.0, z: -16.0 }, { x: -28.0, z: -26.0 }, { x: -46.0, z: -36.0 }, { x: -60.0, z: -40.0 }],

  [WIND_TEST_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -8.0 }, { x: -2.0, z: -18.0 }, { x: -6.0, z: -30.0 }, { x: -14.0, z: -42.0 }, { x: -26.0, z: -52.0 }, { x: -40.0, z: -58.0 }],

  [CARRIED_TEST_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -7.0 }, { x: -8.0, z: -10.0 }, { x: -8.0, z: -24.0 }, { x: -12.0, z: -34.0 }, { x: -20.0, z: -40.0 }, { x: -30.0, z: -42.0 }],

  [DRIFTING_DECK_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -4.0 }, { x: -10.0, z: -8.0 }, { x: -30.0, z: -14.0 }, { x: -48.0, z: -30.0 }, { x: -60.0, z: -50.0 }, { x: -66.0, z: -62.0 }],

  [PATTERNED_DECKS_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -9.0 }, { x: -7.0, z: -12.0 }, { x: -7.0, z: -22.0 }, { x: -15.0, z: -26.0 }, { x: -15.0, z: -38.0 }, { x: -26.0, z: -42.0 }],

  [HELLFIRE_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -14.0 }, { x: -2.0, z: -16.0 }, { x: -2.0, z: -40.0 }, { x: -6.0, z: -46.0 }, { x: -14.0, z: -50.0 }, { x: -22.0, z: -52.0 }],

  [STRATHOLME_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -10.0 }, { x: -5.0, z: -12.0 }, { x: -5.0, z: -20.0 }, { x: -10.0, z: -22.0 }, { x: -16.0, z: -44.0 }, { x: -28.0, z: -48.0 }],

  [TOMB_OF_SARGERAS_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -6.0 }, { x: -3.0, z: -8.0 }, { x: -3.0, z: -30.0 }, { x: -18.0, z: -34.0 }, { x: -24.0, z: -48.0 }, { x: -34.0, z: -50.0 }],

  [CANNON_TEST_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -12.0 }, { x: -4.0, z: -14.0 }, { x: -4.0, z: -34.0 }, { x: -10.0, z: -40.0 }, { x: -22.0, z: -48.0 }, { x: -36.0, z: -50.0 }],

  [TIMED_TEST_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -6.0 }, { x: -4.0, z: -10.0 }, { x: -12.0, z: -20.0 }, { x: -22.0, z: -32.0 }, { x: -30.0, z: -44.0 }, { x: -36.0, z: -50.0 }],
};


const REFERENCE_UNDERSIDE_START = 5;


function deckProfile(stage: number): readonly ReferencePoint[] {
  return DECK_PROFILES[stage] ?? REFERENCE_RIGHT_SIDE;
}


function referenceX(profile: readonly ReferencePoint[], side: number, point: ReferencePoint): number {
  const ledge = side < 0 ? MAIN_DECK_LEFT : MAIN_DECK_RIGHT;
  return f32(ledge + f32(side * melee(f32(point.x - at(profile, 0).x))));
}

function referenceZ(point: ReferencePoint): number {
  return f32(MAIN_DECK_Z + melee(point.z));
}

function referenceLine(profile: readonly ReferencePoint[], side: number, from: number, to: number): SolidSurface {
  const start = at(profile, from);
  const end = at(profile, to);
  const kind = min(from, to) < REFERENCE_UNDERSIDE_START ? SurfaceContact.wall : SurfaceContact.ceiling;
  return solidSurface(kind, referenceX(profile, side, start), referenceZ(start), referenceX(profile, side, end), referenceZ(end));
}






function mainDeckBody(profile: readonly ReferencePoint[]): SolidSurface[] {
  const last = profile.length - 1;
  const bottom = at(profile, last);
  const surfaces: SolidSurface[] = [];
  for (let i = 0; i < last; i++) surfaces.push(referenceLine(profile, 1, i, i + 1));
  surfaces.push(solidSurface(SurfaceContact.ceiling, referenceX(profile, 1, bottom), referenceZ(bottom), referenceX(profile, -1, bottom), referenceZ(bottom)));
  for (let i = last; i > 0; i--) surfaces.push(referenceLine(profile, -1, i, i - 1));
  return surfaces;
}

const MAIN_DECK_BODY = mainDeckBody(REFERENCE_RIGHT_SIDE);
const PROFILED_BODIES: Readonly<Record<number, readonly SolidSurface[]>> = {
  [FROZEN_THRONE_STAGE]: mainDeckBody(deckProfile(FROZEN_THRONE_STAGE)),
  [WIND_TEST_STAGE]: mainDeckBody(deckProfile(WIND_TEST_STAGE)),
  [CARRIED_TEST_STAGE]: mainDeckBody(deckProfile(CARRIED_TEST_STAGE)),
  [DRIFTING_DECK_STAGE]: mainDeckBody(deckProfile(DRIFTING_DECK_STAGE)),
  [PATTERNED_DECKS_STAGE]: mainDeckBody(deckProfile(PATTERNED_DECKS_STAGE)),
  [HELLFIRE_STAGE]: mainDeckBody(deckProfile(HELLFIRE_STAGE)),
  [TIMED_TEST_STAGE]: mainDeckBody(deckProfile(TIMED_TEST_STAGE)),
  [CANNON_TEST_STAGE]: mainDeckBody(deckProfile(CANNON_TEST_STAGE)),
  [STRATHOLME_STAGE]: mainDeckBody(deckProfile(STRATHOLME_STAGE)),
  [TOMB_OF_SARGERAS_STAGE]: mainDeckBody(deckProfile(TOMB_OF_SARGERAS_STAGE)),
};


function mainDeckBodyOf(stage: number): readonly SolidSurface[] {
  return PROFILED_BODIES[stage] ?? MAIN_DECK_BODY;
}


export const MAIN_DECK_UNDERSIDE_Z = referenceZ(at(REFERENCE_RIGHT_SIDE, REFERENCE_RIGHT_SIDE.length - 1));

const UNDERSIDE_Z_BY_STAGE: Record<number, number | undefined> = {};


export function mainDeckUndersideZ(stage: number): number {
  const cached = UNDERSIDE_Z_BY_STAGE[stage];
  if (cached !== undefined) return cached;
  const profile = deckProfile(stage);
  const z = referenceZ(at(profile, profile.length - 1));
  UNDERSIDE_Z_BY_STAGE[stage] = z;
  return z;
}


export const MAIN_DECK_BODY_SURFACES = MAIN_DECK_BODY.length;






const RAISED_DECK_DEPTH_SCALE = 0.44999998807907104;

function raisedDeckSurfaces(raised: readonly Deck[]): SolidSurface[] {
  const surfaces: SolidSurface[] = [];
  for (const deck of raised) {
    if (deck.kind !== "fixed" || deck === MAIN_DECK) continue;
    const { left, right, z: top } = deck;
    const wallBottom = f32(top - f32(46 * RAISED_DECK_DEPTH_SCALE));
    const underside = f32(top - f32(54 * RAISED_DECK_DEPTH_SCALE));
    const center = f32(f32(left + right) / 2);
    const halfWidth = f32(f32(right - left) * 0.4399999976158142);
    surfaces.push(solidSurface(SurfaceContact.wall, left, wallBottom, left, top));
    surfaces.push(solidSurface(SurfaceContact.wall, right, top, right, wallBottom));
    surfaces.push(solidSurface(SurfaceContact.ceiling, f32(center + halfWidth), underside, f32(center - halfWidth), underside));
  }
  return surfaces;
}

const SOLID_DECK_TEST_SURFACES = [...MAIN_DECK_BODY, ...raisedDeckSurfaces(SOLID_RAISED_DECKS)];

function stageSolidSurfaces(stage: number): readonly SolidSurface[] {
  if (stage === SOLID_DECK_TEST_STAGE) return SOLID_DECK_TEST_SURFACES;
  return surfaceCount(stage) > 0 ? mainDeckBodyOf(stage) : NO_SOLID_SURFACES;
}

const NO_SOLID_SURFACES: readonly SolidSurface[] = [];
const SOLID_SURFACES_BY_STAGE: Record<number, readonly SolidSurface[] | undefined> = {};

function solidSurfaces(stage: number): readonly SolidSurface[] {
  const cached = SOLID_SURFACES_BY_STAGE[stage];
  if (cached !== undefined) return cached;
  const found = stageSolidSurfaces(stage);
  SOLID_SURFACES_BY_STAGE[stage] = found;
  return found;
}


export function solidSurfacesOf(stage: number): readonly SolidSurface[] {
  return solidSurfaces(stage);
}

export function solidSurfaceCount(stage: number): number {
  return solidSurfaces(stage).length;
}


export function solidSurfaceAt(stage: number, index: number): SolidSurface {
  return at(solidSurfaces(stage), index);
}
