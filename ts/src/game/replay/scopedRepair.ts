// Fighter-scoped repair (#168): while a correction has changed one fighter
// only, a repaired frame plays that fighter alone and takes every other
// fighter from the earlier run's next snapshot. The tests here are loose
// (distances and states, not exact contact shapes): a pair passes when
// neither can reach the other this frame.
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type MatchState, Phase, holdingStart, stageClock } from "../match/rules";
import { LedgeState, SpecialAction } from "../sim/codes";
import { inGrabContext } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { countsOffscreen } from "../sim/offscreenDamage";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { cannonOn, hasTide } from "../sim/stageHazards";
import { firstMeterDropsDifference } from "../match/meterDrops";
import { AttackStyle, LAST_ATTACK_STYLE } from "../sim/codes";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { authoredTuning } from "../sim/tuning";
import type { FighterMoves, StrikeCapsule } from "../sim/heroMoves";
import { attackCapsule, emptyCapsule, hurtCapsule } from "../physics/contactGeometry";
import { type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { type HurtPart, type HurtPose, shippedHurtboxes } from "../sim/hurtboxes";
import type { AuthoredSpecial } from "../sim/heroSpecials";
import { SMASH_MAX_CHARGE_FRAMES, attackStartupFrames, characterAttackActiveFrames } from "../sim/moves";
import { felLungeStep } from "../sim/moves";
import { EYE_BLAST_FORM, EYE_BLAST_REACH } from "../sim/specials";

interface AuthoredTravel {
  readonly moves: FighterMoves;
  readonly startup: readonly (readonly number[])[];
}

const authoredTravel: { readonly [character: number]: AuthoredTravel | undefined } = buildAuthoredTravel();

function buildAuthoredTravel(): { [character: number]: AuthoredTravel | undefined } {
  const result: { [character: number]: AuthoredTravel | undefined } = {};
  for (const character of SELECTABLE_CHARACTERS) {
    const moves = authoredTuning(character).moves;
    if (moves === undefined) continue;
    const startup: number[][] = [];
    for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
      const move = moves.normals[style];
      const positions = [0.0];
      if (move?.startupTravelX !== undefined && move.startupFrames > 0) {
        const step = f32(move.startupTravelX / move.startupFrames);
        let x = 0.0;
        for (let frame = 1; frame <= move.startupFrames; frame++) {
          x = f32(x + step);
          positions.push(x);
        }
      }
      startup[style] = positions;
    }
    result[character] = { moves, startup };
  }
  return result;
}

function authoredStartupStep(fighter: Readonly<Fighter>): number {
  const style = fighter.attack.style;
  if (style === undefined || !fighter.motion.grounded) return 0.0;
  const lunge = felLungeStep(fighter.character, style, fighter.attack.frame + 1, false, fighter.attack.smashChargeFrames);
  if (lunge > 0.0) return f32(lunge * fighter.facing);
  const travel = authoredTravel[fighter.character];
  if (travel === undefined || travel.moves !== fighter.tuning.moves) return 0.0;
  const move = travel.moves.normals[style];
  if (move?.startupTravelX === undefined || fighter.attack.frame >= move.startupFrames) return 0.0;
  const positions = at(travel.startup, style);
  const frame = fighter.attack.frame;
  return f32(f32(at(positions, frame + 1) - at(positions, frame)) * fighter.facing);
}

interface Extent { x: number; z: number }

const reachCapsule = emptyCapsule();
const reachRegion = emptyHitRegion();

function widen(extent: Extent, minX: number, maxX: number, minZ: number, maxZ: number): void {
  extent.x = Math.max(extent.x, Math.abs(minX), Math.abs(maxX));
  extent.z = Math.max(extent.z, Math.abs(minZ), Math.abs(maxZ));
}

function widenCapsule(extent: Extent, c: Readonly<StrikeCapsule>): void {
  widen(extent, f32(Math.min(c.x1, c.x2) - c.radius), f32(Math.max(c.x1, c.x2) + c.radius), f32(Math.min(c.z1, c.z2) - c.radius), f32(Math.max(c.z1, c.z2) + c.radius));
}

function widenRegion(extent: Extent, style: number | undefined, region: Readonly<HitRegion>): void {
  widen(extent, region.minX, region.maxX, region.minZ, region.maxZ);
  widenCapsule(extent, attackCapsule(reachCapsule, style, region));
}

function widenSpecial(extent: Extent, special: Readonly<AuthoredSpecial> | undefined): void {
  if (special === undefined) return;
  for (const region of special.regions ?? []) widenRegion(extent, undefined, region.hit);
  if (special.commandGrab !== undefined) widenCapsule(extent, special.commandGrab.strike);
  widenSpecial(extent, special.ex);
  for (const followUp of special.followUps ?? []) widenSpecial(extent, followUp.special);
}

function widenHurt(extent: Extent, parts: readonly Readonly<HurtPart>[] | undefined): void {
  for (const part of parts ?? []) widenCapsule(extent, part);
}

function widenHurtPoses(extent: Extent, poses: readonly HurtPose[] | undefined): void {
  for (const pose of poses ?? []) widenHurt(extent, pose.parts);
}

/** The roster's authored reach: widest strike, largest hurt body and both fighters' fastest travel, on each axis. */
function rosterReach(): Extent {
  const strike = { x: 0.0, z: 0.0 };
  const body = { x: 0.0, z: 0.0 };
  let travel = 0.0;
  for (const character of SELECTABLE_CHARACTERS) {
    const tuning = authoredTuning(character);
    const { moves, specials, physics } = tuning;
    const charges = [0, moves?.smashMaxChargeFrames ?? SMASH_MAX_CHARGE_FRAMES];
    for (const style of Object.values(AttackStyle)) {
      const authored = style === AttackStyle.grab ? undefined : moves?.normals[style];
      if (authored !== undefined) {
        for (const region of authored.regions) widenRegion(strike, style, region.hit);
        continue;
      }
      const last = attackStartupFrames(style, moves) + characterAttackActiveFrames(character, style, moves);
      for (let index = 0; index < authoredHitRegionCount(style, moves); index++) {
        for (let frame = 0; frame <= last; frame++) {
          for (const charge of charges) {
            const region = authoredHitRegion(reachRegion, character, style, frame, charge, index, moves);
            if (region.window > 0) widenRegion(strike, style, region);
          }
        }
      }
    }
    if (specials !== undefined) {
      for (const kit of [specials.neutral, specials.side, specials.up, specials.down]) {
        widenSpecial(strike, kit.ground);
        widenSpecial(strike, kit.air);
        widenSpecial(strike, kit.recall);
        widenSpecial(strike, kit.marked?.special);
        widenHurtPoses(body, kit.ground.hurt);
        widenHurtPoses(body, kit.air?.hurt);
        widenHurtPoses(body, kit.recall?.hurt);
        widenHurtPoses(body, kit.marked?.special.hurt);
      }
    }
    const hurtboxes = moves?.hurtboxes ?? shippedHurtboxes(character, moves);
    widenCapsule(body, hurtCapsule(character));
    widenHurt(body, hurtboxes.stand);
    widenHurt(body, hurtboxes.crouch);
    for (const style of Object.values(AttackStyle)) widenHurtPoses(body, hurtboxes.attacks[style]);
    travel = Math.max(travel, physics.terminalSpeed, physics.fastFallSpeed, physics.airSpeed, physics.airCap, physics.dashSpeed, physics.runSpeed,
      physics.walkSpeed, physics.fullJumpSpeed, physics.shortJumpSpeed, physics.aerialJumpSpeed, physics.jumpHorizontalCap,
      physics.aerialJumpHorizontalSpeed, physics.shieldBreakSpeed, physics.groundSpeedCap);
  }
  const both = f32(2.0 * travel);
  return { x: f32(f32(strike.x + body.x) + both), z: f32(f32(strike.z + body.z) + both) };
}

/**
 * Farther apart than this on an axis, a fighter's strikes, specials, grabs
 * and summons can't reach another this frame, except Eye Blast's beam
 * (`strikeReach`). A special that moves its caster next to another fighter is
 * caught by the same test on the states after the frame.
 */
export const SCOPE_REACH: Readonly<Extent> = rosterReach();
/** Two fighters doing nothing that strikes still push each other within this. */
const SCOPE_BODY = 150.0;

const BODY_EXTENT: Readonly<Extent> = { x: SCOPE_BODY, z: SCOPE_BODY };

const EYE_BLAST_EXTENT: Readonly<Extent> = { x: Math.max(EYE_BLAST_REACH, SCOPE_REACH.x), z: Math.max(EYE_BLAST_REACH, SCOPE_REACH.z) };

const apart = (ax: number, az: number, bx: number, bz: number, distance: Readonly<Extent>): boolean =>
  Math.abs(f32(ax - bx)) >= distance.x || Math.abs(f32(az - bz)) >= distance.z;

const apartPair = (ax: number, az: number, bx: number, bz: number, a: Readonly<Extent>, b: Readonly<Extent>): boolean =>
  Math.abs(f32(ax - bx)) >= Math.max(a.x, b.x) || Math.abs(f32(az - bz)) >= Math.max(a.z, b.z);

/** Strikes, casts, holds or is held, hangs on a ledge or rides a cannon: it may act on a fighter near it. */
function reaching(f: Readonly<Fighter>): boolean {
  return f.attack.style !== undefined || f.special.action !== SpecialAction.none || f.grab.owner !== undefined || f.grab.target !== undefined || inGrabContext(f)
    || f.ledge.state !== LedgeState.none || f.cannon.held !== undefined;
}

/** How far `f` may act on another fighter this frame: Eye Blast's whole beam, any other reaching action, or a body push. */
function strikeReach(f: Readonly<Fighter>): Readonly<Extent> {
  if (f.special.action === SpecialAction.demonHunterManaBurn && f.special.form === EYE_BLAST_FORM) return EYE_BLAST_EXTENT;
  return reaching(f) ? SCOPE_REACH : BODY_EXTENT;
}

/** Every live projectile, summon and placed object of `owner` is beyond reach of `other`'s body. */
function objectsApart(owner: Readonly<Fighter>, other: Readonly<Fighter>): boolean {
  const { x, z } = other.motion;
  for (const p of owner.projectiles) if (p.life > 0 && !apart(p.x, p.z, x, z, SCOPE_REACH)) return false;
  if (owner.bear.life > 0 && !apart(owner.bear.x, owner.bear.z, x, z, SCOPE_REACH)) return false;
  if (owner.freezeTrap.life > 0 && !apart(owner.freezeTrap.x, owner.freezeTrap.z, x, z, SCOPE_REACH)) return false;
  if (owner.placed.life > 0 && !apart(owner.placed.x, owner.placed.z, x, z, SCOPE_REACH)) return false;
  for (const p of owner.pack) if (p.life > 0 && !apart(p.x, p.z, x, z, SCOPE_REACH)) return false;
  return true;
}

/** Neither fighter can touch the other this frame: far apart, or close with neither doing anything that reaches. */
export function fightersApart(a: Readonly<Fighter>, b: Readonly<Fighter>): boolean {
  if (!objectsApart(a, b) || !objectsApart(b, a)) return false;
  return apartPair(a.motion.x, a.motion.z, b.motion.x, b.motion.z, strikeReach(a), strikeReach(b));
}

/** `slot` is apart from every other active fighter of `others`. */
export function apartFromOthers(slot: number, fighter: Readonly<Fighter>, others: Readonly<Roster>): boolean {
  for (const other of PARTICIPANT_SLOTS) {
    if (other === slot || !isActive(others, other)) continue;
    if (!fightersApart(fighter, fighterAt(others, other))) return false;
  }
  return true;
}

export function authoredMotionApartFromOthers(slot: number, fighter: Readonly<Fighter>, others: Readonly<Roster>): boolean {
  const step = authoredStartupStep(fighter);
  if (step === 0.0) return true;
  const x = f32(fighter.motion.x + step);
  for (const other of PARTICIPANT_SLOTS) {
    if (other === slot || !isActive(others, other)) continue;
    const target = fighterAt(others, other);
    if (!apartPair(x, fighter.motion.z, target.motion.x, target.motion.z, strikeReach(fighter), strikeReach(target))) return false;
  }
  return true;
}

/** The match rules a scoped step leaves out: shared stage hazards, the countdown, training and configured runs. */
export function matchScopable(game: Readonly<MatchState>): boolean {
  return game.phase === Phase.match && !game.training && !game.run.active && !holdingStart(game)
    && !hasTide(game.stageChoice) && !cannonOn(game.stageChoice, stageClock(game));
}

/**
 * After a scoped step: the match came out as the earlier run left it (apart
 * from its camera, which the step moved itself), and the camera counts every
 * other fighter offscreen exactly as the earlier run's did.
 */
export function scopedStepHeld(slot: number, game: Readonly<MatchState>, world: Readonly<Roster>, after: Readonly<MatchState>): boolean {
  if (game.phase !== after.phase || game.winner !== after.winner || game.timedOut !== after.timedOut) return false;
  if (game.remainingFrames !== after.remainingFrames || game.matchFrame !== after.matchFrame) return false;
  const items = game.items;
  const was = after.items;
  if (items.kind !== was.kind || items.nextSpawnFrame !== was.nextSpawnFrame || items.nextKind !== was.nextKind || items.draws !== was.draws
    || items.spawnSerial !== was.spawnSerial || items.pickupSerial !== was.pickupSerial || items.lastTaker !== was.lastTaker) return false;
  if (firstMeterDropsDifference(game.drops, after.drops) !== undefined) return false;
  for (const other of PARTICIPANT_SLOTS) {
    if (other === slot || !isActive(world, other)) continue;
    const { x, z } = fighterAt(world, other).motion;
    if (countsOffscreen(game.camera, x, z) !== countsOffscreen(after.camera, x, z)) return false;
  }
  return true;
}
