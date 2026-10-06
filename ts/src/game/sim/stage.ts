// Stage geometry. Stage 0 is one flat deck; stage 1 adds two raised
// pass-through decks. Deck 0 is always the main deck.
import { f32 } from "wisp/src/sim/f32";
import { idiv, imod } from "wisp/src/sim/intMath";
import { SurfaceContact } from "./codes";

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

// A pass deck is only its walking line: Melee's platform lines are floor lines
// (LINE_FLAG_PLATFORM), which collide from above while descending and are
// never walls or ceilings. Solid decks expose faces, whose extents follow
// tools/stage/package.ts: a raised deck's two side faces from the walking plane
// to z=-46 and the inset [-44,44] underside at z=-54, scaled by the renderer's
// 0.45 vertical scale; the main deck exposes its underside while its outer edge
// remains open for runoffs.
export function solidSurfaceCount(stage: number): number {
  return stage === SOLID_DECK_TEST_STAGE ? 7 : surfaceCount(stage) > 0 ? 1 : 0;
}

function solidSurfaceDeck(stage: number, index: number): number {
  return stage === 0 || index === 0 ? 0 : 1 + idiv(index - 1, 3);
}

/** 0 is a deck's left wall, 1 its right wall, 2 its underside. */
function solidSurfaceFace(stage: number, index: number): number {
  return stage === 0 || index === 0 ? 2 : imod(index - 1, 3);
}

function isSolidSurface(stage: number, index: number): boolean {
  return index >= 0 && index < solidSurfaceCount(stage);
}

export function solidSurfaceKind(stage: number, index: number): SurfaceContact {
  if (!isSolidSurface(stage, index)) return SurfaceContact.none;
  return solidSurfaceFace(stage, index) < 2 ? SurfaceContact.wall : SurfaceContact.ceiling;
}

function deckDepthScale(deck: number): number {
  return deck > 0 ? 0.44999998807907104 : 1.0;
}

function deckThickness(deck: number): number {
  return f32(54 * deckDepthScale(deck));
}

/** A wall's x or an underside's z. */
export function solidSurfaceCoordinate(stage: number, index: number): number {
  if (!isSolidSurface(stage, index)) return 0.0;
  const deck = solidSurfaceDeck(stage, index);
  const face = solidSurfaceFace(stage, index);
  if (face === 0) return surfaceLeft(stage, deck);
  if (face === 1) return surfaceRight(stage, deck);
  return f32(surfaceZ(stage, deck) - deckThickness(deck));
}

function undersideCenter(stage: number, deck: number): number {
  return f32(f32(surfaceLeft(stage, deck) + surfaceRight(stage, deck)) / 2);
}

function undersideHalfWidth(stage: number, deck: number): number {
  return f32(f32(surfaceRight(stage, deck) - surfaceLeft(stage, deck)) * 0.4399999976158142);
}

/** The lower end of the surface's span: z for a wall, x for an underside. */
export function solidSurfaceMinimum(stage: number, index: number): number {
  if (!isSolidSurface(stage, index)) return 0.0;
  const deck = solidSurfaceDeck(stage, index);
  if (solidSurfaceFace(stage, index) < 2) return f32(surfaceZ(stage, deck) - f32(46 * deckDepthScale(deck)));
  return f32(undersideCenter(stage, deck) - undersideHalfWidth(stage, deck));
}

export function solidSurfaceMaximum(stage: number, index: number): number {
  if (!isSolidSurface(stage, index)) return 0.0;
  const deck = solidSurfaceDeck(stage, index);
  if (solidSurfaceFace(stage, index) < 2) return surfaceZ(stage, deck);
  return f32(undersideCenter(stage, deck) + undersideHalfWidth(stage, deck));
}

/** Outward normals: walls face away from their deck, undersides face down. */
export function solidSurfaceNormalX(stage: number, index: number): number {
  if (!isSolidSurface(stage, index)) return 0.0;
  const face = solidSurfaceFace(stage, index);
  return face === 0 ? -1.0 : face === 1 ? 1.0 : 0.0;
}

export function solidSurfaceNormalZ(stage: number, index: number): number {
  return isSolidSurface(stage, index) && solidSurfaceFace(stage, index) === 2 ? -1.0 : 0.0;
}
