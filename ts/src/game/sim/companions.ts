

import { f32 } from "wisp/src/sim/f32";
import { max, min } from "../../runtime/numbers";
import { AttackStyle } from "./codes";
import { inGrabContext, isIntangible } from "./conditions";
import { type Fighter, type PlacedObject, placedObject } from "./fighter";
import { runningHeroSpecial, spawnHeroProjectileAt } from "./heroSpecialRules";
import { CompanionMode, type SpecialCompanion } from "./heroSpecials";
import { applyAttackHit } from "./hits";
import { HurtContact, strikeHurtContact } from "./hurtboxes";
import { type Roster, fighterAt, isActive } from "./roster";
import { shieldCircleIntersects } from "./shield";
import { surfaceLeft, surfaceRight, surfaceZAt } from "./stage";
import { emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { PARTICIPANT_CAPACITY } from "../input/participants";


const bite = emptyCapsule();


function stepToward(placed: PlacedObject, target: number, speed: number): number {
  const dx = f32(target - placed.x);
  if (Math.abs(dx) <= speed) {
    placed.x = target;
    return 0;
  }
  const direction = dx < 0 ? -1 : 1;
  placed.x = f32(placed.x + f32(direction * speed));
  return direction;
}


function ownerBusy(owner: Readonly<Fighter>): boolean {
  return owner.status.out || owner.launch.hitstun > 0 || inGrabContext(owner);
}


function biteOpponents(world: Roster, ownerSlot: number, placed: PlacedObject, partner: Readonly<SpecialCompanion>): void {
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
    applyAttackHit(world, ownerSlot, targetSlot, AttackStyle.jab, placed.direction, partner.biteEffect, false, shielded, undefined);
  }
}


export function advanceCompanion(world: Roster, ownerSlot: number, stage: number, matchFrame: number): void {
  const owner = fighterAt(world, ownerSlot);
  for (let animal = 0; animal <= owner.pack.length; animal++) advanceAnimal(world, ownerSlot, stage, matchFrame, placedObject(owner, animal));
}

function advanceAnimal(world: Roster, ownerSlot: number, stage: number, matchFrame: number, placed: PlacedObject): void {
  const owner = fighterAt(world, ownerSlot);
  const partner = placed.spec?.companion;
  if (placed.life <= 0 || partner === undefined) return;
  if (partner.behavior === "flying" && runningHeroSpecial(owner)?.helpless === true) {
    placed.x = owner.motion.x;
    placed.z = f32(owner.motion.z + 95.0);
    placed.direction = owner.facing;
    placed.mode = CompanionMode.follow;
    placed.modeFrame = 0;
    return;
  }
  placed.modeFrame++;
  if (placed.mode === CompanionMode.lunge) {
    const biteStart = partner.lungeStartup + 1;
    const biteEnd = partner.lungeStartup + partner.lungeActive;
    if (ownerBusy(owner)) {
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
    } else if (partner.volleyFrames !== undefined) {
      for (const shotFrame of partner.volleyFrames) if (placed.modeFrame === shotFrame && placed.spec?.shot !== undefined) {
        const shot = placed.spec.shot;
        spawnHeroProjectileAt(owner, shot, f32(placed.x + f32(placed.direction * shot.offsetX)), f32(placed.z + shot.offsetZ), placed.direction, false, owner.attack.serial + 1);
      }
      if (placed.modeFrame >= biteEnd + partner.lungeRecovery) {
        placed.mode = CompanionMode.follow;
        placed.modeFrame = 0;
      }
    } else if (placed.modeFrame >= biteStart && placed.modeFrame <= biteEnd) {
      placed.x = f32(placed.x + f32(placed.direction * f32(partner.lungeTravel / partner.lungeActive)));
      placed.z = f32(placed.z - f32((partner.lungeDrop ?? 0.0) / partner.lungeActive));
      biteOpponents(world, ownerSlot, placed, partner);
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
    const walked = stepToward(placed, owner.motion.x, partner.returnSpeed);
    if (walked !== 0) placed.direction = walked;
    if (Math.abs(f32(owner.motion.x - placed.x)) <= partner.followBehind) {
      placed.mode = CompanionMode.follow;
      placed.modeFrame = 0;
    }
  } else if (partner.behavior !== "sentry") {
    const heel = f32(owner.motion.x - f32(owner.facing * partner.followBehind));
    const walked = stepToward(placed, heel, partner.followSpeed);
    placed.direction = walked !== 0 ? walked : owner.facing < 0 ? -1 : 1;
  }

  if (partner.behavior === "flying" && placed.mode !== CompanionMode.lunge && placed.mode !== CompanionMode.stunned) {
    const height = f32(owner.motion.z + (partner.followHeight ?? 0.0));
    placed.z = f32(placed.z + min(partner.followSpeed, max(-partner.followSpeed, f32(height - placed.z))));
  }
  const surface = partner.behavior === "flying" ? undefined : placed.surface;
  if (surface !== undefined) {
    const left = f32(surfaceLeft(stage, surface, matchFrame) + partner.bite.radius);
    const right = f32(surfaceRight(stage, surface, matchFrame) - partner.bite.radius);
    placed.x = min(right, max(left, placed.x));
    placed.z = surfaceZAt(stage, surface, matchFrame, placed.x);
  }
  placed.apart = owner.status.out || Math.abs(f32(owner.motion.x - placed.x)) > partner.leash ? placed.apart + 1 : 0;
  if (placed.apart >= partner.leashFrames) placed.life = 0;
}


export function staggerCompanion(placed: PlacedObject): void {
  const partner = placed.spec?.companion;
  if (partner === undefined || placed.mode !== CompanionMode.lunge) return;
  placed.mode = CompanionMode.stunned;
  placed.modeFrame = 0;
}
