// A hero's partner (SpecialPlacement.companion, Beastmaster's bear): a placed
// object that walks after its owner on the deck it was placed on and attacks
// only when its owner orders a lunge. It never jumps, never leaves its deck,
// never blocks a body and never shields its owner. Its lunge is cancelled
// while its owner is in hitstun or in a grab, and an opponent's hit during
// a lunge stuns it. Every value is fighter state, so rollback restores it.
import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../../runtime/numbers";
import { AttackStyle } from "./codes";
import { inGrabContext, isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { CompanionMode, type SpecialCompanion } from "./heroSpecials";
import { applyAttackHit } from "./hits";
import { HurtContact, strikeHurtContact } from "./hurtboxes";
import { type Roster, fighterAt, isActive } from "./roster";
import { shieldCircleIntersects } from "./shield";
import { surfaceLeft, surfaceRight, surfaceZ } from "./stage";
import { emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { PARTICIPANT_CAPACITY } from "../input/participants";

// Preallocated: rollback replays every partner every frame.
const bite = emptyCapsule();

/** Steps `x` toward `target` by at most `speed`; the facing it walked, or 0 when it arrived. */
function stepToward(f: Fighter, target: number, speed: number): number {
  const { placed } = f;
  const dx = f32(target - placed.x);
  if (Math.abs(dx) <= speed) {
    placed.x = target;
    return 0;
  }
  const direction = dx < 0 ? -1 : 1;
  placed.x = f32(placed.x + f32(direction * speed));
  return direction;
}

/** Whether the owner can't direct its partner now: launched, held, holding or throwing, or out. */
function ownerBusy(owner: Readonly<Fighter>): boolean {
  return owner.status.out || owner.launch.hitstun > 0 || inGrabContext(owner);
}

/** The lunge's bite against every opponent it hasn't bitten yet this lunge. */
function biteOpponents(world: Roster, ownerSlot: number, partner: Readonly<SpecialCompanion>): void {
  const owner = fighterAt(world, ownerSlot);
  const { placed } = owner;
  placeCapsule(bite, partner.bite, placed.x, placed.z, placed.direction);
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (targetSlot === ownerSlot || !isActive(world, targetSlot)) continue;
    const bit = 1 << targetSlot;
    if ((placed.bitten & bit) !== 0) continue;
    const target = fighterAt(world, targetSlot);
    if (target.status.out || isIntangible(target)) continue;
    const shielded = target.shield.raised && shieldCircleIntersects(target, bite.x1, bite.z1, bite.x2, bite.z2, 1.0, bite.radius);
    if (!shielded && strikeHurtContact(bite, target) !== HurtContact.hit) continue;
    placed.bitten |= bit;
    applyAttackHit(world, ownerSlot, targetSlot, AttackStyle.jab, placed.direction, partner.biteEffect, false, shielded);
  }
}

/** One frame of the owner's partner, inside the specials' contact batch. */
export function advanceCompanion(world: Roster, ownerSlot: number, stage: number, matchFrame: number): void {
  const owner = fighterAt(world, ownerSlot);
  const { placed } = owner;
  const partner = placed.spec?.companion;
  if (placed.life <= 0 || partner === undefined) return;
  placed.modeFrame++;
  if (placed.mode === CompanionMode.lunge) {
    const biteStart = partner.lungeStartup + 1;
    const biteEnd = partner.lungeStartup + partner.lungeActive;
    if (ownerBusy(owner)) {
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
    } else if (placed.modeFrame >= biteStart && placed.modeFrame <= biteEnd) {
      placed.x = f32(placed.x + f32(placed.direction * f32(partner.lungeTravel / partner.lungeActive)));
      biteOpponents(world, ownerSlot, partner);
    } else if (placed.modeFrame >= biteEnd + partner.lungeRecovery) {
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
    }
  } else if (placed.mode === CompanionMode.stunned) {
    if (placed.modeFrame >= partner.stunFrames) {
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
    }
  } else if (placed.mode === CompanionMode.returning) {
    const walked = stepToward(owner, owner.motion.x, partner.returnSpeed);
    if (walked !== 0) placed.direction = walked;
    if (Math.abs(f32(owner.motion.x - placed.x)) <= partner.followBehind) {
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
    }
  } else {
    const heel = f32(owner.motion.x - f32(owner.facing * partner.followBehind));
    const walked = stepToward(owner, heel, partner.followSpeed);
    placed.direction = walked !== 0 ? walked : owner.facing < 0 ? -1 : 1;
  }
  // It keeps to its deck: its ends stop it, and a moving deck carries its height.
  const surface = placed.surface;
  if (surface !== undefined) {
    const left = f32(surfaceLeft(stage, surface, matchFrame) + partner.bite.radius);
    const right = f32(surfaceRight(stage, surface, matchFrame) - partner.bite.radius);
    placed.x = min(right, max(left, placed.x));
    placed.z = surfaceZ(stage, surface, matchFrame);
  }
  placed.apart = owner.status.out || Math.abs(f32(owner.motion.x - placed.x)) > partner.leash ? placed.apart + 1 : 0;
  if (placed.apart >= partner.leashFrames) placed.life = 0;
}

/** A hit that reaches the partner during a lunge cancels it and stuns it. */
export function staggerCompanion(f: Fighter): void {
  const { placed } = f;
  const partner = placed.spec?.companion;
  if (partner === undefined || placed.mode !== CompanionMode.lunge) return;
  placed.mode = CompanionMode.stunned;
  placed.modeFrame = 0;
}
