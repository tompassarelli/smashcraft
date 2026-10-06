// Keeping the computer's fighter on the main deck: it steers toward a goal
// only while the point it would come to rest at stays inside the deck, on
// the ground and in the air, and brakes once that point would pass an edge.
import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { mainDeckLeft, mainDeckRight, surfaceLeft, surfaceRight } from "../sim/stage";

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
export function slideStaysOnDeck(f: Readonly<Fighter>, stage: number): boolean {
  const { x, vx, surface } = f.motion;
  const rest = restingX(x, vx, f.tuning.physics.traction);
  if (surface === undefined || surface === 0) return rest >= safeLeft(stage) && rest <= safeRight(stage);
  return rest >= surfaceLeft(stage, surface) && rest <= surfaceRight(stage, surface);
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
