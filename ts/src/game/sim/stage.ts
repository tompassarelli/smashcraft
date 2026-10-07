// Stage geometry. Stage 0 is one flat deck; stage 1 adds two raised
// pass-through decks; stages 3 and 4 add pass-through decks that move along
// authored paths. Deck 0 is always the main deck, which never moves.
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { min } from "../../runtime/numbers";
import { SurfaceContact } from "./codes";
import { melee } from "./tuning";
import { squareRoot } from "./warcraftMath";

/** Stage 1's layout with solid raised decks; collision tests only, never selectable. */
export const SOLID_DECK_TEST_STAGE = 5;
/** The selectable winter arena, with Battlefield's three-platform arrangement. */
export const FROZEN_THRONE_STAGE = 2;
/** One pass-through deck drifting back and forth above the main deck, as on Ultimate's Smashville; Durotar Skies offers it. */
export const DRIFTING_DECK_STAGE = 3;
/** Two pass-through decks on their own timed patterns, as on Ultimate's Town and City; Naxxramas offers it. */
export const PATTERNED_DECKS_STAGE = 4;
/** Stage identities retained from their deterministic hazard fixtures. */
export const WIND_TEST_STAGE = 10;
export const CARRIED_TEST_STAGE = 11;
export const CANNON_TEST_STAGE = 12;
export const TIMED_TEST_STAGE = 13;
export const HELLFIRE_STAGE = 14;
/** Uther's and Dreadlord's home: a high rooftop over two low balconies, after Ultimate's Lylat Cruise without its tilt. */
export const STRATHOLME_STAGE = 6;
/** Warden's home: two platforms over the ends, overhanging the ledges, after Ultimate's Northern Cave. */
export const TOMB_OF_SARGERAS_STAGE = 7;
/** Sky Deck with a Yoshi's Story main deck: a level middle, ends sloping down to the ledges; tests only, never selectable. */
export const SLOPE_TEST_STAGE = 16;


/**
 * The stage clock with hazards off: the match passes it in place of its frame,
 * and every moving deck holds its rest pose while the wind and the cannon stay
 * away. Forecasts that add a few frames to it remain stopped.
 */
export const STAGE_AT_REST = -1000000;

/** Whether a stage clock reading is the stopped clock of a match with hazards off. */
export const stageAtRest = (frame: number): boolean => frame <= STAGE_AT_REST / 2;

const MAIN_DECK_LEFT = -600.0;
const MAIN_DECK_RIGHT = 600.0;
const MAIN_DECK_Z = 0.0;

/** The main deck's left ledge, which every stage has. */
export function mainDeckLeft(_stage: number): number {
  return MAIN_DECK_LEFT;
}

/** The main deck's right ledge. */
export function mainDeckRight(_stage: number): number {
  return MAIN_DECK_RIGHT;
}

/** The main deck's walking height. */
export function mainDeckZ(_stage: number): number {
  return MAIN_DECK_Z;
}

/** One leg of a deck's path: over `frames` frames its center travels in a straight line to (x, z). */
interface PathLeg {
  readonly frames: number;
  readonly x: number;
  readonly z: number;
}

/** A leg as the path runs it: from where the leg before ended, `step` a frame. */
interface RunLeg {
  readonly frames: number;
  readonly fromX: number;
  readonly fromZ: number;
  readonly stepX: number;
  readonly stepZ: number;
}

/** Where a moving deck is on one match frame, and how far it moved from the frame before. */
interface DeckPose {
  frame: number | undefined;
  left: number;
  right: number;
  z: number;
  shiftX: number;
  shiftZ: number;
}

/**
 * A deck that never moves, or one whose center follows a closed path: it
 * starts at its first leg's start, runs every leg, the last ending where the
 * first began, and repeats. Match frame 0 is `phase` frames into the path.
 */
type Deck =
  | { readonly kind: "fixed"; readonly left: number; readonly right: number; readonly z: number; readonly pass: boolean; readonly line: GroundLine | undefined }
  | {
    readonly kind: "moving"; readonly halfWidth: number; readonly phase: number; readonly period: number; readonly legs: readonly RunLeg[]; readonly pose: DeckPose;
    /** Where its center holds with hazards off. */
    readonly restX: number; readonly restZ: number;
  };

// Preallocated: every frame asks for each moving deck's center.
const center = { x: 0.0, z: 0.0 };

/** Places `center` `t` frames into a path's lap. */
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

/**
 * A sloped deck's walking line, as Melee's floor lines run: points left to
 * right, straight between them. A deck without one is level at its z.
 */
export interface GroundLine {
  readonly xs: readonly number[];
  readonly zs: readonly number[];
  /** Each segment's rise per unit of x. */
  readonly grades: readonly number[];
  /** Each segment's horizontal share of travel along it: Melee moves ground speed along the floor line. */
  readonly cosines: readonly number[];
  /** The line's highest point. */
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

/** The segment of `line` under `x`; the end segments extend past the line's ends. */
function segmentAt(line: GroundLine, x: number): number {
  const last = line.grades.length - 1;
  for (let k = 0; k < last; k++) if (x < at(line.xs, k + 1)) return k;
  return last;
}

/** The walking height of `line` at `x`, held at its end heights beyond them. */
export function groundLineZ(line: GroundLine, x: number): number {
  const { xs, zs } = line;
  if (x <= at(xs, 0)) return at(zs, 0);
  if (x >= at(xs, xs.length - 1)) return at(zs, zs.length - 1);
  const k = segmentAt(line, x);
  const grade = at(line.grades, k);
  return grade === 0 ? at(zs, k) : f32(at(zs, k) + f32(grade * f32(x - at(xs, k))));
}

/** The horizontal share of ground travel at `x` on `line`. */
export function groundLineCosine(line: GroundLine, x: number): number {
  return at(line.cosines, segmentAt(line, x));
}

/**
 * A pass-through deck `halfWidth` to each side of a center that starts at
 * (x, z) and follows `legs`. With hazards off it rests at `rest`, by default
 * where it is on match frame 0.
 */
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
/**
 * Yoshi's Story's main deck (GrSt): level over the middle 0.7 of its width,
 * then each end slopes 3.5 Melee units down to its ledge. The ledges keep the
 * main deck's height, so its corners, walls and underside are every stage's;
 * the middle stands 3.5 higher. Its z is the ledges' height.
 */
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
/**
 * Blackrock's forge: one static platform over the centre, after Ultimate's
 * Hollow Bastion (Smashville's static twin): 25 up and 0.3 of the stage wide.
 */
const BLACKROCK_DECKS = [MAIN_DECK, fixed(-180.0, 180.0, melee(25.0), true)];
const HELLFIRE_DECKS = [MAIN_DECK, fixed(-450.0, -270.0, melee(25.0), true), fixed(270.0, 450.0, melee(25.0), true)];
const STRATHOLME_DECKS = [SLOPED_MAIN_DECK,
  fixed(-510.0, -360.0, melee(18.0), true),
  fixed(360.0, 510.0, melee(18.0), true),
  fixed(-120.0, 120.0, melee(46.0), true),
];
/** Northern Cave's end platforms, 0.43 of a half-deck wide, reaching 90 past each ledge. */
const TOMB_OF_SARGERAS_DECKS = [MAIN_DECK, fixed(-690.0, -435.0, melee(29.0), true), fixed(435.0, 690.0, melee(29.0), true)];
const SOLID_RAISED_DECKS = [MAIN_DECK, fixed(-420.0, -110.0, 170.0, false), fixed(110.0, 420.0, 170.0, false)];

/**
 * Smashville's deck runs from one side to the other and pauses there. This
 * one is 360 wide at 180 up, travels 600 at 2.5 a frame, and waits a second
 * at each end: ten seconds a round trip, starting from the middle.
 */
const DRIFTING_DECK = moving(180.0, -300.0, 180.0, 180, [
  { frames: 60, x: -300.0, z: 180.0 },
  { frames: 240, x: 300.0, z: 180.0 },
  { frames: 60, x: 300.0, z: 180.0 },
  { frames: 240, x: -300.0, z: 180.0 },
]);

/** A lift on the left that rises from 120 to 300 at 1.5 a frame and pauses at the bottom and the top: seven seconds a cycle. */
const LIFT_DECK = moving(130.0, -330.0, 120.0, 0, [
  { frames: 90, x: -330.0, z: 120.0 },
  { frames: 120, x: -330.0, z: 300.0 },
  { frames: 90, x: -330.0, z: 300.0 },
  { frames: 120, x: -330.0, z: 120.0 },
]);

/**
 * A deck on the right looping a rectangle at 1.5 a frame, out along the
 * bottom, up, back along the top and down, pausing half a second at two
 * corners: 500 frames a lap. Its span never meets the lift's.
 */
const LOOP_DECK = moving(120.0, 210.0, 150.0, 0, [
  { frames: 140, x: 420.0, z: 150.0 },
  { frames: 30, x: 420.0, z: 150.0 },
  { frames: 80, x: 420.0, z: 270.0 },
  { frames: 140, x: 210.0, z: 270.0 },
  { frames: 30, x: 210.0, z: 270.0 },
  { frames: 80, x: 210.0, z: 150.0 },
]);

const NO_DECKS: readonly Deck[] = [];
// The carried platform waits before traversing each side of its loop; the
// timed lift waits at its extremes so the warning precedes every departure.
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

/**
 * Shallow water's floor friction: every traction a fighter slides against on
 * it is scaled by this (smashcraft:docs/physics.md, "Slippery floors").
 */
export const WATER_FRICTION = 0.5;
/** Main decks whose floor is not ordinary ground, with their friction. */
const MAIN_DECK_FRICTION: Readonly<Record<number, number | undefined>> = { [TOMB_OF_SARGERAS_STAGE]: WATER_FRICTION };

/** The friction of the floor a fighter stands on: 1 for ordinary ground and in the air. */
export function floorFriction(stage: number, motion: { readonly grounded: boolean; readonly surface: number | undefined }): number {
  return motion.grounded && motion.surface === 0 ? MAIN_DECK_FRICTION[stage] ?? 1.0 : 1.0;
}

/** A traction slid against on a floor of `friction`; ordinary ground keeps it exactly. */
export function floorTraction(traction: number, friction: number): number {
  return friction === 1.0 ? traction : f32(traction * friction);
}

// Each stage's tables, found on first ask: every fighter's motion, the
// confirmed match, prediction and replays ask many times a frame. A pure
// function's cache, which never changes a result.
const DECKS_BY_STAGE: Record<number, readonly Deck[] | undefined> = {};

function decks(stage: number): readonly Deck[] {
  const cached = DECKS_BY_STAGE[stage];
  if (cached !== undefined) return cached;
  const found = stageDecks(stage);
  DECKS_BY_STAGE[stage] = found;
  return found;
}

/** Walkable decks. */
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

/**
 * A moving deck's pose on `frame`. Every fighter asks for it on every frame,
 * and the confirmed match, prediction and replays again, so the last frame
 * asked is kept: a pure function's cache, which never changes a result.
 */
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

/** Deck `index`'s walking line when it slopes; a level deck has none. */
export function surfaceLine(stage: number, index: number): GroundLine | undefined {
  const found = decks(stage);
  if (index >= found.length) return undefined;
  const deck = at(found, index);
  return deck.kind === "fixed" ? deck.line : undefined;
}

/** Deck `index`'s walking height at `x` on match frame `frame`: its z, or a sloped deck's line there. */
export function surfaceZAt(stage: number, index: number, frame: number, x: number): number {
  const deck = at(decks(stage), index);
  if (deck.kind !== "fixed") return poseAt(deck, frame).z;
  return deck.line === undefined ? deck.z : groundLineZ(deck.line, x);
}

/** Deck `index`'s highest walking height on match frame `frame`. */
export function surfaceTopZ(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  if (deck.kind !== "fixed") return poseAt(deck, frame).z;
  return deck.line === undefined ? deck.z : deck.line.top;
}

/** The main deck's walking height at `x`; its ledges are at mainDeckZ. */
export function mainDeckZAt(stage: number, x: number): number {
  const found = decks(stage);
  const main = found.length > 0 ? at(found, 0) : undefined;
  return main !== undefined && main.kind === "fixed" && main.line !== undefined ? groundLineZ(main.line, x) : MAIN_DECK_Z;
}

/** Deck `index`'s left end on match frame `frame`. */
export function surfaceLeft(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? deck.left : poseAt(deck, frame).left;
}

/** Deck `index`'s right end on match frame `frame`. */
export function surfaceRight(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? deck.right : poseAt(deck, frame).right;
}

/** Deck `index`'s walking height on match frame `frame`. */
export function surfaceZ(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? deck.z : poseAt(deck, frame).z;
}

/** Whether deck `index` ever moves. */
export function surfaceMoves(stage: number, index: number): boolean {
  return at(decks(stage), index).kind === "moving";
}

/** Frames left in a moving deck's authored wait; absent while it moves. */
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

/** How far deck `index` moved sideways from the frame before `frame`. */
export function surfaceShiftX(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? 0.0 : poseAt(deck, frame).shiftX;
}

/** How far deck `index` rose from the frame before `frame`; negative when it sank. */
export function surfaceShiftZ(stage: number, index: number, frame: number): number {
  const deck = at(decks(stage), index);
  return deck.kind === "fixed" ? 0.0 : poseAt(deck, frame).shiftZ;
}

/** Raised and moving decks can be dropped through and landed on from below; stage 2's raised decks are solid. */
export function surfacePass(stage: number, index: number): boolean {
  const deck = at(decks(stage), index);
  return deck.kind === "moving" || deck.pass;
}

/**
 * A wall or underside line. The solid lies behind its unit outward normal,
 * which points to the left of the direction from start to end, as Melee's
 * collision lines run.
 */
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

/**
 * Final Destination's main-stage collision (GrNLa.dat coll_data, GALE01
 * revision 2, ground scale 1), in Melee units: its right ledge vertex, then
 * down the right side's lines in Melee's order, rightWall lines 9, 10, 7, 8
 * and 6, to the underside's ceiling lines 5 and 4. The left side mirrors it.
 */
const REFERENCE_RIGHT_SIDE: readonly ReferencePoint[] = [
  { x: 85.5656967163086, z: 0.0 },
  { x: 85.5656967163086, z: -10.5 },
  { x: 65.79930114746094, z: -20.453800201416016 },
  { x: 65.83740234375, z: -31.34429931640625 },
  { x: 61.419498443603516, z: -47.36629867553711 },
  { x: 53.77360153198242, z: -54.258399963378906 },
  { x: 47.45600128173828, z: -55.38819885253906 },
];
/**
 * Each ranked stage's main-deck profile: its right side from the ledge down,
 * as offsets from the ledge in Melee units; the left side mirrors it. Seven
 * points each, so every main deck has the same line count: five walls, then
 * an underside line to the level underside. Every line descends, so each
 * height crosses the body once. Archetypes: smashcraft:docs/design/stages.md,
 * "Main-deck topology".
 */
const DECK_PROFILES: Readonly<Record<number, readonly ReferencePoint[]>> = {
  // Battlefield: a thin lip over a long taper to a narrow keel.
  [FROZEN_THRONE_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -5.0 }, { x: -3.0, z: -9.0 }, { x: -12.0, z: -16.0 }, { x: -28.0, z: -26.0 }, { x: -46.0, z: -36.0 }, { x: -60.0, z: -40.0 }],
  // Dream Land: a deep, rounded bowl, like a tree's root mass.
  [WIND_TEST_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -8.0 }, { x: -2.0, z: -18.0 }, { x: -6.0, z: -30.0 }, { x: -14.0, z: -42.0 }, { x: -26.0, z: -52.0 }, { x: -40.0, z: -58.0 }],
  // Pokemon Stadium: a flat lip, a step in, then a lower shell.
  [CARRIED_TEST_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -7.0 }, { x: -8.0, z: -10.0 }, { x: -8.0, z: -24.0 }, { x: -12.0, z: -34.0 }, { x: -20.0, z: -40.0 }, { x: -30.0, z: -42.0 }],
  // A floating spire: a thin rim undercut to a deep point.
  [DRIFTING_DECK_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -4.0 }, { x: -10.0, z: -8.0 }, { x: -30.0, z: -14.0 }, { x: -48.0, z: -30.0 }, { x: -60.0, z: -50.0 }, { x: -66.0, z: -62.0 }],
  // An inverted ziggurat: three steps in.
  [PATTERNED_DECKS_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -9.0 }, { x: -7.0, z: -12.0 }, { x: -7.0, z: -22.0 }, { x: -15.0, z: -26.0 }, { x: -15.0, z: -38.0 }, { x: -26.0, z: -42.0 }],
  // A heavy slab: tall straight walls and a broad, blunt base.
  [HELLFIRE_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -14.0 }, { x: -2.0, z: -16.0 }, { x: -2.0, z: -40.0 }, { x: -6.0, z: -46.0 }, { x: -14.0, z: -50.0 }, { x: -22.0, z: -52.0 }],
  // A city rampart: a battlement lip, two set-back courses, then a buttressed base.
  [STRATHOLME_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -10.0 }, { x: -5.0, z: -12.0 }, { x: -5.0, z: -20.0 }, { x: -10.0, z: -22.0 }, { x: -16.0, z: -44.0 }, { x: -28.0, z: -48.0 }],
  // A sunken plinth: a waterline lip over a sheer drop, stepping out to a broad base.
  [TOMB_OF_SARGERAS_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -6.0 }, { x: -3.0, z: -8.0 }, { x: -3.0, z: -30.0 }, { x: -18.0, z: -34.0 }, { x: -24.0, z: -48.0 }, { x: -34.0, z: -50.0 }],
  // A temple: an even trapezoid taper.
  [TIMED_TEST_STAGE]: [{ x: 0.0, z: 0.0 }, { x: 0.0, z: -6.0 }, { x: -4.0, z: -10.0 }, { x: -12.0, z: -20.0 }, { x: -22.0, z: -32.0 }, { x: -30.0, z: -44.0 }, { x: -36.0, z: -50.0 }],
};

/** Profile lines from this point down are its underside; those above it are walls. */
const REFERENCE_UNDERSIDE_START = 5;

/** The main deck's profile on `stage`: its own, or Final Destination's. */
function deckProfile(stage: number): readonly ReferencePoint[] {
  return DECK_PROFILES[stage] ?? REFERENCE_RIGHT_SIDE;
}

/** A profile point on the main deck's `side`, as far from this deck's ledge as from the profile's. */
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

/**
 * A main deck's side walls and underside, in that order: right side,
 * underside, left side. Each side keeps its lines' offsets from its ledge;
 * the level underside spans the deck between them.
 */
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
  [STRATHOLME_STAGE]: mainDeckBody(deckProfile(STRATHOLME_STAGE)),
  [TOMB_OF_SARGERAS_STAGE]: mainDeckBody(deckProfile(TOMB_OF_SARGERAS_STAGE)),
};

/** The main deck's walls and underside on `stage`. */
function mainDeckBodyOf(stage: number): readonly SolidSurface[] {
  return PROFILED_BODIES[stage] ?? MAIN_DECK_BODY;
}

/** The height of Final Destination's level underside, which stages 0, 1 and 5 keep. */
export const MAIN_DECK_UNDERSIDE_Z = referenceZ(at(REFERENCE_RIGHT_SIDE, REFERENCE_RIGHT_SIDE.length - 1));

const UNDERSIDE_Z_BY_STAGE: Record<number, number | undefined> = {};

/** The height of the main deck's level underside on `stage`, the lowest of its lines. */
export function mainDeckUndersideZ(stage: number): number {
  const cached = UNDERSIDE_Z_BY_STAGE[stage];
  if (cached !== undefined) return cached;
  const profile = deckProfile(stage);
  const z = referenceZ(at(profile, profile.length - 1));
  UNDERSIDE_Z_BY_STAGE[stage] = z;
  return z;
}

/** The main deck's walls and underside lead every stage's solid surfaces; every profile has as many. */
export const MAIN_DECK_BODY_SURFACES = MAIN_DECK_BODY.length;

// The test stage's solid raised decks follow tools/stage/package.ts: two side
// faces from the walking plane to z=-46 and the inset [-44,44] underside at
// z=-54, scaled by the renderer's 0.45 vertical scale. A pass deck is only its
// walking line: Melee's platform lines are floor lines (LINE_FLAG_PLATFORM),
// which collide from above while descending and are never walls or ceilings.
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
  // Kongo Jungle 64 has a floor-only main deck (GrOk.dat coll_data).
  if (stage === CANNON_TEST_STAGE) return NO_SOLID_SURFACES;
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

/** The stage's solid surfaces, in solidSurfaceAt's order. */
export function solidSurfacesOf(stage: number): readonly SolidSurface[] {
  return solidSurfaces(stage);
}

export function solidSurfaceCount(stage: number): number {
  return solidSurfaces(stage).length;
}

/** The stage's solid surface `index`, below solidSurfaceCount(stage). */
export function solidSurfaceAt(stage: number, index: number): SolidSurface {
  return at(solidSurfaces(stage), index);
}
