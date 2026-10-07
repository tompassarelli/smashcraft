// The computer's whiff punish: an opponent in a move's end lag, a missed
// grab, a whiffed special, a landing, a dropped shield, a dodge's end, or
// asleep or stunned (a status that blocks every action) can't
// act for a number of frames its own counters already hold. The computer reads
// that window, takes its gameplan spacing tool, or else its fastest ground move,
// whose first active frame lands inside it, running in first when the gap needs
// it, and commits. A level recognizes only a share of windows and may misjudge
// their length.
import { at } from "wisp/src/runtime/lookup";
import { hurtCapsule } from "../physics/contactGeometry";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, DownState, GrabAction, LedgeState } from "../sim/codes";
import { GROUND_ROLL_FRAMES, SPOT_DODGE_FRAMES, SPOT_DODGE_INTANGIBLE_END, canAttack, canShieldGrab, isIntangible } from "../sim/conditions";
import { heroStatusBlocksActions } from "../sim/heroStatus";
import type { Fighter } from "../sim/fighter";
import { heroSpecialEndFrame, runningHeroSpecial } from "../sim/heroSpecialRules";
import { attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { SHIELD_RELEASE_LAG_FRAMES } from "../sim/shield";
import type { FighterGameplan } from "../sim/gameplan";
import { safeAt, slideStaysOnDeck } from "./botFooting";
import { gameplanOf, passiveLandingMove } from "./botGameplan";
import { passivePips, passiveSpec } from "../sim/passives";
import { aheadX, aheadZ, moveReachAhead, moveReaches } from "./botMoves";
import { botChance } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

/** What holds the opponent: the committal states a punish answers. */
export const PunishKind = { none: 0, endLag: 1, grab: 2, special: 3, landing: 4, shieldDrop: 5, dodge: 6, status: 7 } as const;
export type PunishKind = (typeof PunishKind)[keyof typeof PunishKind];

/** A roll is intangible through this frame (conditions.ts). */
const GROUND_ROLL_INTANGIBLE_END = 19;
/** A target this far above or below is out of a ground punish. */
const PUNISH_HEIGHT = 40.0;
/** The press reaches the simulation a frame after it is made. */
const INPUT_FRAMES = 1;
/** A target in a window and a dash this long from reach is worth running at. */
const RUN_FAR = 420.0;

/** The open window: frames until the opponent can act, what holds it, frames it has held, and the key its recognition is drawn on. */
export interface PunishWindow {
  frames: number;
  kind: PunishKind;
  elapsed: number;
  key: number;
}

// Preallocated: the window each decision reads.
const open: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0 };

/**
 * Frames left in a hero special that strikes and is past its strikes, with
 * nothing still to come (no shot, partner, guard, armor, grab or branch),
 * filling the frames since its last strike; 0 for any other.
 */
function specialSpent(t: Readonly<Fighter>, window: PunishWindow): number {
  const move = runningHeroSpecial(t);
  if (move === undefined || move.projectiles !== undefined || move.followUps !== undefined || move.guard !== undefined || move.armor !== undefined
    || move.command !== undefined || move.placement !== undefined || move.commandGrab !== undefined || move.burst !== undefined) return 0;
  let last = -1;
  for (const region of move.regions ?? []) last = Math.max(last, region.lastFrame);
  if (last < 0 || t.special.frame <= last + 1) return 0;
  if (move.intangible !== undefined && move.intangible.last >= t.special.frame) return 0;
  window.elapsed = t.special.frame - last - 1;
  return heroSpecialEndFrame(t, move) - t.special.frame;
}

/**
 * Fills the window the target is in, from the simulation's frame data, and
 * says whether there is one: a grounded target that can't act for a number of
 * frames the counters already hold. A hit, a grab, a knockdown or the ledge is
 * not a punish window.
 */
export function punishWindow(t: Readonly<Fighter>, frame: number, window: PunishWindow = open): boolean {
  window.kind = PunishKind.none;
  window.frames = 0;
  if (t.status.out || !t.motion.grounded || t.launch.hitlag > 0 || t.launch.hitstun > 0 || t.status.frozenFrames > 0
    || t.down.state !== DownState.none || t.grab.owner !== undefined || t.grab.target !== undefined || t.grab.action !== GrabAction.none
    || t.ledge.state !== LedgeState.none || t.shield.raised || t.shield.stun > 0) return false;
  const { attack } = t;
  if (heroStatusBlocksActions(t)) {
    // Asleep or stunned: the frames left unless it mashes out sooner. It shows from its first frame.
    window.kind = PunishKind.status;
    window.frames = t.status.conditionFrames;
    window.elapsed = 255;
    window.key = floorDiv(frame, 32) * 8 + PunishKind.status;
  } else if (t.landing.lag > 0) {
    window.kind = PunishKind.landing;
    window.frames = t.landing.lag;
    // A landing shows from its first frame; its length is what a level misjudges.
    window.elapsed = 255;
    window.key = attack.serial * 8 + PunishKind.landing;
  } else if (attack.style !== undefined && attack.cooldown > 0) {
    const done = attackStartupFrames(attack.style, t.tuning.moves) + characterAttackActiveFrames(t.character, attack.style, t.tuning.moves);
    if (attack.frame < done) return false;
    window.kind = attack.style === AttackStyle.grab ? PunishKind.grab : PunishKind.endLag;
    window.frames = attack.cooldown;
    window.elapsed = attack.frame - done;
    window.key = attack.serial * 8 + window.kind;
  } else if (t.special.lockFrames > 0 || t.attack.cooldown > 0) {
    const left = specialSpent(t, window);
    if (left <= 0) return false;
    window.kind = PunishKind.special;
    window.frames = Math.max(left, t.special.lockFrames, t.attack.cooldown);
    window.key = attack.serial * 8 + PunishKind.special + t.special.action * 1024;
  } else if (t.shield.releaseLag > 0) {
    window.kind = PunishKind.shieldDrop;
    window.frames = t.shield.releaseLag;
    window.elapsed = SHIELD_RELEASE_LAG_FRAMES - t.shield.releaseLag;
    window.key = floorDiv(frame, 32) * 8 + PunishKind.shieldDrop;
  } else if (t.dodge.groundFrame > 0) {
    const spot = t.dodge.groundDirection === 0;
    const end = spot ? SPOT_DODGE_INTANGIBLE_END : GROUND_ROLL_INTANGIBLE_END;
    if (t.dodge.groundFrame <= end || isIntangible(t)) return false;
    window.kind = PunishKind.dodge;
    window.frames = (spot ? SPOT_DODGE_FRAMES : GROUND_ROLL_FRAMES) + 1 - t.dodge.groundFrame;
    window.elapsed = t.dodge.groundFrame - end;
    window.key = floorDiv(frame, 32) * 8 + PunishKind.dodge;
  } else return false;
  return window.frames > 0;
}

const PUNISH_MOVES = [
  AttackStyle.jab, AttackStyle.downTilt, AttackStyle.upTilt, AttackStyle.forwardTilt, AttackStyle.grab,
  AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.forwardSmash,
] as const;

/** The style a ground move comes out as from a run: a jab is the kit's dash attack. */
function runningStyle(f: Readonly<Fighter>, move: AttackStyle): AttackStyle {
  const dashes = f.character === Character.demonHunter || f.tuning.moves !== undefined;
  return dashes && move === AttackStyle.jab ? f.tuning.moves?.dashAttack ?? AttackStyle.demonHunterDashAttack : move;
}

/**
 * A grab catches a narrower body than a strike strikes (sim/attacks.ts), and a
 * missed grab is itself punished: it is thrown only at a target whose
 * position, not just its body's edge, lies within the grab's reach.
 */
function grabSure(f: Readonly<Fighter>, style: AttackStyle, target: Readonly<Fighter>, x: number): boolean {
  return style !== AttackStyle.grab || x <= f32(moveReachAhead(f.character, style, target, f.tuning.moves) - hurtCapsule(target.character).radius);
}

/** Whether the gameplan names `move` among its spacing tools. */
function spacingTool(plan: Readonly<FighterGameplan>, move: AttackStyle): boolean {
  for (let index = 0; index < plan.spacing.length; index++) if (at(plan.spacing, index).move === move) return true;
  return false;
}


/**
 * Punishes the target's open window: the fighter's gameplan spacing tool, or
 * else its fastest move, that reaches it before it can act, or a run in when a move would reach after it. True when that
 * took this frame's input. Ground only; a shield lets go only for a grab.
 */
export function choosePunish(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, skill: CpuSkill, input: Controls, commands: AttackBuffer): boolean {
  if (skill.punishTenths <= 0 || !f.motion.grounded) return false;
  const shielding = f.shield.raised;
  if (shielding ? !canShieldGrab(f) : !canAttack(f)) return false;
  if (!punishWindow(target, frame)) return false;
  if (open.elapsed < skill.reactionFrames) return false;
  if (!botChance(open.key, f.character * 29 + 7, skill.punishTenths, 10)) return false;
  if (Math.abs(f32(target.motion.z - f.motion.z)) > PUNISH_HEIGHT) return false;
  // The frames it believes it has; a misjudged window throws a move that comes out too late.
  const believed = open.frames + skill.punishMisjudge - INPUT_FRAMES;
  if (!slideStaysOnDeck(f, stage, matchFrame)) return false;
  const moves = f.tuning.moves;
  const plan = skill.gameplanWeights ? gameplanOf(f.character) : undefined;
  let best: AttackStyle | undefined;
  let bestStartup = 0;
  let bestTool = false;
  let bestPassive = false;
  const cashing = plan !== undefined && !target.shield.raised && passivePips(f).ready
    && botChance(open.key, f.character * 13 + 3, skill.kitTenths, 10);
  let runFits = false;
  const speed = Math.max(Math.abs(f.motion.vx), f.tuning.physics.dashSpeed);
  const running = f.ground.dashFrame > 0;
  for (let index = 0; index < PUNISH_MOVES.length; index++) {
    const move = at(PUNISH_MOVES, index);
    if (shielding && move !== AttackStyle.grab) continue;
    const style = running ? runningStyle(f, move) : move;
    const startup = attackStartupFrames(style, moves);
    // A gameplan's spacing tool that arrives in time is its punish; otherwise the fastest move that does.
    const tool = plan !== undefined && spacingTool(plan, style === move ? move : AttackStyle.dashAttack);
    const passive = cashing && plan !== undefined && passiveLandingMove(plan, passiveSpec(f.character).kind, style === move ? move : AttackStyle.dashAttack);
    const better = best === undefined || (passive && !bestPassive) || (passive === bestPassive && ((tool && !bestTool) || (tool === bestTool && startup < bestStartup)));
    const x = Math.abs(aheadX(f, target, startup, style));
    if (startup <= believed && better && moveReaches(f.character, style, target, x, aheadZ(f, target, startup, stage, matchFrame), moves) && grabSure(f, style, target, x)) {
      best = move;
      bestStartup = startup;
      bestTool = tool;
      bestPassive = passive;
    }
    // Out of reach: a run closes the rest at dash speed, then the move (a jab as the dash attack) comes out.
    if (shielding || runFits) continue;
    const ran = runningStyle(f, move);
    const ranStartup = attackStartupFrames(ran, moves);
    const short = f32(Math.abs(aheadX(f, target, ranStartup)) - moveReachAhead(f.character, ran, target, moves));
    if (short > 0 && short <= RUN_FAR && Math.ceil(f32(short / speed)) + ranStartup <= believed) runFits = true;
  }
  const dx = f32(target.motion.x - f.motion.x);
  const toward = dx === 0 ? (f.facing < 0 ? -1 : 1) : dx > 0 ? 1 : -1;
  if (best !== undefined) {
    queueAttack(commands, { style: best, facing: toward, frame, mayCharge: false });
    input.attackHeld = false;
    input.shield = false;
    return true;
  }
  if (!runFits || !safeAt(stage, target.motion.x, 0.0)) return false;
  input.walking = false;
  input.direction = toward;
  return true;
}
