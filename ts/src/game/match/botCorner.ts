// Corner play (#386, smashcraft:docs/gameplay-design.md, "The corner belongs
// to the attacker"): at Advanced and Expert the computer carries an aerial's
// landing off the lip the opponent is cornered at, so the edge cancel frees it
// at once; it presses a cornered opponent instead of resetting to neutral; and
// cornered itself, it leaves by a readable option.
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, DownState, LedgeState } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import type { Controls } from "../sim/roster";
import { floorFriction, floorTraction, mainDeckLeft, mainDeckRight } from "../sim/stage";
import { heightAhead } from "./botFooting";
import { botChance, botChoice } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

/** The outer stage band: this close to a lip a fighter is cornered. */
export const CORNER_BAND = 150.0;
/** An opponent this far past the lip is still at its ledge. */
const PAST_LIP = 200.0;
/** An aerial descending this close to the lip can be carried off it. */
const CANCEL_REACH = 200.0;
/** Frames each escape choice holds before the computer weighs another. */
const ESCAPE_FRAMES = 30;
/** An opponent this close on the centre side closes the corner. */
const CLOSING = 320.0;
const EARLY_CLOSING = 480.0;

/** Distance inside the nearer lip of the main deck; negative past it. */
export function insideLip(stage: number, x: number): number {
  return x < 0.0 ? f32(x - mainDeckLeft(stage)) : f32(mainDeckRight(stage) - x);
}

const lipSide = (x: number): -1 | 1 => (x < 0.0 ? -1 : 1);

/** Whether `f` stands in the outer band with `other` between it and the centre. */
export function cornered(f: Readonly<Fighter>, other: Readonly<Fighter>, stage: number): boolean {
  const inside = insideLip(stage, f.motion.x);
  return inside >= 0.0 && inside <= CORNER_BAND && lipSide(other.motion.x) === lipSide(f.motion.x) && insideLip(stage, other.motion.x) > inside;
}

/** How far past a cornered opponent an attacker's carry may land. */
const OVERSHOOT = 80.0;

/** Whether `target` shields at `f`'s lip with `f` attacking it from the centre side or overshooting it. */
const atLedge = (f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number): boolean => {
  const inside = insideLip(stage, target.motion.x);
  if (inside > CORNER_BAND || inside < -PAST_LIP || lipSide(target.motion.x) !== lipSide(f.motion.x) || inside >= f32(insideLip(stage, f.motion.x) + OVERSHOOT)) return false;
  // Against an opponent standing or hit on the stage it never runs off (#56): the carry is for a shield.
  return target.shield.raised || target.shield.stun > 0;
};

/**
 * Steers an aerial near the lip the opponent is at so it lands just inside
 * with speed outward: the landing slides off and the edge cancel ends its lag.
 */
export function steerEdgeCancel(f: Fighter, target: Readonly<Fighter> | undefined, stage: number, skill: CpuSkill, input: Controls): boolean {
  if (skill.edgeCancelTenths <= 0 || target === undefined || target.status.out) return false;
  if (f.launch.hitstun > 0 || f.special.fall || f.down.state !== DownState.none || f.ledge.state !== LedgeState.none || f.grab.target !== undefined) return false;
  const side = lipSide(f.motion.x);
  const inside = insideLip(stage, f.motion.x);
  if (inside < 0.0 || inside > CANCEL_REACH) return false;
  if (f.motion.grounded || (f.attack.style === undefined && inside > CARRY_REACH)) return false;
  // Away from a cornered opponent it carries only a fall already drifting out, with a jump left to return
  // on: some once they fall, or at every chance (Expert) each from the hop's rise.
  if (!atLedge(f, target, stage) && (f.jump.remaining <= 0 || f32(f.motion.vx * side) <= 0.0
    || (f.motion.vz > 0.0 && skill.edgeCancelTenths < 10) || !botChance(f.attack.serial, f.character * 7 + side, skill.edgeCancelTenths, 10))) return false;
  // Aim the landing just inside the lip: the slide carries it off before the lag ends.
  const out = f32(f.motion.vx * side);
  const landing = f32(inside - f32(out * landingFrames(f)));
  const traction = floorTraction(f.tuning.physics.traction, floorFriction(stage, MAIN_DECK));
  const rest = f32(Math.max(landing, LAND_SNAP) - f32(f32(f32(out * out) / f32(2.0 * traction)) - f32(out * 0.5)));
  input.direction = landing < LAND_NEAR ? -side : rest > LAND_PAST ? side : 0;
  return true;
}

/** A carry lands at least this far inside the lip, and its slide comes to rest this far past it. */
const LAND_NEAR = -6.0;
const LAND_PAST = -4.0;
/** A landing at the lip settles the body about this far inside it. */
const LAND_SNAP = 8.0;
const MAIN_DECK = { grounded: true, surface: 0 } as const;
const LANDING_SEARCH = 40;

/** Frames until a fall reaches the main deck's height. */
function landingFrames(f: Readonly<Fighter>): number {
  let frames = 1;
  while (frames < LANDING_SEARCH && heightAhead(f, frames, -1, 0) > 0.0) frames++;
  return frames;
}

/** Frames each carry choice holds: a short hop out at the lip the opponent is cornered at. */
const CARRY_FRAMES = 24;
/** A carry starts no closer to the lip than this, so the hop lands on the deck. */
const CARRY_INSIDE = 30.0;
/** A short hop's drift carries its landing off the lip from no farther than this. */
const CARRY_REACH = 110.0;

/**
 * At the lip the opponent is cornered at, short-hops an aerial out toward
 * them: the landing slides off and the edge cancel frees the computer, which
 * the steering above keeps carrying (the shield-overshoot mixup).
 */
export function pressEdgeCancel(f: Fighter, target: Readonly<Fighter>, stage: number, skill: CpuSkill, slot: number, frame: number, input: Controls, commands: AttackBuffer): boolean {
  if (skill.edgeCancelTenths <= 0 || target.status.out || !atLedge(f, target, stage) || f.launch.hitstun > 0 || f.special.fall) return false;
  const side = lipSide(f.motion.x);
  const inside = insideLip(stage, f.motion.x);
  if (inside < CARRY_INSIDE || inside > CANCEL_REACH) return false;
  if (f.motion.grounded) {
    // A hop starts only with the opponent between it and the lip.
    if (insideLip(stage, target.motion.x) >= inside) return false;
    if (f.motion.surface !== 0 || !canAttack(f) || f.shield.raised || f.jump.squat > 0) return false;
    if (!botChance(floorDiv(frame, CARRY_FRAMES), slot * 19 + f.character, skill.edgeCancelTenths, 10)) return false;
    // Farther out it dashes in first, so the hop carries the dash's speed.
    if (inside > CARRY_REACH || f32(f.motion.vx * side) < 0.0) {
      input.direction = side;
      input.walking = false;
      return true;
    }
    input.jumpPressed = true;
    input.jumpHeld = false;
    input.direction = side;
    return true;
  }
  if (f.attack.style !== undefined || f.motion.vz > CARRY_PRESS_RISE || inside > CARRY_REACH) return false;
  // Facing out it is a forward air; facing the stage, a back air: both drift out.
  queueAttack(commands, { style: AttackStyle.forwardTilt, facing: side, frame, mayCharge: false });
  input.direction = side;
  return true;
}

/** An aerial is pressed once the hop has slowed to this rise. */
const CARRY_PRESS_RISE = 8.0;
/** Pokes keep this gap from a cornered opponent. */
const POKE_GAP = 70.0;

/** Presses a cornered opponent from the main deck: walks to poke range on the centre side instead of idling or keeping away. */
export function pressCorner(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill): boolean {
  return skill.cornerPlay && f.motion.grounded && f.motion.surface === 0 && !target.status.out && cornered(target, f, stage);
}

export function pokeGoal(target: Readonly<Fighter>): number {
  return f32(target.motion.x - f32(lipSide(target.motion.x) * POKE_GAP));
}

const EscapeOption = { jump: 0, roll: 1, shield: 2 } as const;
type EscapeOption = (typeof EscapeOption)[keyof typeof EscapeOption];

function escapeOption(f: Readonly<Fighter>, skill: CpuSkill, slot: number, frame: number): EscapeOption {
  const choice = botChoice(floorDiv(frame, ESCAPE_FRAMES), slot * 31 + f.character, 10);
  return choice < floorDiv(skill.cornerEscapeTenths, 2) ? EscapeOption.jump : choice < skill.cornerEscapeTenths ? EscapeOption.roll : EscapeOption.shield;
}

/**
 * Cornered with the opponent closing on the centre side, it leaves by one
 * readable option held for a while: a full hop out over them, a roll in, or a
 * shield whose punish botPunish.ts answers.
 */
export function escapeCorner(f: Fighter, target: Readonly<Fighter>, stage: number, skill: CpuSkill, slot: number, frame: number, input: Controls): boolean {
  if (!skill.cornerPlay || target.status.out || f.launch.hitstun > 0 || f.special.fall || f.down.state !== DownState.none) return false;
  const side = lipSide(f.motion.x);
  const gap = Math.abs(f32(target.motion.x - f.motion.x));
  // Every escape (Expert) starts before the opponent closes in: a wider gap still counts as closing.
  if (gap > (skill.cornerEscapeTenths >= 10 ? EARLY_CLOSING : CLOSING)) return false;
  if (!f.motion.grounded) {
    // A hop out keeps drifting to the centre while it rises over the opponent.
    const inside = insideLip(stage, f.motion.x);
    if (inside < 0.0 || inside > CORNER_BAND + POKE_GAP || f.motion.vz <= 0.0 || escapeOption(f, skill, slot, frame) !== EscapeOption.jump) return false;
    input.direction = -side;
    return true;
  }
  if (!cornered(f, target, stage) || f.motion.surface !== 0 || !canAttack(f)) return false;
  switch (escapeOption(f, skill, slot, frame)) {
    case EscapeOption.jump:
      input.jumpPressed = true;
      input.jumpHeld = true;
      input.direction = -side;
      return true;
    case EscapeOption.roll:
      input.shield = true;
      input.groundDodgePressed = true;
      input.groundDodgeDirection = -side;
      return true;
    case EscapeOption.shield:
      input.shield = true;
      return true;
  }
}
