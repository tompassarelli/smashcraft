// The computer's defense: it sees an attack, a special or a projectile about
// to reach its fighter and, by a choice fixed for that attack, shields, spot
// dodges, rolls away, parries with Illidan's Parry Step, or takes it.
import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP } from "../sim/specials";
import { safeAt } from "./botFooting";
import { botChoice, moveReaches } from "./botMoves";

/** A shield this weak is let go rather than broken. */
const SHIELD_RESERVE = 20.0;
/** Frames ahead the computer sees a strike coming. */
const STRIKE_LOOKAHEAD = 12;
/** A projectile this close, coming level, is something to block. */
const SHOT_SIGHT = 260.0;
/** Illidan's Parry Step parries strikes landing on its frames 4 to 9 (sim/hits.ts). */
const PARRY_FIRST = 4;
const PARRY_LAST = 9;
/** Illidan's Parry Step carries him about this far toward the target. */
const PARRY_ROOM = 100.0;
/** A shield's pushback can carry the defender about this far. */
const PUSHBACK_ROOM = 60.0;

const Response = { none: 0, shield: 1, spotDodge: 2, roll: 3, parry: 4 } as const;
type Response = (typeof Response)[keyof typeof Response];

/** Frames until the target's current strike reaches f, or undefined when it won't. */
function strikeComing(f: Readonly<Fighter>, target: Readonly<Fighter>): number | undefined {
  const style = target.attack.style;
  if (style === undefined || style === AttackStyle.shot || style === AttackStyle.grab) return undefined;
  const startup = attackStartupFrames(style, target.tuning.moves);
  const { frame } = target.attack;
  if (frame >= startup + characterAttackActiveFrames(target.character, style, target.tuning.moves)) return undefined;
  const frames = Math.max(0, startup - frame);
  if (frames > STRIKE_LOOKAHEAD) return undefined;
  const x = f32(f32(f.motion.x - target.motion.x) + f32(f32(f.motion.deltaX - target.motion.deltaX) * frames));
  const z = f32(f32(f.motion.z - target.motion.z) + f32(f32(f.motion.deltaZ - target.motion.deltaZ) * frames));
  return moveReaches(target.character, style, f, f32(x * target.facing), z, target.tuning.moves) ? frames : undefined;
}

// Preallocated: the threat each frame's defense weighs, with the frames until it arrives (-1 when unknown).
const threat = { serial: 0, arrival: -1.0 };

/** Finds a strike, a projectile flying at f, Immolation or the bear close by; false for none. */
function findThreat(f: Readonly<Fighter>, target: Readonly<Fighter>): boolean {
  const strikeFrames = strikeComing(f, target);
  if (strikeFrames !== undefined) {
    threat.serial = target.attack.serial;
    threat.arrival = strikeFrames;
    return true;
  }
  const { x, z } = f.motion;
  for (const projectile of target.projectiles) {
    if (projectile.life <= 0) continue;
    const ahead = f32(f32(x - projectile.x) * projectile.direction);
    const speed = Math.abs(projectile.velocityX);
    if (ahead < 0 || ahead > SHOT_SIGHT || Math.abs(f32(f32(z + 45.0) - projectile.z)) > 80) continue;
    threat.serial = projectile.serial;
    threat.arrival = speed > 0 ? f32(ahead / speed) : -1.0;
    return true;
  }
  threat.arrival = -1.0;
  const immolating = target.special.action === SpecialAction.demonHunterImmolate && target.special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE;
  if (immolating && Math.abs(f32(x - target.motion.x)) <= 160 && Math.abs(f32(z - target.motion.z)) <= 170) {
    threat.serial = target.attack.serial;
    return true;
  }
  const { bear } = target;
  if (bear.life > 0 && Math.abs(f32(x - bear.x)) <= 110 && Math.abs(f32(z - bear.z)) <= 100) {
    threat.serial = bear.hitSerial;
    return true;
  }
  return false;
}

function respond(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number): Response {
  const choice = botChoice(threat.serial, f.visuals.hit * 5 + f.character, 10);
  const away = f.motion.x < target.motion.x ? -1 : 1;
  // A shield pushed back at the edge can slide off it: dodge there instead.
  const cornered = !safeAt(stage, f32(f.motion.x + f32(away * PUSHBACK_ROOM)), 0.0);
  if (choice >= 7) return Response.none;
  const parries = threat.arrival >= PARRY_FIRST && threat.arrival <= PARRY_LAST && safeAt(stage, f32(f.motion.x - f32(away * PARRY_ROOM)), 0.0);
  if (f.character === Character.demonHunter && choice >= 4 && parries) return Response.parry;
  if (choice === 5) return cornered ? Response.spotDodge : Response.roll;
  if (choice === 4 || cornered) return Response.spotDodge;
  return Response.shield;
}

/**
 * Defends a grounded fighter against what the target is about to land;
 * true when that took this frame's input. A shield is held while the threat
 * lasts, then dropped for the caller's next move.
 */
export function chooseDefense(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, input: Controls): boolean {
  if (!f.motion.grounded || target.status.out) return false;
  if (!findThreat(f, target)) return false;
  if (f.shield.raised) {
    input.shield = f.shield.energy > SHIELD_RESERVE;
    return input.shield;
  }
  if (!canAttack(f) || f.shield.energy <= SHIELD_RESERVE) return false;
  const away = f.motion.x < target.motion.x ? -1 : 1;
  switch (respond(f, target, stage)) {
    case Response.none:
      return false;
    case Response.parry:
      if (at(f.special.cooldowns, SpecialAction.demonHunterParryStep) > 0) return false;
      input.specialPressed = true;
      input.specialX = -away;
      return true;
    case Response.roll:
      input.shield = true;
      input.groundDodgePressed = true;
      input.groundDodgeDirection = away;
      return true;
    case Response.spotDodge:
      input.shield = true;
      input.groundDodgePressed = true;
      input.groundDodgeDirection = 0;
      return true;
    case Response.shield:
      input.shield = true;
      return true;
  }
}
