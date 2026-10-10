







import { at } from "wisp/src/runtime/lookup";
import { hurtCapsule } from "../physics/contactGeometry";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, DownState, GrabAction, LedgeState } from "../sim/codes";
import { GROUND_ROLL_FRAMES, SPOT_DODGE_FRAMES, SPOT_DODGE_INTANGIBLE_END, TECH_INTANGIBLE_FRAMES, TECH_ROLL_INTANGIBLE_FRAMES, canAttack, canShieldGrab, isIntangible } from "../sim/conditions";
import { DOWN_BOUND_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../sim/down";
import { heroStatusBlocksActions } from "../sim/heroStatus";
import type { Fighter } from "../sim/fighter";
import { heroSpecialEndFrame, runningHeroSpecial } from "../sim/heroSpecialRules";
import { attackLandingLag, attackStartupFrames, characterAttackActiveFrames, landsIntoAttack } from "../sim/moves";
import type { Controls } from "../sim/roster";
import { SHIELD_RELEASE_LAG_FRAMES } from "../sim/shield";
import type { FighterGameplan } from "../sim/gameplan";
import { deckUnder, heightAhead, safeAt, slideStaysOnDeck } from "./botFooting";
import { gameplanOf } from "./botGameplan";
import { aheadX, aheadZ, moveReachAhead, moveReaches } from "./botMoves";
import { botChance } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";


export const PunishKind = { none: 0, endLag: 1, grab: 2, special: 3, landing: 4, shieldDrop: 5, dodge: 6, status: 7, knockdown: 8 } as const;
export type PunishKind = (typeof PunishKind)[keyof typeof PunishKind];


const GROUND_ROLL_INTANGIBLE_END = 19;

const PUNISH_HEIGHT = 40.0;

const INPUT_FRAMES = 1;

const RUN_FAR = 420.0;


export interface PunishWindow {
  frames: number;
  kind: PunishKind;
  elapsed: number;
  key: number;
  earliest?: number;
}


const open: PunishWindow = { frames: 0, kind: PunishKind.none, elapsed: 0, key: 0, earliest: 0 };


function knockdownWindow(t: Readonly<Fighter>, frame: number, age: number, window: PunishWindow): boolean {
  const { down } = t;
  const tech = down.state === DownState.tech;
  const roll = down.state === DownState.techRoll;
  if (!t.motion.grounded || t.launch.hitstun > 0 || (!tech && !roll && down.state !== DownState.bound)) return false;
  const total = tech ? TECH_IN_PLACE_FRAMES : roll ? TECH_ROLL_FRAMES : DOWN_BOUND_FRAMES;
  const intangible = tech ? TECH_INTANGIBLE_FRAMES : roll ? TECH_ROLL_INTANGIBLE_FRAMES : 0;
  const at = down.frame + age;
  window.kind = PunishKind.knockdown;
  window.elapsed = at;
  window.frames = total - at;
  window.earliest = Math.max(0, intangible - at);
  window.key = (frame - down.frame) * 16 + PunishKind.knockdown;
  return window.frames > 0;
}






function specialSpent(t: Readonly<Fighter>, window: PunishWindow, observationAge: number): number {
  const move = runningHeroSpecial(t);
  if (move === undefined || move.projectiles !== undefined || move.followUps !== undefined || move.guard !== undefined || move.armor !== undefined
    || move.command !== undefined || move.placement !== undefined || move.commandGrab !== undefined || move.burst !== undefined) return 0;
  let last = -1;
  for (const region of move.regions ?? []) last = Math.max(last, region.lastFrame);
  const frame = t.special.frame + observationAge;
  if (last < 0 || frame <= last + 1) return 0;
  if (move.intangible !== undefined && move.intangible.last >= frame) return 0;
  window.elapsed = frame - last - 1;
  return heroSpecialEndFrame(t, move) - t.special.frame;
}


function landingWindow(t: Readonly<Fighter>, stage: number, matchFrame: number, age: number, window: PunishWindow): boolean {
  if (age <= 0 || t.motion.deltaZ >= 0.0 || t.launch.hitlag > 0) return false;
  const move = runningHeroSpecial(t);
  const lag = move?.landingLag ?? attackLandingLag(t.attack.style, t.tuning.moves);
  if (lag <= 0) return false;
  const deck = deckUnder(stage, matchFrame, t.motion.x, t.motion.z);
  if (deck === undefined || heightAhead(t, age, stage, matchFrame) > deck) return false;
  let first = 1;
  let last = age;
  while (first < last) {
    const middle = floorDiv(first + last, 2);
    if (heightAhead(t, middle, stage, matchFrame) <= deck) last = middle;
    else first = middle + 1;
  }
  if (move === undefined) {
    if (t.attack.frame + first >= t.attack.duration || landsIntoAttack(t.attack.style, t.attack.frame + first, t.tuning.moves)) return false;
  } else if (t.special.frame + first >= heroSpecialEndFrame(t, move)) return false;
  window.kind = PunishKind.landing;
  window.elapsed = age - first;
  window.frames = lag - window.elapsed;
  window.key = t.attack.serial * 8 + PunishKind.landing;
  return window.frames > 0;
}







export function punishWindow(t: Readonly<Fighter>, frame: number, window: PunishWindow = open, observationAge = 0, stage = -1, matchFrame = 0): boolean {
  window.kind = PunishKind.none;
  window.frames = 0;
  window.earliest = 0;
  if (!t.status.out && t.status.frozenFrames <= 0 && t.grab.owner === undefined && t.down.state !== DownState.none) {
    return knockdownWindow(t, frame, Math.max(0, observationAge - Math.max(0, t.launch.hitlag - 1)), window);
  }
  if (t.status.out || t.launch.hitlag > observationAge || t.launch.hitstun > 0 || t.status.frozenFrames > 0
    || t.down.state !== DownState.none || t.grab.owner !== undefined || t.grab.target !== undefined || t.grab.action !== GrabAction.none
    || t.ledge.state !== LedgeState.none || t.shield.raised || t.shield.stun > 0) return false;

  const age = Math.max(0, observationAge - Math.max(0, t.launch.hitlag - 1));
  if (!t.motion.grounded) return landingWindow(t, stage, matchFrame, age, window);
  const { attack } = t;
  if (heroStatusBlocksActions(t)) {

    window.kind = PunishKind.status;
    window.frames = t.status.conditionFrames;
    window.elapsed = 255;
    window.key = floorDiv(frame, 32) * 8 + PunishKind.status;
  } else if (t.landing.lag > 0) {
    window.kind = PunishKind.landing;
    window.frames = t.landing.lag;

    window.elapsed = 255;
    window.key = attack.serial * 8 + PunishKind.landing;
  } else if (attack.style !== undefined && attack.cooldown > 0) {
    const done = attackStartupFrames(attack.style, t.tuning.moves) + characterAttackActiveFrames(t.character, attack.style, t.tuning.moves);
    if (attack.frame + age < done) return false;
    window.kind = attack.style === AttackStyle.grab ? PunishKind.grab : PunishKind.endLag;
    window.frames = attack.cooldown;
    window.elapsed = attack.frame + age - done;
    window.key = attack.serial * 8 + window.kind;
  } else if (t.special.lockFrames > 0 || t.attack.cooldown > 0) {
    const left = specialSpent(t, window, age);
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
  window.frames -= age;
  return window.frames > 0;
}

const PUNISH_MOVES = [
  AttackStyle.jab, AttackStyle.downTilt, AttackStyle.upTilt, AttackStyle.forwardTilt, AttackStyle.grab,
  AttackStyle.upSmash, AttackStyle.downSmash, AttackStyle.forwardSmash,
] as const;


function runningStyle(f: Readonly<Fighter>, move: AttackStyle): AttackStyle {
  const dashes = f.character === Character.demonHunter || f.tuning.moves !== undefined;
  return dashes && move === AttackStyle.jab ? f.tuning.moves?.dashAttack ?? AttackStyle.demonHunterDashAttack : move;
}






function grabSure(f: Readonly<Fighter>, style: AttackStyle, target: Readonly<Fighter>, x: number): boolean {
  return style !== AttackStyle.grab || x <= f32(moveReachAhead(f.character, style, target, f.tuning.moves) - hurtCapsule(target.character).radius);
}


function spacingTool(plan: Readonly<FighterGameplan>, move: AttackStyle): boolean {
  for (let index = 0; index < plan.spacing.length; index++) if (at(plan.spacing, index).move === move) return true;
  return false;
}







export function choosePunish(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, matchFrame: number, frame: number, skill: CpuSkill, input: Controls, commands: AttackBuffer, observationAge = 0): boolean {
  if (skill.punishTenths <= 0 || !f.motion.grounded) return false;
  const shielding = f.shield.raised;
  if (shielding ? !canShieldGrab(f) : !canAttack(f)) return false;
  if (!punishWindow(target, frame, open, observationAge, stage, matchFrame)) return false;
  if (open.elapsed < skill.reactionFrames) return false;
  if (!botChance(open.key, f.character * 29 + 7, skill.punishTenths, 10)) return false;
  if (Math.abs(aheadZ(f, target, 0, stage, matchFrame, observationAge)) > PUNISH_HEIGHT) return false;

  const believed = open.frames + skill.punishMisjudge - INPUT_FRAMES;
  if (!slideStaysOnDeck(f, stage, matchFrame)) return false;
  const moves = f.tuning.moves;
  const plan = skill.gameplanWeights ? gameplanOf(f.character) : undefined;
  let best: AttackStyle | undefined;
  let bestStartup = 0;
  let bestTool = false;
  let runFits = false;
  const speed = Math.max(Math.abs(f.motion.vx), f.tuning.physics.dashSpeed);
  const running = f.ground.dashFrame > 0;
  for (let index = 0; index < PUNISH_MOVES.length; index++) {
    const move = at(PUNISH_MOVES, index);
    if (shielding && move !== AttackStyle.grab) continue;
    const style = running ? runningStyle(f, move) : move;
    const startup = attackStartupFrames(style, moves);

    const tool = plan !== undefined && spacingTool(plan, style === move ? move : AttackStyle.dashAttack);
    const better = best === undefined || (tool && !bestTool) || (tool === bestTool && startup < bestStartup);
    const x = Math.abs(aheadX(f, target, startup, style, observationAge, stage, matchFrame));
    if (startup <= believed && startup > (open.earliest ?? 0) && better && moveReaches(f.character, style, target, x, aheadZ(f, target, startup, stage, matchFrame, observationAge), moves) && grabSure(f, style, target, x)) {
      best = move;
      bestStartup = startup;
      bestTool = tool;
    }

    if (shielding || runFits) continue;
    const ran = runningStyle(f, move);
    const ranStartup = attackStartupFrames(ran, moves);
    const short = f32(Math.abs(aheadX(f, target, ranStartup, undefined, observationAge, stage, matchFrame)) - moveReachAhead(f.character, ran, target, moves));
    if (short > 0 && short <= RUN_FAR && Math.ceil(f32(short / speed)) + ranStartup <= believed) runFits = true;
  }
  const dx = aheadX(f, target, 0, undefined, observationAge, stage, matchFrame);
  const toward = dx === 0 ? (f.facing < 0 ? -1 : 1) : dx > 0 ? 1 : -1;
  if (best !== undefined) {
    queueAttack(commands, { style: best, facing: toward, frame, mayCharge: false });
    input.attackHeld = false;
    input.shield = false;
    return true;
  }
  if (!runFits || !safeAt(stage, f32(f.motion.x + dx), 0.0)) return false;
  input.walking = false;
  input.direction = toward;
  return true;
}
