// Fighter-scoped repair (#168): while a correction has changed one fighter
// only, a repaired frame plays that fighter alone and takes every other
// fighter from the earlier run's next snapshot. The tests here are loose
// (distances and states, not exact contact shapes): a pair passes when
// neither can reach the other this frame.
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { type MatchState, Phase, holdingStart, stageClock } from "../match/rules";
import { LedgeState, SpecialAction } from "../sim/codes";
import { inGrabContext } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { countsOffscreen } from "../sim/offscreenDamage";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { cannonOn, hasTide } from "../sim/stageHazards";

/**
 * Farther apart than this on either axis, a fighter's strikes, specials,
 * grabs and summons can't reach another this frame. A special that moves its
 * caster next to another fighter is caught by the same test on the states
 * after the frame.
 */
export const SCOPE_REACH = 300.0;
/** Two fighters doing nothing that strikes still push each other within this. */
const SCOPE_BODY = 150.0;

const apart = (ax: number, az: number, bx: number, bz: number, distance: number): boolean =>
  Math.abs(f32(ax - bx)) >= distance || Math.abs(f32(az - bz)) >= distance;

/** Strikes, casts, holds or is held, hangs on a ledge or rides a cannon: it may act on a fighter near it. */
function reaching(f: Readonly<Fighter>): boolean {
  return f.attack.style !== undefined || f.special.action !== SpecialAction.none || f.grab.owner !== undefined || f.grab.target !== undefined || inGrabContext(f)
    || f.ledge.state !== LedgeState.none || f.cannon.held !== undefined;
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
  const reach = reaching(a) || reaching(b) ? SCOPE_REACH : SCOPE_BODY;
  return apart(a.motion.x, a.motion.z, b.motion.x, b.motion.z, reach);
}

/** `slot` is apart from every other active fighter of `others`. */
export function apartFromOthers(slot: number, fighter: Readonly<Fighter>, others: Readonly<Roster>): boolean {
  for (const other of PARTICIPANT_SLOTS) {
    if (other === slot || !isActive(others, other)) continue;
    if (!fightersApart(fighter, fighterAt(others, other))) return false;
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
  for (const other of PARTICIPANT_SLOTS) {
    if (other === slot || !isActive(world, other)) continue;
    const { x, z } = fighterAt(world, other).motion;
    if (countsOffscreen(game.camera, x, z) !== countsOffscreen(after.camera, x, z)) return false;
  }
  return true;
}
