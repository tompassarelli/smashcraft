// Keeping the computer's fighter on the main deck: it steers toward a goal
// only while the point it would come to rest at stays inside the deck, on
// the ground and in the air, and brakes once that point would pass an edge.
import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { floorFriction, floorTraction, mainDeckLeft, mainDeckRight, surfaceCount, surfaceLeft, surfaceLine, surfaceMoves, surfaceRight, surfaceZAt } from "../sim/stage";


/** How far inside the main deck's edges the computer keeps its resting point. */
const EDGE_MARGIN = 40.0;
/** Within this distance of its goal the computer walks, so it stops where it means to. */
const WALK_RANGE = 120.0;
/** Close enough to the goal to stop steering. */
const ARRIVED = 12.0;

const safeLeft = (stage: number): number => f32(mainDeckLeft(stage) + EDGE_MARGIN);
const safeRight = (stage: number): number => f32(mainDeckRight(stage) - EDGE_MARGIN);

/** Whether x lies between the deck's safe bounds, `inset` further in. */
export function safeAt(stage: number, x: number, inset: number): boolean {
  return x >= f32(safeLeft(stage) + inset) && x <= f32(safeRight(stage) - inset);
}

/** Where a fighter moving at vx comes to rest slowing by `deceleration` a frame, one frame late. */
function restingX(x: number, vx: number, deceleration: number): number {
  const speed = Math.abs(vx);
  const distance = f32(f32(f32(speed * speed) / f32(2.0 * deceleration)) + speed);
  return vx < 0 ? f32(x - distance) : f32(x + distance);
}

/**
 * Whether a grounded fighter that stops steering now, as a ground attack
 * makes it, comes to rest on its deck: inside the main deck's safe bounds,
 * or on the raised deck it stands on.
 */
export function slideStaysOnDeck(f: Readonly<Fighter>, stage: number, matchFrame: number): boolean {
  const { x, vx, surface } = f.motion;
  const rest = restingX(x, vx, floorTraction(f.tuning.physics.traction, floorFriction(stage, f.motion)));
  if (surface === undefined || surface === 0) return rest >= safeLeft(stage) && rest <= safeRight(stage);
  return rest >= surfaceLeft(stage, surface, matchFrame) && rest <= surfaceRight(stage, surface, matchFrame);
}

const towardGoal = (stage: number, goal: number) => Math.min(safeRight(stage), Math.max(safeLeft(stage), goal));

/**
 * Steers a grounded fighter toward goal: it runs while far and walks while
 * near, but never at a speed whose stop would pass the deck's safe bounds,
 * and turns back when its current slide would.
 */
export function steerOnGround(f: Readonly<Fighter>, stage: number, goal: number, input: Controls): void {
  const { x, vx } = f.motion;
  const { traction, dashSpeed, walkSpeed } = f.tuning.physics;
  const low = safeLeft(stage);
  const high = safeRight(stage);
  input.walking = false;
  input.direction = 0;
  const rest = restingX(x, vx, traction);
  if (rest > high || rest < low) {
    input.direction = rest > high ? -1 : 1;
    return;
  }
  const gap = f32(towardGoal(stage, goal) - x);
  if (Math.abs(gap) <= ARRIVED) return;
  const direction = gap > 0 ? 1 : -1;
  const along = Math.max(0.0, f32(vx * direction));
  const walking = Math.abs(gap) < WALK_RANGE;
  const pressed = restingX(x, f32(direction * Math.max(along, walking ? walkSpeed : dashSpeed)), traction);
  if (pressed > high || pressed < low) {
    const walked = restingX(x, f32(direction * Math.max(along, walkSpeed)), traction);
    if (walked > high || walked < low) return;
    input.walking = true;
  } else input.walking = walking;
  input.direction = direction;
}

/**
 * Drifts an airborne fighter toward goal while braking against its drift
 * would still stop it inside the deck's safe bounds; past that it steers
 * back toward the deck.
 */
export function steerInAir(f: Readonly<Fighter>, stage: number, goal: number, input: Controls): void {
  const { x, vx } = f.motion;
  const { airAcceleration, airSpeed } = f.tuning.physics;
  const low = safeLeft(stage);
  const high = safeRight(stage);
  input.direction = 0;
  const rest = restingX(x, vx, airAcceleration);
  if (rest > high || rest < low) {
    input.direction = rest > high ? -1 : 1;
    return;
  }
  const gap = f32(towardGoal(stage, goal) - x);
  if (Math.abs(gap) <= ARRIVED) return;
  const direction = gap > 0 ? 1 : -1;
  const along = Math.min(airSpeed, f32(Math.max(0.0, f32(vx * direction)) + airAcceleration));
  const pressed = restingX(x, f32(direction * along), airAcceleration);
  if (pressed <= high && pressed >= low) input.direction = direction;
}

/**
 * A fighter's height after `frames` more frames: its last frame's rise,
 * slowed each frame by gravity while airborne down to its fall speed, so a
 * rising jump isn't taken to keep rising into a target overhead, and held
 * by the deck under it when it falls that far (#160).
 */
export function heightAhead(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): number {
  const { z, deltaZ, surface } = f.motion;
  if (f.motion.grounded) {
    // On a fixed level deck the landing frame's step is the end of a fall, not motion that continues.
    if (deltaZ !== 0.0 && stage >= 0 && surface !== undefined && !surfaceMoves(stage, surface) && surfaceLine(stage, surface) === undefined) return z;
    return f32(z + f32(deltaZ * frames));
  }
  const { gravity, terminalSpeed } = f.tuning.physics;
  const floor = Math.min(deltaZ, -terminalSpeed);
  // Frames whose fall gravity still speeds up before the floor holds it.
  const slowing = Math.min(frames, Math.max(0, Math.floor(f32(f32(deltaZ - floor) / gravity))));
  const curve = f32(f32(deltaZ * slowing) - f32(gravity * ((slowing * (slowing + 1)) / 2)));
  const ahead = f32(z + f32(curve + f32(floor * (frames - slowing))));
  const deck = deckUnder(stage, matchFrame, f.motion.x, z);
  return deck !== undefined && ahead < deck ? deck : ahead;
}

/**
 * A fighter's horizontal position after `frames` more frames: its last
 * frame's travel, but an airborne fighter that falls onto the deck under it
 * within them slides on from the landing, braking by its traction on that
 * deck, and stops at the deck's edge, as heightAhead holds a fall (#345).
 */
export function horizontalAhead(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): number {
  const { x, z, deltaX } = f.motion;
  const straight = f32(x + f32(deltaX * frames));
  if (f.motion.grounded || stage < 0 || deltaX === 0.0) return straight;
  const deck = deckIndexUnder(stage, matchFrame, x, z);
  if (deck < 0) return straight;
  const deckZ = surfaceZAt(stage, deck, matchFrame, x);
  let landing = 1;
  while (landing <= frames && heightAhead(f, landing, -1, matchFrame) > deckZ) landing++;
  if (landing > frames) return straight;
  const traction = floorTraction(f.tuning.physics.traction, floorFriction(stage, { grounded: true, surface: deck }));
  const speed = Math.abs(deltaX);
  const braking = Math.min(frames - landing, Math.floor(f32(speed / traction)));
  const slide = f32(f32(speed * braking) - f32(traction * ((braking * (braking + 1)) / 2)));
  const landed = f32(x + f32(deltaX * landing));
  const rest = deltaX < 0 ? f32(landed - slide) : f32(landed + slide);
  return Math.max(surfaceLeft(stage, deck, matchFrame), Math.min(surfaceRight(stage, deck, matchFrame), rest));
}

/** The index of the highest deck of `stage` under (x, z) on match frame `matchFrame`, or -1 over the void. */
function deckIndexUnder(stage: number, matchFrame: number, x: number, z: number): number {
  let top = -1;
  let topZ = 0.0;
  for (let index = 0; index < surfaceCount(stage); index++) {
    const deck = surfaceZAt(stage, index, matchFrame, x);
    if (deck > z || x < surfaceLeft(stage, index, matchFrame) || x > surfaceRight(stage, index, matchFrame)) continue;
    if (top < 0 || deck > topZ) {
      top = index;
      topZ = deck;
    }
  }
  return top;
}

/** The highest deck of `stage` under (x, z) on match frame `matchFrame`, or undefined over the void. */
export function deckUnder(stage: number, matchFrame: number, x: number, z: number): number | undefined {
  const index = deckIndexUnder(stage, matchFrame, x, z);
  return index < 0 ? undefined : surfaceZAt(stage, index, matchFrame, x);
}
