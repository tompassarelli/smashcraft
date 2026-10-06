// Stage geometry. Stage 0 is one flat deck; stage 1 adds two raised
// pass-through decks. Deck 0 is always the main deck.
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { min } from "../../runtime/numbers";
import { SurfaceContact } from "./codes";
import { melee } from "./tuning";
import { squareRoot } from "./warcraftMath";

/** Stage 1's layout with solid raised decks; collision tests only, never selectable. */
export const SOLID_DECK_TEST_STAGE = 2;

function hasRaisedDecks(stage: number): boolean {
  return stage === 1 || stage === SOLID_DECK_TEST_STAGE;
}

/** Walkable decks. */
export function surfaceCount(stage: number): number {
  return stage === 0 ? 1 : hasRaisedDecks(stage) ? 3 : 0;
}

export function surfaceLeft(stage: number, index: number): number {
  if (index === 0) return -600.0;
  if (hasRaisedDecks(stage) && index === 1) return -420.0;
  if (hasRaisedDecks(stage) && index === 2) return 110.0;
  return 0.0;
}

export function surfaceRight(stage: number, index: number): number {
  if (index === 0) return 600.0;
  if (hasRaisedDecks(stage) && index === 1) return -110.0;
  if (hasRaisedDecks(stage) && index === 2) return 420.0;
  return 0.0;
}

export function surfaceZ(stage: number, index: number): number {
  return hasRaisedDecks(stage) && index > 0 ? 170.0 : 0.0;
}

/** Raised decks can be dropped through and landed on from below. */
export function surfacePass(stage: number, index: number): boolean {
  return stage === 1 && index > 0;
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
/** Reference lines from this point down are its underside; those above it are walls. */
const REFERENCE_UNDERSIDE_START = 5;

/** A reference point on the main deck's `side`, as far from this deck's ledge as from Melee's. */
function mainDeckX(side: number, point: ReferencePoint): number {
  const ledge = side < 0 ? surfaceLeft(0, 0) : surfaceRight(0, 0);
  return f32(ledge + f32(side * melee(f32(point.x - at(REFERENCE_RIGHT_SIDE, 0).x))));
}

function mainDeckZ(point: ReferencePoint): number {
  return f32(surfaceZ(0, 0) + melee(point.z));
}

function referenceLine(side: number, from: number, to: number): SolidSurface {
  const start = at(REFERENCE_RIGHT_SIDE, from);
  const end = at(REFERENCE_RIGHT_SIDE, to);
  const kind = min(from, to) < REFERENCE_UNDERSIDE_START ? SurfaceContact.wall : SurfaceContact.ceiling;
  return solidSurface(kind, mainDeckX(side, start), mainDeckZ(start), mainDeckX(side, end), mainDeckZ(end));
}

/**
 * Every stage's main deck has the reference stage's side walls and underside,
 * in that order: right side, underside, left side. Each side keeps its lines'
 * offsets from its ledge; the level underside spans the wider deck between them.
 */
function mainDeckBody(): SolidSurface[] {
  const last = REFERENCE_RIGHT_SIDE.length - 1;
  const bottom = at(REFERENCE_RIGHT_SIDE, last);
  const surfaces: SolidSurface[] = [];
  for (let i = 0; i < last; i++) surfaces.push(referenceLine(1, i, i + 1));
  surfaces.push(solidSurface(SurfaceContact.ceiling, mainDeckX(1, bottom), mainDeckZ(bottom), mainDeckX(-1, bottom), mainDeckZ(bottom)));
  for (let i = last; i > 0; i--) surfaces.push(referenceLine(-1, i, i - 1));
  return surfaces;
}

const MAIN_DECK_BODY = mainDeckBody();

/** The main deck's walls and underside lead every stage's solid surfaces. */
export const MAIN_DECK_BODY_SURFACES = MAIN_DECK_BODY.length;

// The test stage's solid raised decks follow tools/stage/package.ts: two side
// faces from the walking plane to z=-46 and the inset [-44,44] underside at
// z=-54, scaled by the renderer's 0.45 vertical scale. A pass deck is only its
// walking line: Melee's platform lines are floor lines (LINE_FLAG_PLATFORM),
// which collide from above while descending and are never walls or ceilings.
const RAISED_DECK_DEPTH_SCALE = 0.44999998807907104;

function raisedDeckSurfaces(stage: number): SolidSurface[] {
  const surfaces: SolidSurface[] = [];
  for (let deck = 1; deck < surfaceCount(stage); deck++) {
    const left = surfaceLeft(stage, deck);
    const right = surfaceRight(stage, deck);
    const top = surfaceZ(stage, deck);
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

const SOLID_DECK_TEST_SURFACES = [...MAIN_DECK_BODY, ...raisedDeckSurfaces(SOLID_DECK_TEST_STAGE)];

function solidSurfaces(stage: number): readonly SolidSurface[] {
  if (stage === SOLID_DECK_TEST_STAGE) return SOLID_DECK_TEST_SURFACES;
  return surfaceCount(stage) > 0 ? MAIN_DECK_BODY : [];
}

export function solidSurfaceCount(stage: number): number {
  return solidSurfaces(stage).length;
}

/** The stage's solid surface `index`, below solidSurfaceCount(stage). */
export function solidSurfaceAt(stage: number, index: number): SolidSurface {
  return at(solidSurfaces(stage), index);
}
