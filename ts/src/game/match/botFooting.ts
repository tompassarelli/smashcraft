


import { f32 } from "wisp/src/sim/f32";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { floorFriction, floorTraction, mainDeckLeft, mainDeckRight, surfaceCount, surfaceLeft, surfaceLine, surfaceMoves, surfaceRight, surfaceZAt } from "../sim/stage";



const EDGE_MARGIN = 40.0;

const WALK_RANGE = 120.0;

const ARRIVED = 12.0;

const safeLeft = (stage: number): number => f32(mainDeckLeft(stage) + EDGE_MARGIN);
const safeRight = (stage: number): number => f32(mainDeckRight(stage) - EDGE_MARGIN);


export function safeAt(stage: number, x: number, inset: number): boolean {
  return x >= f32(safeLeft(stage) + inset) && x <= f32(safeRight(stage) - inset);
}


function restingX(x: number, vx: number, deceleration: number): number {
  const speed = Math.abs(vx);
  const distance = f32(f32(f32(speed * speed) / f32(2.0 * deceleration)) + speed);
  return vx < 0 ? f32(x - distance) : f32(x + distance);
}






export function slideStaysOnDeck(f: Readonly<Fighter>, stage: number, matchFrame: number): boolean {
  const { x, vx, surface } = f.motion;
  const rest = restingX(x, vx, floorTraction(f.tuning.physics.traction, floorFriction(stage, f.motion)));
  if (surface === undefined || surface === 0) return rest >= safeLeft(stage) && rest <= safeRight(stage);
  return rest >= surfaceLeft(stage, surface, matchFrame) && rest <= surfaceRight(stage, surface, matchFrame);
}

const towardGoal = (stage: number, goal: number) => Math.min(safeRight(stage), Math.max(safeLeft(stage), goal));






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







export function heightAhead(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): number {
  const { z, deltaZ, surface } = f.motion;
  if (f.motion.grounded) {

    if (deltaZ !== 0.0 && stage >= 0 && surface !== undefined && !surfaceMoves(stage, surface) && surfaceLine(stage, surface) === undefined) return z;
    return f32(z + f32(deltaZ * frames));
  }
  const { gravity, terminalSpeed } = f.tuning.physics;
  const floor = Math.min(deltaZ, -terminalSpeed);

  const slowing = Math.min(frames, Math.max(0, Math.floor(f32(f32(deltaZ - floor) / gravity))));
  const curve = f32(f32(deltaZ * slowing) - f32(gravity * ((slowing * (slowing + 1)) / 2)));
  const ahead = f32(z + f32(curve + f32(floor * (frames - slowing))));
  const deck = deckUnder(stage, matchFrame, f.motion.x, z);
  return deck !== undefined && ahead < deck ? deck : ahead;
}






const lastLanding = { z: 0.0, deltaZ: 0.0, gravity: 0.0, terminalSpeed: 0.0, deckZ: 0.0, searched: 0, landing: 0 };


function landingFrame(f: Readonly<Fighter>, frames: number, deckZ: number, matchFrame: number): number {
  const { z, deltaZ } = f.motion;
  const { gravity, terminalSpeed } = f.tuning.physics;
  const memo = lastLanding;
  if (memo.z !== z || memo.deltaZ !== deltaZ || memo.gravity !== gravity || memo.terminalSpeed !== terminalSpeed || memo.deckZ !== deckZ) {
    memo.z = z;
    memo.deltaZ = deltaZ;
    memo.gravity = gravity;
    memo.terminalSpeed = terminalSpeed;
    memo.deckZ = deckZ;
    memo.searched = 0;
    memo.landing = 0;
  }
  if (memo.landing > 0) return memo.landing <= frames ? memo.landing : frames + 1;
  let landing = memo.searched + 1;
  while (landing <= frames && heightAhead(f, landing, -1, matchFrame) > deckZ) landing++;
  if (landing <= frames) memo.landing = landing;
  else memo.searched = frames;
  return landing;
}







export function horizontalAhead(f: Readonly<Fighter>, frames: number, stage: number, matchFrame: number): number {
  const { x, z, deltaX } = f.motion;
  const straight = f32(x + f32(deltaX * frames));
  if (f.motion.grounded || stage < 0 || deltaX === 0.0) return straight;
  const deck = deckIndexUnder(stage, matchFrame, x, z);
  if (deck < 0) return straight;
  const deckZ = surfaceZAt(stage, deck, matchFrame, x);
  const landing = landingFrame(f, frames, deckZ, matchFrame);
  if (landing > frames) return straight;
  const traction = floorTraction(f.tuning.physics.traction, floorFriction(stage, { grounded: true, surface: deck }));
  const speed = Math.abs(deltaX);
  const braking = Math.min(frames - landing, Math.floor(f32(speed / traction)));
  const slide = f32(f32(speed * braking) - f32(traction * ((braking * (braking + 1)) / 2)));
  const landed = f32(x + f32(deltaX * landing));
  const rest = deltaX < 0 ? f32(landed - slide) : f32(landed + slide);
  return Math.max(surfaceLeft(stage, deck, matchFrame), Math.min(surfaceRight(stage, deck, matchFrame), rest));
}


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


export function deckUnder(stage: number, matchFrame: number, x: number, z: number): number | undefined {
  const index = deckIndexUnder(stage, matchFrame, x, z);
  return index < 0 ? undefined : surfaceZAt(stage, index, matchFrame, x);
}
