// The computer's use of the kits' advanced options (#146): a Wind Walk that
// crosses up or feints, a Thunder Clap charged to full or dropped as bait,
// Mirror Image and its swap, a Storm Bolt recalled through the target, Shadow
// Pursuit onto a mark, a Frost Nova burst, Frost Armor and Dark Ritual for
// mana, the recoil shot's routes and second shot, Immolate cancelled by a
// jump, the glide, running behind Mana Burn, the short-hop blaster, the
// hippogryph's low line, leap-off and perch-dive. Hero options are read from
// the kit's data (sim/heroSpecials.ts), so a hero whose kit has the same
// shape gets the same play. Each option is taken in the level's kitTenths of
// the moments that suit it, drawn with botChoice from the match state.
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { toInt } from "../../runtime/numbers";
import { hurtCapsule } from "../physics/contactGeometry";
import { AttackStyle, Character, DownState, HeroStatusKind, PassiveKind, HippogryphKind, ProjectileKind, SpecialAction } from "../sim/codes";
import { canAttack } from "../sim/conditions";
import { type Fighter, placedObject } from "../sim/fighter";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import { EYE_BLAST_CHARGE_FRAMES, attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import { passivePips, passiveSpec } from "../sim/passives";
import { companionReady, isHeroSpecialAction, runningHeroSpecial, specialCooldownReady } from "../sim/heroSpecialRules";
import { heroStatusBlocksActions } from "../sim/heroStatus";
import { type AuthoredSpecial, type SpecialFollowUp, type SpecialProjectile, CompanionOrder, FOLLOW_UP_FORM, FollowUpInput, SpecialSlot, specialKit } from "../sim/heroSpecials";
import type { Controls } from "../sim/roster";
import { originalSpecialCost } from "../sim/mana";
import {
  ARCHER_RIDE_LEAP_FIRST, FEL_RUSH_BRANCH_FIRST, FEL_RUSH_BRANCH_LAST, FEL_RUSH_SPEED, FEL_RUSH_FIRST, FEL_RUSH_LAST, DEMONHUNTER_GLIDE_FIRST, DEMONHUNTER_GLIDE_FORM, DEMONHUNTER_IMMOLATE_ACTIVE, DEMONHUNTER_IMMOLATE_STARTUP, DEMONHUNTER_WING_DURATION,
  RIFLEMAN_RECOVERY_STARTUP_FRAMES, RIFLEMAN_SECOND_SHOT_FIRST, RIFLEMAN_SECOND_SHOT_FORM, RIFLEMAN_SECOND_SHOT_LAST,
} from "../sim/specials";
import { mainDeckLeft, mainDeckRight, mainDeckZ } from "../sim/stage";
import { safeAt, steerOnGround } from "./botFooting";
import { HeroSpecialUse, heroSpecialUse, startableForm, strikeMeets } from "./botHeroKit";
import { aheadX, moveReachAhead } from "./botMoves";
import { botChance, botChoice } from "./botRandom";
import type { CpuSkill } from "./cpuSkill";

/** A feint steps out of Wind Walk once the target is this close. */
const FEINT_GAP = 110.0;
/** The bait drops the charge by this frame of it when nothing took it. */
const BAIT_LATEST = 40;
/** Mirror Image is set at a target this far away, with this much room behind for the step back. */
const IMAGE_NEAR = 110.0;
const IMAGE_FAR = 330.0;
const IMAGE_ROOM = 160.0;
/** Frost Armor is cast with the target at least this far away and this much mana to spare past its cost. */
const ARMOR_GAP = 240.0;
const ARMOR_SPARE = 15;
/** A partner's bite reaches about this far past its lunge; it is called back past this share of its leash. */
const PARTNER_BITE_REACH = 60.0;
const PARTNER_STRAY = f32(0.2);
/** Dark Ritual is cashed for mana below this, the target this far away, or before the shell runs out. */
const RITUAL_MANA = 25;
const RITUAL_GAP = 200.0;
const RITUAL_LAST_FRAMES = 30;
/** Shadow Pursuit appears this far behind its mark (sim/heroSpecialRules.ts). */
const BEHIND_MARK_ROOM = 60.0;
/** Illidan runs this far behind his Mana Burn orb. */
const ORB_FOLLOW_GAP = 70.0;
/** The short-hop blaster's band, and the most height between shooter and target. */
const SHOT_NEAR = 180.0;
const SHOT_FAR = 620.0;
const SHOT_RISE = 70.0;
/** Returns: the level recoil route and the low ride from this far out, the route from no lower than LEVEL_BELOW under the deck, the ride from LEVEL_ABOVE over it. */
const LEVEL_REACH = 140.0;
const LEVEL_BELOW = 20.0;
const LEVEL_ABOVE = 40.0;
/** A glide toward a target at least this far ahead. */
const GLIDE_GAP = 180.0;
/** The glide's wing slash reaches about this far ahead. */
const SLASH_REACH = 90.0;
/** Fel Rush is started at a target this far ahead; Chaos Strike reaches about CHAOS_REACH. */
const RUSH_NEAR = 80.0;
const RUSH_FAR = 230.0;
const CHAOS_REACH = 110.0;

/** Eye Blast's beam reaches a target this far ahead (sim/hitRegions.ts): past the uncharged swing, inside the beam's end. */
const EYE_BLAST_NEAR = 240.0;
const EYE_BLAST_FAR = 600.0;
/** An anti-air jump meets a target this close and at most this high. */
const ANTI_AIR_GAP = 140.0;
const ANTI_AIR_RISE = 160.0;
/** A dash-in starts at a target this far ahead. */
const DASH_IN_FAR = 300.0;

/** Whether an original fighter can pay for a special now (sim/mana.ts): an unpaid press is refused. */
const affords = (f: Readonly<Fighter>, action: SpecialAction): boolean => originalSpecialCost(action) <= f.mana.points && specialCooldownReady(f, action);

/** The perched hippogryph's dive strikes a target this close to its path (sim/summons.ts). */
const DIVE_REACH_X = 60.0;
const DIVE_REACH_Z = 100.0;

const HERO_SLOTS = [SpecialSlot.neutral, SpecialSlot.side, SpecialSlot.up, SpecialSlot.down] as const;

/** Whether this moment takes the option: kitTenths in ten, drawn from two whole numbers. */
const takes = (skill: CpuSkill, first: number, second: number): boolean => botChance(first, second, skill.kitTenths, 10);

/** Constant while one special runs: spent mana, damage and the attack serial change only between actions or on a hit. */
const actionSeed = (f: Readonly<Fighter>): number => f.attack.serial * 37 + f.mana.points * 11 + toInt(f.status.damage);

const towardOf = (f: Readonly<Fighter>, x: number): number => (x === f.motion.x ? f.facing : x > f.motion.x ? 1 : -1);

function pressSlot(input: Controls, slot: SpecialSlot, side: number): void {
  input.specialPressed = true;
  input.specialX = slot === SpecialSlot.side ? side : 0;
  input.specialZ = slot === SpecialSlot.up ? 1 : slot === SpecialSlot.down ? -1 : 0;
  input.verticalDirection = input.specialZ;
  input.direction = side;
}

function branchBy(followUps: readonly SpecialFollowUp[], kind: FollowUpInput, strikes: boolean): SpecialFollowUp | undefined {
  for (const branch of followUps) {
    if ((branch.input ?? FollowUpInput.special) !== kind) continue;
    if (((branch.special.regions ?? []).length > 0) === strikes) return branch;
  }
  return undefined;
}

/** The special branch whose window opens last: the fullest charge. */
function fullestBranch(followUps: readonly SpecialFollowUp[]): SpecialFollowUp | undefined {
  let fullest: SpecialFollowUp | undefined;
  for (const branch of followUps) {
    if ((branch.input ?? FollowUpInput.special) !== FollowUpInput.special) continue;
    if (fullest === undefined || branch.window.first > fullest.window.first) fullest = branch;
  }
  return fullest;
}

/**
 * While a hero special with branches runs, the kit's advanced use of them:
 * a walk with an attack and a quiet special branch (Wind Walk) slashes back
 * after passing the target or steps out short of it; a charge with a shield
 * branch (Thunder Clap) holds to its fullest branch or drops as bait. True
 * when that took the frame, pressing or holding off the press.
 */
export function steerHeroBranches(f: Readonly<Fighter>, target: Readonly<Fighter>, skill: CpuSkill, input: Controls): boolean {
  if (!isHeroSpecialAction(f.special.action) || f.special.form >= FOLLOW_UP_FORM || f.launch.hitstun > 0) return false;
  const followUps = runningHeroSpecial(f)?.followUps;
  if (followUps === undefined) return false;
  const seed = actionSeed(f);
  if (!takes(skill, seed, f.character * 7 + 1)) return false;
  const next = f.special.frame + 1;
  const backstab = branchBy(followUps, FollowUpInput.attack, true);
  const stepOut = branchBy(followUps, FollowUpInput.special, false);
  if (backstab !== undefined && backstab.facesStick === true && stepOut !== undefined) {
    // In front (the general press), a cross-up or a feint.
    const mode = botChoice(seed, f.character * 7 + 2, 3);
    if (mode === 0 || next < backstab.window.first) return false;
    const ahead = f32(f32(target.motion.x - f.motion.x) * f.facing);
    if (mode === 1) return ahead >= 0.0 && next < backstab.window.last - 2;
    if (next >= stepOut.window.first && (Math.abs(ahead) <= FEINT_GAP || next >= stepOut.window.last - 4)) input.specialPressed = true;
    return true;
  }
  if (stepOut !== undefined && backstab === undefined) {
    // A lone quiet branch is taken when the target answers the approach, or as a planned feint.
    if (next < stepOut.window.first || next > stepOut.window.last) return false;
    const answered = target.attack.style !== undefined || !target.motion.grounded || target.shield.raised;
    const planned = botChoice(seed, f.character * 7 + 19, 3) === 0 && next >= stepOut.window.last - 2;
    if (!answered && !planned) return false;
    input.specialPressed = true;
    return true;
  }
  const hold = branchBy(followUps, FollowUpInput.shield, false);
  const fullest = fullestBranch(followUps);
  if (hold === undefined || fullest === undefined || next < hold.window.first || next > hold.window.last) return false;
  // The first branch (the general press), held to the fullest, or the bait.
  const mode = botChoice(seed, f.character * 7 + 3, 3);
  if (mode === 0) return false;
  if (mode === 1) return next < fullest.window.first;
  // The bait: a charge draws a shield or a jump; dropping it frees a grab or a shield of its own.
  if (target.shield.raised || !target.motion.grounded || next >= BAIT_LATEST) {
    input.shield = true;
    input.shieldPressed = true;
  }
  return true;
}

/** Own projectiles: the first live one of `spec`, or for undefined the first returning one still flying out. */
function ownProjectile(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined) {
  for (const projectile of f.projectiles) {
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || projectile.spec === undefined) continue;
    if (spec !== undefined) {
      if (projectile.spec === spec) return projectile;
      continue;
    }
    const returns = projectile.spec.returns;
    if (returns !== undefined && projectile.damageMultiplier === 1.0 && projectile.life > projectile.spec.life - returns.age) return projectile;
  }
  return undefined;
}

/** A kit recall form's use now: true when it pressed `slot`. */
function pressRecall(f: Readonly<Fighter>, target: Readonly<Fighter>, move: Readonly<AuthoredSpecial>, slot: SpecialSlot, skill: CpuSkill, frame: number, input: Controls): boolean {
  const body = hurtCapsule(target.character);
  const { motion } = target;
  for (const segment of move.motion ?? []) {
    if (segment.relocate === undefined) continue;
    // A swap onto the image strikes from the image, facing its way.
    const { placed } = f;
    if (placed.life <= 0 || !strikeMeets(move, target, f32(f32(motion.x - placed.x) * placed.direction), f32(motion.z - placed.z))) return false;
    if (!takes(skill, placed.serial, f.character * 7 + 4)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  if (move.recallsProjectiles === true) {
    // The returning hammer meets a target between it and its thrower.
    const hammer = ownProjectile(f, undefined);
    if (hammer === undefined) return false;
    const between = (motion.x - hammer.x) * (f.motion.x - motion.x) > 0 && Math.abs(f32(motion.x - hammer.x)) > body.radius;
    const level = Math.abs(f32(f32(f32(motion.z + f32(f32(body.z1 + body.z2) * 0.5)) - hammer.z))) <= f32(f32(body.z2 - body.z1) * 0.5 + 30.0);
    if (!between || !level || !takes(skill, hammer.serial, f.character * 7 + 5)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  if (move.burst !== undefined) {
    // The orb bursts where it is: a target inside the burst's reach.
    const orb = ownProjectile(f, move.burst.from);
    if (orb === undefined) return false;
    const reach = f32(move.burst.into.radius + body.radius);
    const inside = Math.abs(f32(motion.x - orb.x)) <= reach && orb.z >= f32(f32(motion.z + body.z1) - reach) && orb.z <= f32(f32(motion.z + body.z2) + reach);
    if (!inside || !takes(skill, orb.serial, f.character * 7 + 6)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  const order = move.command?.order;
  const animal = placedObject(f, move.command?.slot);
  const partner = animal.spec?.companion;
  if (order !== undefined && partner !== undefined && animal.life > 0) {
    const fromPartner = f32(motion.x - animal.x);
    if (order === CompanionOrder.lunge) {
      // The partner lunges the way its owner turns: at a target in reach of its front.
      const shot = animal.spec?.shot;
      const reach = partner.behavior === "sentry" && shot !== undefined ? f32(shot.velocityX * shot.life) : f32(f32(partner.lungeTravel + body.radius) + PARTNER_BITE_REACH);
      const height = f32(animal.z - motion.z);
      const withinHeight = partner.behavior === "flying" ? height >= -body.z2 && height <= f32((partner.lungeDrop ?? 0.0) + body.z2) : Math.abs(height) <= 60.0;
      if (!companionReady(f, move.command?.slot) || Math.abs(fromPartner) > reach || !withinHeight || !takes(skill, floorDiv(frame, 20), f.character * 7 + 22 + slot)) return false;
      pressSlot(input, slot, fromPartner < 0 ? -1 : 1);
      return true;
    }
    // Called back when it strays far from its owner.
    if (Math.abs(f32(animal.x - f.motion.x)) < f32(partner.leash * PARTNER_STRAY) || !takes(skill, floorDiv(frame, 30), f.character * 7 + 23)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  if (move.ritual !== undefined) {
    // Close by, the shatter strikes (heroSpecialUse); far away it is cashed for mana, or before the shell runs out.
    const cash = (f.mana.points < RITUAL_MANA && Math.abs(f32(motion.x - f.motion.x)) >= RITUAL_GAP) || f.status.armorFrames <= RITUAL_LAST_FRAMES;
    if (!cash || !takes(skill, floorDiv(frame, 30), f.character * 7 + 7)) return false;
    pressSlot(input, slot, 0);
    return true;
  }
  return false;
}

/** A hero's kit options outside a running special; true when it pressed one. */
function pressHeroOption(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, frame: number, ready: boolean, input: Controls): boolean {
  const specials = f.tuning.specials;
  if (specials === undefined || !canAttack(f) || f.special.action !== SpecialAction.none) return false;
  const dx = f32(target.motion.x - f.motion.x);
  const gap = Math.abs(dx);
  const toward = towardOf(f, target.motion.x);
  const level = Math.abs(f32(target.motion.z - f.motion.z)) <= 60.0;
  // Approach until the hammer's forecasted reach can cash Divine Shield before it expires.
  // The same approach gives sleeping, stunned, frozen or hexed targets to the attack chooser.
  const open = f.status.divineFrames > 0 || heroStatusBlocksActions(target) || target.status.frozenFrames > 0 || target.status.condition === HeroStatusKind.hex;
  const closeReach = open ? Math.max(50.0, moveReachAhead(f.character, AttackStyle.forwardTilt, target, f.tuning.moves)) : 50.0;
  const closeGap = open ? Math.abs(aheadX(f, target, attackStartupFrames(AttackStyle.forwardTilt, f.tuning.moves), AttackStyle.forwardTilt)) : gap;
  if (open && f.motion.grounded && closeGap > closeReach && takes(skill, floorDiv(frame, 45), f.character * 7 + 18)) {
    // A reachable shot can use the protection while the opponent stays outside melee range.
    if (f.status.divineFrames > 0 && ready) for (const slot of HERO_SLOTS) {
      if (heroSpecialUse(f, target, stage, slot) !== HeroSpecialUse.ranged) continue;
      pressSlot(input, slot, toward);
      return true;
    }
    steerOnGround(f, stage, target.motion.x, input);
    return true;
  }
  // Under a target dropping in close, a jump meets it with an aerial (a ring like Frost Halo traps it).
  if (ready && f.motion.grounded && !target.motion.grounded && target.motion.vz < 0 && gap <= ANTI_AIR_GAP && f32(target.motion.z - f.motion.z) >= 30.0
    && f32(target.motion.z - f.motion.z) <= ANTI_AIR_RISE && f.jump.squat <= 0 && botChoice(floorDiv(frame, 20), f.character * 7 + 28, 3) === 0
    && takes(skill, floorDiv(frame, 20), f.character * 7 + 29)) {
    input.jumpPressed = true;
    input.jumpHeld = true;
    return true;
  }
  for (const slot of HERO_SLOTS) {
    const kit = specialKit(specials, slot);
    // A marked opponent in reach: Shadow Pursuit appears behind it, on the deck.
    const marked = kit.marked;
    if (marked !== undefined && ready && target.status.poisonFrames > 0 && gap <= marked.range && Math.abs(f32(target.motion.z - f.motion.z)) <= marked.range
      && f.mana.points >= marked.special.cost && safeAt(stage, f32(target.motion.x - f32(target.facing * BEHIND_MARK_ROOM)), 0.0)
      && takes(skill, floorDiv(frame, 20), f.character * 7 + 8)) {
      pressSlot(input, slot, toward);
      return true;
    }
    const move = startableForm(f, specials, slot);
    if (move === undefined) continue;
    if (move === kit.recall) {
      if (pressRecall(f, target, move, slot, skill, frame, input)) return true;
      continue;
    }
    if (!ready || !f.motion.grounded) continue;
    // An image or a partner that strikes nothing, set between the fighter and the target (Mirror Image steps back from it).
    if (move.placement !== undefined && move.placement.shot === undefined && (move.regions ?? []).length === 0 && placedObject(f, move.placement.slot).life <= 0
      && gap >= IMAGE_NEAR && gap <= IMAGE_FAR && level && safeAt(stage, f32(f.motion.x - f32(toward * IMAGE_ROOM)), 0.0)
      && botChoice(floorDiv(frame, 45), f.character * 7 + 9, 3) === 0 && takes(skill, floorDiv(frame, 45), f.character * 7 + 10)) {
      pressSlot(input, slot, toward);
      return true;
    }
    // A shell of armor, cast while the target is far.
    if (move.armor?.shell === true && f.status.armorFrames <= 0 && gap >= ARMOR_GAP && f.mana.points >= move.cost + ARMOR_SPARE
      && botChoice(floorDiv(frame, 45), f.character * 7 + 11, 3) === 0 && takes(skill, floorDiv(frame, 45), f.character * 7 + 12)) {
      pressSlot(input, slot, 0);
      return true;
    }
  }
  return false;
}

/** Illidan's live Mana Burn orb flying toward the target, if any. */
function orbTowardTarget(f: Readonly<Fighter>, target: Readonly<Fighter>) {
  for (const projectile of f.projectiles) {
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.manaBurn) continue;
    if (f32(f32(target.motion.x - projectile.x) * projectile.direction) > 0 && f32(f32(projectile.x - f.motion.x) * projectile.direction) > 0) return projectile;
  }
  return undefined;
}

/**
 * The kit options an actionable fighter takes in neutral: a hero's recall,
 * burst, image, armor or pursuit; the perched hippogryph's dive through the
 * target; the short-hop blaster; running behind Mana Burn. `ready` is false
 * while the attack pause lasts, which only the placed and offensive options
 * wait for. True when that took the frame.
 */
export function pressKitOption(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, frame: number, ready: boolean, input: Controls, commands: AttackBuffer): boolean {
  if (skill.kitTenths <= 0 || f.launch.hitstun > 0) return false;
  if (f.tuning.specials !== undefined) return pressHeroOption(f, target, stage, skill, frame, ready, input);
  const { motion } = f;
  const dx = f32(target.motion.x - motion.x);
  const gap = Math.abs(dx);
  const toward = towardOf(f, target.motion.x);
  const free = canAttack(f) && f.special.action === SpecialAction.none;
  switch (f.character) {
    case Character.archer: {
      // The perched hippogryph dives at her: a target on its path is struck.
      const bird = f.hippogryph;
      if (!free || bird.kind !== HippogryphKind.perch || !affords(f, SpecialAction.archerDisengage)) return false;
      const span = f32(motion.x - bird.x);
      const along = f32(target.motion.x - bird.x);
      if (span === 0.0 || along * span < 0 || Math.abs(along) > f32(Math.abs(span) + DIVE_REACH_X)) return false;
      const lineZ = f32(bird.z + f32(f32(f32(f32(motion.z + 40.0) - bird.z) * Math.min(1.0, f32(along / span)))));
      if (Math.abs(f32(target.motion.z - lineZ)) > DIVE_REACH_Z || !takes(skill, floorDiv(frame, 20), f.character * 7 + 13)) return false;
      pressSlot(input, SpecialSlot.down, 0);
      return true;
    }
    case Character.rifleman: {
      // Long Rifles ready (passives.ts): the next shot flies half again as far, so it shoots from further and whenever a shot suits.
      const rifles = passivePips(f).ready;
      if (!free || !ready || toward !== f.facing || gap < SHOT_NEAR || gap > (rifles ? f32(SHOT_FAR * 1.5) : SHOT_FAR) || !affords(f, SpecialAction.riflemanBlaster)) return false;
      const rise = f32(motion.z - target.motion.z);
      if (!takes(skill, floorDiv(frame, 40), f.character * 7 + 14) || (!rifles && botChoice(floorDiv(frame, 40), f.character * 7 + 15, 2) !== 0)) return false;
      if (motion.grounded) {
        // A ready shot is cashed on the ground before a hop can spend it on a normal.
        if (rifles && Math.abs(rise) <= 30.0) {
          pressSlot(input, SpecialSlot.neutral, 0);
          return true;
        }
        // The short hop: a jump let go at once.
        if (Math.abs(rise) > 30.0 || f.jump.squat > 0) return false;
        input.jumpPressed = true;
        input.jumpHeld = false;
        return true;
      }
      if (rise < 0.0 || rise > SHOT_RISE) return false;
      pressSlot(input, SpecialSlot.neutral, 0);
      return true;
    }
    case Character.demonHunter: {
      // Behind the slow orb: the orb's stun or the shield it draws, then Illidan is there.
      const orb = orbTowardTarget(f, target);
      if (orb !== undefined && free && motion.grounded && takes(skill, orb.serial, f.character * 7 + 16)) {
        steerOnGround(f, stage, f32(orb.x - f32(orb.direction * ORB_FOLLOW_GAP)), input);
        return true;
      }
      // Eye Blast: a forward smash charged into its floor beam at a grounded target out of the swing's reach.
      if (free && ready && motion.grounded && target.motion.grounded && toward === f.facing && gap >= EYE_BLAST_NEAR && gap <= EYE_BLAST_FAR
        && Math.abs(f32(target.motion.z - motion.z)) <= 40.0 && takes(skill, floorDiv(frame, 30), f.character * 7 + 24) && botChoice(floorDiv(frame, 30), f.character * 7 + 25, 3) === 0) {
        queueAttack(commands, { style: AttackStyle.forwardSmash, facing: toward < 0 ? -1 : 1, frame, mayCharge: true });
        input.attackHeld = true;
        return true;
      }
      // Fel Rush through a level target close ahead, ending on the deck.
      const rush = f32(FEL_RUSH_SPEED * (FEL_RUSH_LAST - FEL_RUSH_FIRST + 1));
      if (!free || !ready || !motion.grounded || toward !== f.facing || gap < RUSH_NEAR || gap > RUSH_FAR || Math.abs(f32(target.motion.z - motion.z)) > 60.0
        || !safeAt(stage, f32(motion.x + f32(f.facing * rush)), 0.0) || !affords(f, SpecialAction.demonHunterFelRush)
        || !takes(skill, floorDiv(frame, 30), f.character * 7 + 20) || botChoice(floorDiv(frame, 30), f.character * 7 + 21, 2) !== 0) return false;
      pressSlot(input, SpecialSlot.side, toward);
      return true;
    }
  }
  return false;
}

/**
 * The original fighters' running specials: the recoil shot's route and
 * second shot, Immolate cancelled by a jump, Wing Ascent's glide and its
 * slash, the hippogryph ride's low line and leap-off. Runs after the
 * return's steering (botRecovery.ts), so a return keeps its direction home.
 * True when that took the frame.
 */
export function steerRunningSpecial(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, stage: number, skill: CpuSkill, input: Controls): boolean {
  const { special, motion } = f;
  if (skill.kitTenths <= 0 || special.action === SpecialAction.none || f.launch.hitstun > 0 || f.launch.hitlag > 0) return false;
  const seed = actionSeed(f);
  if (!takes(skill, seed, f.character * 7 + 17)) return false;
  const left = mainDeckLeft(stage);
  const right = mainDeckRight(stage);
  const floor = mainDeckZ(stage);
  const home = motion.x < 0 ? 1 : -1;
  const outside = motion.x < left ? f32(left - motion.x) : motion.x > right ? f32(motion.x - right) : 0.0;
  const next = special.frame + 1;
  switch (special.action) {
    case SpecialAction.riflemanRecovery: {
      if (outside <= 0.0 && motion.z >= floor) return false;
      const level = outside > LEVEL_REACH && motion.z > f32(floor - LEVEL_BELOW);
      if (next <= RIFLEMAN_RECOVERY_STARTUP_FRAMES) {
        // The stick on frame 4 picks the route: level from far out at the deck's height, diagonally up otherwise.
        input.direction = home;
        input.verticalDirection = level ? -1 : 0;
        return true;
      }
      if (special.form === RIFLEMAN_SECOND_SHOT_FORM || next < RIFLEMAN_SECOND_SHOT_FIRST || next > RIFLEMAN_SECOND_SHOT_LAST) return false;
      // The second shot near the top of the flight, or at its last chance.
      if (motion.vz > 4.0 && next < RIFLEMAN_SECOND_SHOT_LAST) return false;
      input.specialPressed = true;
      input.specialX = home;
      input.specialZ = level ? -1 : 1;
      input.direction = home;
      input.verticalDirection = input.specialZ;
      return true;
    }
    case SpecialAction.demonHunterFelRush: {
      // After the pass: Chaos Strike at a target in reach either side (behind is the cross-up), Vengeful Retreat off a shield or an answer.
      if (special.form !== 0 || next < FEL_RUSH_BRANCH_FIRST || next > FEL_RUSH_BRANCH_LAST || target === undefined) return false;
      const dx = f32(target.motion.x - motion.x);
      if ((target.shield.raised || target.attack.style !== undefined) && Math.abs(dx) <= RUSH_FAR) {
        input.specialPressed = true;
        return true;
      }
      if (Math.abs(dx) > CHAOS_REACH || Math.abs(f32(target.motion.z - motion.z)) > 70.0) return false;
      input.attackPressed = true;
      input.direction = dx < 0 ? -1 : 1;
      return true;
    }
    case SpecialAction.demonHunterImmolate:
      // Once the burn is out, a jump ends the rest of it.
      if (special.frame < DEMONHUNTER_IMMOLATE_STARTUP + DEMONHUNTER_IMMOLATE_ACTIVE || (!motion.grounded && f.jump.remaining <= 0)) return false;
      input.jumpPressed = true;
      input.jumpHeld = target !== undefined && f32(target.motion.z - motion.z) > 60.0;
      return true;
    case SpecialAction.demonHunterWingAscent: {
      if (special.form === 0) {
        if (next < DEMONHUNTER_GLIDE_FIRST || next > DEMONHUNTER_WING_DURATION) return false;
        // Home from above the deck's height, or across the deck at a target ahead.
        const returning = outside > 60.0 && motion.z > f32(floor + 20.0) && f.facing === home;
        const ahead = target === undefined ? 0.0 : f32(f32(target.motion.x - motion.x) * f.facing);
        const chasing = outside <= 0.0 && target !== undefined && ahead >= GLIDE_GAP && target.motion.z <= motion.z && safeAt(stage, target.motion.x, 0.0);
        if (!returning && !chasing) return false;
        input.jumpPressed = true;
        return true;
      }
      if (special.form !== DEMONHUNTER_GLIDE_FORM) return false;
      if (outside > 0.0) {
        // Gliding home: the high line keeps the deck in reach.
        input.verticalDirection = motion.z < f32(floor + 40.0) ? 1 : 0;
        return true;
      }
      if (target === undefined) return false;
      const ahead = f32(f32(target.motion.x - motion.x) * f.facing);
      const below = f32(motion.z - target.motion.z);
      input.verticalDirection = below > 40.0 ? -1 : 0;
      input.attackPressed = ahead >= 0.0 && ahead <= SLASH_REACH && Math.abs(below) <= 70.0;
      return true;
    }
    case SpecialAction.archerRecovery: {
      if (next >= ARCHER_RIDE_LEAP_FIRST) {
        // Off the hippogryph over the deck, or under a target just above, where the bird flies on into it.
        const over = motion.x >= f32(left + 40.0) && motion.x <= f32(right - 40.0) && motion.z >= f32(floor + 20.0);
        const under = target !== undefined && Math.abs(f32(target.motion.x - motion.x)) <= 80.0 && f32(target.motion.z - motion.z) >= 0.0 && f32(target.motion.z - motion.z) <= 150.0;
        if (over || under) {
          input.jumpPressed = true;
          input.jumpHeld = true;
          return true;
        }
      }
      // The low line carries her across from high and far out.
      input.down = outside > LEVEL_REACH && motion.z > f32(floor + LEVEL_ABOVE);
      return false;
    }
  }
  return false;
}

/**
 * The frames a computer charges its smash: `goal`, or for Illidan's forward
 * smash at a target past the swing's reach, at least Eye Blast's charge.
 */
export function kitChargeGoal(f: Readonly<Fighter>, target: Readonly<Fighter> | undefined, skill: CpuSkill, goal: number): number {
  if (f.character !== Character.demonHunter || f.attack.style !== AttackStyle.forwardSmash || target === undefined || skill.kitTenths <= 0) return goal;
  return Math.abs(f32(target.motion.x - f.motion.x)) >= EYE_BLAST_NEAR ? Math.max(goal, EYE_BLAST_CHARGE_FRAMES) : goal;
}

/** Whether the target can't answer a dash-in: landing, ending a move, or down. */
function punishable(target: Readonly<Fighter>): boolean {
  const style = target.attack.style;
  if (target.landing.lag > 0 || target.down.state !== DownState.none) return true;
  return style !== undefined && target.attack.frame > attackStartupFrames(style, target.tuning.moves) + characterAttackActiveFrames(target.character, style, target.tuning.moves);
}

/**
 * Runs in instead of walking up, so the next attack is the dash attack: at a
 * target whose move or landing can be punished, or for a fighter that may
 * fight close, at any level target now and then. Called after the ground
 * steering (botPlay.ts), which it only turns into a run toward the target.
 */
export function dashIn(f: Readonly<Fighter>, target: Readonly<Fighter>, stage: number, skill: CpuSkill, frame: number, closes: boolean, input: Controls): void {
  if (skill.kitTenths <= 0 || !f.motion.grounded || (f.tuning.moves?.dashAttack === undefined && f.character !== Character.demonHunter)) return;
  // A ready shot passive (Trueshot, Long Rifles) is cashed from range, not by running in.
  const kind = passiveSpec(f.character).kind;
  if ((kind === PassiveKind.trueshot || kind === PassiveKind.longRifles) && passivePips(f).ready) return;
  const dx = f32(target.motion.x - f.motion.x);
  if (Math.abs(dx) > DASH_IN_FAR || Math.abs(f32(target.motion.z - f.motion.z)) > 40.0 || target.shield.raised || !safeAt(stage, target.motion.x, 0.0)) return;
  const stretch = floorDiv(frame, 40);
  if (!punishable(target) && !(closes && botChoice(stretch, f.character * 7 + 26, 8) === 0)) return;
  if (!takes(skill, stretch, f.character * 7 + 27)) return;
  input.walking = false;
  input.direction = dx < 0 ? -1 : 1;
}
