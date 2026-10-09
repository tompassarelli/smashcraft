



import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { idiv } from "wisp/src/sim/intMath";
import { applyItemBuffFor } from "./itemBuffs";
import { advanceHeroConditions, cleansePoisonAndSlow } from "./heroStatus";
import { AttackStyle, ProjectileKind, SpecialAction } from "./codes";
import { mutableProjectile } from "./fighterProjectiles";
import { canAttack, inGrabContext, isIntangible } from "./conditions";
import { type Fighter, placedObject } from "./fighter";
import { type FighterSpecials, type AuthoredSpecial, CompanionMode, CompanionOrder, type SpecialFollowUp, type SpecialGuard, type SpecialKit, type SpecialPlacement, type SpecialProjectile, FOLLOW_UP_FORM, FollowUpInput, Relocation, SpecialForm, SpecialSlot, specialForm, specialKit } from "./heroSpecials";
import { type HitRegion, NO_HIT_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { type Controls, type Roster, fighterAt, isActive } from "./roster";
import { travelBeforeBodies } from "./travelStop";
import { gainMana } from "./mana";
import { endDivineShield } from "./transitions";
import { capsuleCircleIntersects, shieldSizeMultiplier } from "./shield";
import { shieldCenterX, shieldCenterZ } from "./shieldTilt";
import { attackCapsule, emptyCapsule, placeCapsule, segmentBoxesOverlap } from "../physics/contactGeometry";
import { HurtContact, strikeHurtContact } from "./hurtboxes";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { solidSurfaceAt, solidSurfaceCount } from "./stage";


const DIAGONAL = 0.7071067690849304;

export const HERO_PROJECTILE_CAP = 3;

export const isHeroSpecialAction = (action: number): boolean => action >= SpecialAction.heroNeutral && action <= SpecialAction.heroUltimate;


export function ultimateForm(ultimate: Readonly<AuthoredSpecial>, form: number): AuthoredSpecial {
  return form >= FOLLOW_UP_FORM ? ultimate.followUps?.[idiv(form, FOLLOW_UP_FORM) - 1]?.special ?? ultimate : ultimate;
}


export function runningHeroSpecial(f: Readonly<Fighter>): AuthoredSpecial | undefined {
  if (f.special.action === SpecialAction.heroUltimate) {
    const ultimate = f.tuning.ultimate;
    return ultimate === undefined ? undefined : ultimateForm(ultimate, f.special.form);
  }
  const specials = f.tuning.specials;
  if (specials === undefined || !isHeroSpecialAction(f.special.action)) return undefined;
  return specialForm(specialKit(specials, f.special.action - SpecialAction.heroNeutral), f.special.form, f.special.ex);
}

function requestedSlot(input: Readonly<Controls>): SpecialSlot {
  return input.specialZ > 0 ? SpecialSlot.up : input.specialZ < 0 ? SpecialSlot.down : input.specialX !== 0 ? SpecialSlot.side : SpecialSlot.neutral;
}

function ownedCount(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero && (spec === undefined || projectile.spec === spec)) count++;
  return count;
}


export function markedTarget(world: Roster, f: Readonly<Fighter>, range: number): Fighter | undefined {
  let nearest: Fighter | undefined;
  let distance = 0.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const other = fighterAt(world, slot);
    if (other === f || other.status.out || other.status.poisonFrames <= 0) continue;
    const dx = Math.abs(f32(other.motion.x - f.motion.x));
    if (dx > range || Math.abs(f32(other.motion.z - f.motion.z)) > range || (nearest !== undefined && dx >= distance)) continue;
    nearest = other;
    distance = dx;
  }
  return nearest;
}


function recallProjectiles(f: Fighter): void {
  let index = -1;
  for (const projectile of f.projectiles) {
    index++;
    const returns = projectile.spec?.returns;
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || returns === undefined || projectile.spec === undefined || projectile.damageMultiplier !== 1.0) continue;
    mutableProjectile(f, index).life = min(projectile.life, projectile.spec.life - returns.age);
  }
}


function projectilesFit(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  const projectiles = move.projectiles ?? [];
  if (projectiles.length === 0) return true;
  if (ownedCount(f, undefined) + projectiles.length > HERO_PROJECTILE_CAP) return false;
  for (let index = 0; index < projectiles.length; index++) {
    const spec = at(projectiles, index);
    const upgraded = move.ex?.projectiles?.[index];
    const exCount = upgraded === undefined || upgraded === spec ? 0 : ownedCount(f, upgraded);
    if (ownedCount(f, spec) + exCount >= spec.limit) return false;
  }
  return true;
}


function recallHolds(f: Readonly<Fighter>, kit: Readonly<SpecialKit>): boolean {
  if (kit.recallWhile === "armor") return f.status.armorFrames > 0;
  if (kit.recallWhile === "projectile") {
    const spec = kit.ground.projectiles?.[0];
    const exSpec = kit.ground.ex?.projectiles?.[0];
    return (spec !== undefined && ownedCount(f, spec) > 0) || (exSpec !== undefined && ownedCount(f, exSpec) > 0);
  }
  return (kit.recallGroundOnly !== true || f.motion.grounded) && placedObject(f, kit.ground.placement?.slot).life > 0;
}


export interface SpecialRefusal {
  groundOnly: boolean;
}

export interface HeroSpecialChoice {
  slot: SpecialSlot;
  form: SpecialForm;
}


const choice: HeroSpecialChoice = { slot: SpecialSlot.neutral, form: SpecialForm.ground };





export function chooseHeroSpecial(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, input: Readonly<Controls>, out: SpecialRefusal, world?: Roster): HeroSpecialChoice | undefined {
  out.groundOnly = false;
  const slot = requestedSlot(input);
  if ((f.special.cooldowns[SpecialAction.heroNeutral + slot] ?? 0) > 0) return undefined;
  const kit = specialKit(specials, slot);
  const airborne = !f.motion.grounded;
  const recalls = kit.recall !== undefined && recallHolds(f, kit);
  const marks = kit.marked !== undefined && world !== undefined && markedTarget(world, f, kit.marked.range) !== undefined;
  const form: SpecialForm = recalls ? SpecialForm.recall : marks ? SpecialForm.marked : airborne && kit.air !== undefined ? SpecialForm.air : SpecialForm.ground;
  const move = specialForm(kit, form);
  if (move.groundOnly === true && airborne) {
    out.groundOnly = true;
    return undefined;
  }
  if (move.armor?.shell === true && f.status.armorFrames > 0) return undefined;
  if (move.oncePerAirtime === true && airborne && (f.special.airtimeUses & (1 << slot)) !== 0) return undefined;
  if (move.command?.order === CompanionOrder.lunge && !companionReady(f, move.command.slot)) return undefined;
  if (!projectilesFit(f, move)) return undefined;
  choice.slot = slot;
  choice.form = form;
  return choice;
}


export function resetSpecialOnStock(f: Fighter): void {
  f.special.airtimeUses = 0;
}


const SECTOR_TANGENT = 0.41421356797218323;






export function chargedAimX(input: Readonly<Controls>): number {
  if (input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0)) {
    return Math.abs(input.diStickX) > f32(SECTOR_TANGENT * Math.abs(input.diStickZ)) ? (input.diStickX < 0 ? -1 : 1) : 0;
  }
  return input.direction < 0 ? -1 : input.direction > 0 ? 1 : 0;
}


export function chargedAimZ(input: Readonly<Controls>): number {
  if (input.diStickValid && (input.diStickX !== 0 || input.diStickZ !== 0)) {
    return Math.abs(input.diStickZ) > f32(SECTOR_TANGENT * Math.abs(input.diStickX)) ? (input.diStickZ < 0 ? -1 : 1) : 0;
  }
  return input.verticalDirection < 0 ? -1 : input.verticalDirection > 0 ? 1 : 0;
}


export function steerHeroSpecial(f: Fighter, input: Readonly<Controls>): void {
  const move = runningHeroSpecial(f);
  if (move?.aimFrames === undefined || f.special.frame >= move.aimFrames) return;
  const x = chargedAimX(input);
  const z = chargedAimZ(input);
  if (x === 0 && z === 0) return;
  f.special.aimX = x;
  f.special.aimZ = z;
}


export function enterHeroSpecial(f: Fighter, chosen: Readonly<HeroSpecialChoice>, input: Readonly<Controls>): AuthoredSpecial {
  const specials = f.tuning.specials;
  if (specials === undefined) throw new Error("hero special without a kit");
  const move = specialForm(specialKit(specials, chosen.slot), chosen.form, f.special.ex);
  const { special } = f;
  endDivineShield(f);
  special.form = chosen.form;
  special.grabFrame = 0;
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  special.guarded = false;
  special.cooldowns[SpecialAction.heroNeutral + chosen.slot] = move.cooldownFrames ?? 0;
  if (move.oncePerAirtime === true) special.airtimeUses |= 1 << chosen.slot;
  if (move.recallsProjectiles === true) recallProjectiles(f);
  applyWindows(f, move, 0);
  return move;
}

const inWindow = (window: { readonly first: number; readonly last: number } | undefined, frame: number): boolean =>
  window !== undefined && frame >= window.first && frame <= window.last;





function applyWindows(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number): void {
  const { status } = f;
  if (inWindow(move.intangible, frame + 1)) status.invincible = max(status.invincible, 2);
  else if (inWindow(move.intangible, frame)) status.invincible = max(status.invincible, 1);
  const armor = move.armor;
  if (armor?.shell === true) {

    if (frame + 1 === armor.first) {
      status.armorFrames = armor.last - armor.first + 2;
      status.armorMaxDamage = armor.maxDamage;
      status.armorChills = armor.chillsStriker === true;
    }
  } else if (armor !== undefined && (inWindow(armor, frame + 1) || inWindow(armor, frame))) {
    status.armorFrames = max(status.armorFrames, inWindow(armor, frame + 1) ? 2 : 1);
    status.armorMaxDamage = armor.maxDamage;
    status.armorChills = false;
  }
}


function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  if (!segmentBoxesOverlap(ax, az, bx, bz, cx, cz, dx, dz)) return false;
  const side = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number): number =>
    f32(f32(f32(qx - px) * f32(rz - pz)) - f32(f32(qz - pz) * f32(rx - px)));
  const c = side(ax, az, bx, bz, cx, cz);
  const d = side(ax, az, bx, bz, dx, dz);
  const a = side(cx, cz, dx, dz, ax, az);
  const b = side(cx, cz, dx, dz, bx, bz);
  return ((c > 0 && d < 0) || (c < 0 && d > 0)) && ((a > 0 && b < 0) || (a < 0 && b > 0));
}


function clearLine(stage: number, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
  for (let index = 0; index < solidSurfaceCount(stage); index++) {
    const surface = solidSurfaceAt(stage, index);
    if (segmentsCross(fromX, fromZ, toX, toZ, surface.startX, surface.startZ, surface.endX, surface.endZ)) return false;
  }
  return true;
}

function nearestFoe(world: Roster | undefined, owner: Readonly<Fighter>): Fighter | undefined {
  if (world === undefined) return undefined;
  let nearest: Fighter | undefined;
  let distance = 0.0;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const other = fighterAt(world, slot);
    if (other === owner || other.status.out) continue;
    const dx = Math.abs(f32(other.motion.x - owner.motion.x));
    if (nearest !== undefined && dx >= distance) continue;
    nearest = other;
    distance = dx;
  }
  return nearest;
}

function spawnHeroProjectile(owner: Fighter, spec: Readonly<SpecialProjectile>, serial: number, stage: number, world?: Roster): void {
  const foe = spec.atFoe === true ? nearestFoe(world, owner) : undefined;
  const x = foe !== undefined ? foe.motion.x : f32(owner.motion.x + f32(owner.facing * spec.offsetX));
  const z = foe !== undefined ? f32(foe.motion.z + spec.offsetZ) : f32(owner.motion.z + spec.offsetZ);
  if (spec.needsLineOfSight === true && !clearLine(stage, owner.motion.x, z, x, z)) return;
  const up = owner.special.aimZ > 0 && spec.upVelocityX !== undefined;
  spawnHeroProjectileAt(owner, spec, x, z, owner.facing, up, serial);
}


export function spawnHeroProjectileAt(owner: Fighter, spec: Readonly<SpecialProjectile>, x: number, z: number, facing: number, up: boolean, serial: number): void {
  let index = -1;
  for (const before of owner.projectiles) {
    index++;
    if (before.life > 0) continue;
    const projectile = mutableProjectile(owner, index);
    const velocityX = up ? spec.upVelocityX ?? spec.velocityX : spec.velocityX;
    const velocityZ = up ? spec.upVelocityZ ?? spec.velocityZ : spec.velocityZ;
    projectile.kind = ProjectileKind.hero;
    projectile.spec = spec;
    projectile.visualFamily = owner.character;

    projectile.direction = f32(facing * velocityX) < 0 ? -1 : f32(facing * velocityX) > 0 ? 1 : facing < 0 ? -1 : 1;
    projectile.velocityX = f32(facing * velocityX);
    projectile.velocityZ = velocityZ;
    projectile.x = x;
    projectile.z = z;
    projectile.serial = serial;
    projectile.damageMultiplier = 1.0;
    projectile.newlyReflected = false;
    projectile.exReach = false;
    projectile.poolHits = 0;
    projectile.poolWait = 0;
    projectile.life = spec.life;
    return;
  }
}

function applyMotion(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number, input: Readonly<Controls> | undefined): void {
  const { motion, special } = f;
  if (special.grabFrame > 0 && move.commandGrab !== undefined) return;
  for (const segment of move.motion ?? []) {
    if (frame < segment.first || frame > segment.last) continue;
    let velocityX = f32(f.facing * segment.velocityX);
    let velocityZ = segment.velocityZ;
    if (segment.aimedSpeed !== undefined && (special.aimX !== 0 || special.aimZ !== 0)) {
      const scale = special.aimX !== 0 && special.aimZ !== 0 ? f32(segment.aimedSpeed * DIAGONAL) : segment.aimedSpeed;
      velocityX = f32(special.aimX * scale);
      velocityZ = f32(special.aimZ * scale);
    } else if (segment.aimedTilt !== undefined && special.aimZ !== 0) {
      velocityX = f32(velocityX * segment.aimedTilt.x);
      velocityZ = f32(f32(special.aimZ * Math.abs(segment.velocityX)) * segment.aimedTilt.z);
    }
    if (segment.driftSpeed !== undefined && input !== undefined) {
      const stick = input.diStickValid ? input.diStickX : input.direction;
      velocityX = f32(velocityX + f32(min(1.0, max(-1.0, stick)) * segment.driftSpeed));
    }
    if (segment.liftSpeed !== undefined && input !== undefined) {
      const stick = input.diStickValid ? input.diStickZ : input.verticalDirection;
      velocityZ = f32(velocityZ + f32(min(1.0, max(-1.0, stick)) * segment.liftSpeed));
    }
    motion.vx = velocityX;
    motion.vz = velocityZ;
    if (velocityZ > 0 && motion.grounded) {
      motion.grounded = false;
      motion.surface = undefined;
    }
  }
}


export function companionReady(f: Readonly<Fighter>, slot = 0): boolean {
  const placed = placedObject(f, slot);
  return placed.life > 0 && placed.spec?.companion !== undefined && (placed.mode === CompanionMode.follow || placed.mode === CompanionMode.returning);
}


function orderCompanion(f: Fighter, order: CompanionOrder, slot = 0): void {
  const placed = placedObject(f, slot);
  if (placed.life <= 0 || placed.spec?.companion === undefined) return;
  if (order === CompanionOrder.lunge) {
    if (!companionReady(f, slot)) return;
    placed.mode = CompanionMode.lunge;
    placed.direction = f.facing < 0 ? -1 : 1;
    placed.bitten = 0;
    placed.modeFrame = 0;
  } else if (placed.mode !== CompanionMode.stunned) {
    placed.mode = CompanionMode.returning;
    placed.modeFrame = 0;
  }
}


function placeObject(f: Fighter, spec: Readonly<SpecialPlacement>): void {
  const placed = placedObject(f, spec.slot);
  if (spec.keepExisting === true && placed.life > 0) return;
  placed.life = spec.life;
  placed.age = 0;
  placed.x = f32(f.motion.x + f32(f.facing * spec.offsetX));
  placed.z = f32(f.motion.z + (spec.offsetZ ?? 0.0));
  placed.direction = f.facing < 0 ? -1 : 1;
  placed.durability = spec.durability;
  placed.serial++;
  placed.spec = spec;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) placed.struck[slot] = undefined;
  placed.specialStruck = 0;
  placed.mode = CompanionMode.follow;
  placed.modeFrame = 0;
  placed.apart = 0;
  placed.bitten = 0;
  placed.surface = f.motion.surface;
}






export function heroMotionHolds(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  if (move === undefined) return false;
  for (const segment of move.motion ?? []) if (f.special.frame >= segment.first && f.special.frame <= segment.last) return true;
  return false;
}


function endHeroSpecial(f: Fighter, move: Readonly<AuthoredSpecial>): void {
  if (move.helpless === true && !f.motion.grounded) {
    f.special.fall = true;
    f.jump.remaining = 0;
  }
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
}


function burstProjectiles(f: Fighter, from: Readonly<SpecialProjectile>, into: Readonly<SpecialProjectile>): void {
  const specials = f.tuning.specials;
  const kit = specials === undefined || f.special.action === SpecialAction.heroUltimate ? undefined : specialKit(specials, f.special.action - SpecialAction.heroNeutral);
  const ordinary = kit === undefined ? undefined : specialForm(kit, f.special.form).burst;
  const upgraded = kit === undefined ? undefined : specialForm(kit, f.special.form, true).burst;
  let index = -1;
  for (const before of f.projectiles) {
    index++;
    if (before.life <= 0 || before.kind !== ProjectileKind.hero
      || (before.spec !== from && before.spec !== ordinary?.from && before.spec !== upgraded?.from)) continue;
    const result = upgraded !== undefined && before.spec === upgraded.from ? upgraded.into : into;
    const projectile = mutableProjectile(f, index);
    projectile.spec = result;
    projectile.velocityX = 0.0;
    projectile.velocityZ = 0.0;
    projectile.life = result.life;
  }
}


export function advanceHeroSpecial(f: Fighter, stage = 0, input?: Readonly<Controls>, world?: Roster): void {
  const move = runningHeroSpecial(f);
  if (move === undefined) return;
  const frame = f.special.frame;
  if (move.cleanseFrame === frame) cleansePoisonAndSlow(f);
  if (move.rehits?.includes(frame) === true) for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) f.special.hitTargets[entry] = undefined;
  if (move.buff?.frame === frame) applyItemBuffFor(f, move.buff.kind, move.buff.frames);
  applyMotion(f, move, frame, input);
  for (const spec of move.projectiles ?? []) if (spec.spawnFrame === frame) spawnHeroProjectile(f, spec, f.attack.serial + 1, stage, world);
  if (move.placement?.frame === frame) placeObject(f, move.placement);
  if (move.command?.frame === frame) orderCompanion(f, move.command.order, move.command.slot);
  if (move.burst?.frame === frame) burstProjectiles(f, move.burst.from, move.burst.into);
  if (move.ritual?.frame === frame) {
    f.status.armorFrames = 0;
    f.status.armorChills = false;
    gainMana(f, move.ritual.mana);
  }
  applyWindows(f, move, frame);
  if (frame >= heroSpecialEndFrame(f, move)) {
    if (move.recall === true) f.placed.life = 0;
    endHeroSpecial(f, move);
  }
}


export function heroSpecialEndFrame(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number {
  const grab = move.commandGrab;
  return grab !== undefined && f.special.grabFrame > 0 ? f.special.grabFrame + grab.holdFrames + grab.recovery : move.endFrame;
}


export function landHeroSpecial(f: Fighter): boolean {
  const move = runningHeroSpecial(f);
  if (move?.landingLag === undefined) return false;
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
  f.special.lockFrames = 0;
  f.attack.cooldown = 0;
  f.landing.lag = max(f.landing.lag, move.landingLag);
  return true;
}


const strike = emptyCapsule();


export function heroStrikeMeetsShield(owner: Readonly<Fighter>, target: Readonly<Fighter>, region: Readonly<HitRegion>): boolean {
  const path = region.strike;
  if (!target.shield.raised || path === undefined) return false;
  placeCapsule(strike, path, owner.motion.x, owner.motion.z, owner.facing);
  const geometry = target.tuning.shield;
  return capsuleCircleIntersects(strike.x1, strike.z1, strike.x2, strike.z2, strike.radius,
    shieldCenterX(target), shieldCenterZ(target), geometry.radius,
    shieldSizeMultiplier(target.shield.energy, target.shield.strength));
}






export function heroSpecialContact(owner: Readonly<Fighter>, target: Readonly<Fighter>, alreadyHit: boolean): Readonly<HitRegion> {
  const move = runningHeroSpecial(owner);
  if (move === undefined || alreadyHit || owner.launch.hitlag > 0 || target.status.out || isIntangible(target)) return NO_HIT_REGION;
  const regions = move.regions ?? [];
  const frame = owner.special.frame - 1;
  for (let index = 0; index < regions.length; index++) {
    const region = at(regions, index);
    if (frame < region.firstFrame || frame > region.lastFrame || region.hit.strike === undefined) continue;
    placeCapsule(strike, region.hit.strike, owner.motion.x, owner.motion.z, owner.facing);
    const contact = strikeHurtContact(strike, target);
    if (contact === HurtContact.hit || heroStrikeMeetsShield(owner, target, region.hit)) return region.hit;
    if (contact === HurtContact.invincible) return NO_HIT_REGION;
  }
  return NO_HIT_REGION;
}


const guardRegion = emptyHitRegion();
const guardStrike = emptyCapsule();

const ORIGINAL_PROJECTILE_RADIUS = 24.0;


function threatensBody(attacker: Readonly<Fighter>, target: Readonly<Fighter>): boolean {
  if (attacker.status.out) return false;
  const { attack } = attacker;
  if (attack.style !== undefined && attack.style !== AttackStyle.grab) {
    const moves = attacker.tuning.moves;
    for (let index = 0; index < authoredHitRegionCount(attack.style, moves); index++) {
      authoredHitRegion(guardRegion, attacker.character, attack.style, attack.frame, attack.smashChargeFrames, index, moves);
      if (guardRegion.window <= 0 || guardRegion.effect.damage <= 0) continue;
      attackCapsule(guardStrike, attack.style, guardRegion);
      placeCapsule(guardStrike, guardStrike, attacker.motion.x, attacker.motion.z, attacker.facing);
      if (strikeHurtContact(guardStrike, target) !== HurtContact.none) return true;
    }
  }

  const special = runningHeroSpecial(attacker);
  for (const region of special?.regions ?? []) {
    const strike = region.hit.strike;
    if (strike === undefined || attacker.special.frame < region.firstFrame || attacker.special.frame > region.lastFrame || region.hit.effect.damage <= 0) continue;
    placeCapsule(guardStrike, strike, attacker.motion.x, attacker.motion.z, attacker.facing);
    if (strikeHurtContact(guardStrike, target) !== HurtContact.none) return true;
  }
  for (const projectile of attacker.projectiles) {
    if (projectile.life <= 0) continue;
    guardStrike.x1 = projectile.x;
    guardStrike.z1 = projectile.z;
    guardStrike.x2 = f32(projectile.x + projectile.velocityX);
    guardStrike.z2 = f32(projectile.z + projectile.velocityZ);
    guardStrike.radius = projectile.spec?.radius ?? ORIGINAL_PROJECTILE_RADIUS;
    if (strikeHurtContact(guardStrike, target) !== HurtContact.none) return true;
  }
  return false;
}

function guardSucceeds(f: Fighter, guard: Readonly<SpecialGuard>): void {
  const { status } = f;
  f.special.guarded = true;
  if (guard.counter === true) {
    const next = runningHeroSpecial(f)?.followUps?.[0]?.special;
    if (next !== undefined) {
      f.special.form += FOLLOW_UP_FORM;
      enterFollowUp(f, next);
      status.invincible = max(status.invincible, 2);
      return;
    }
  }
  const heal = min(guard.heal, max(0.0, status.damage));
  status.damage = f32(status.damage - heal);
  if (guard.shieldFrames !== undefined) {
    status.invincible = max(status.invincible, guard.shieldFrames);
    status.divineFrames = guard.shieldFrames;
  }
}







export function resolveHeroGuards(world: Roster): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const guard = runningHeroSpecial(f)?.guard;
    if (guard === undefined || f.special.guarded || !inWindow(guard, f.special.frame + 1)) continue;
    for (let other = 0; other < PARTICIPANT_CAPACITY; other++) {
      if (other === slot || !isActive(world, other) || !threatensBody(fighterAt(world, other), f)) continue;
      guardSucceeds(f, guard);
      break;
    }
  }
}


export function advanceHeroStatus(f: Fighter): void {
  if (f.status.armorFrames > 0) f.status.armorFrames--;
  if (f.status.divineFrames > 0) f.status.divineFrames--;
  advanceHeroConditions(f);
}


export function specialCooldownReady(f: Readonly<Fighter>, action: number): boolean {
  return (f.special.cooldowns[action] ?? 0) <= 0;
}





export function stopHeroMotionAtBodies(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const move = runningHeroSpecial(f);
  if (move?.motion === undefined) return;
  const frame = f.special.frame;
  for (const segment of move.motion) {
    if ((segment.stopsAtBody !== true && segment.stopsAtShield !== true) || frame < segment.first || frame > segment.last) continue;
    const forward = f32(f.motion.vx * f.facing);
    if (forward <= 0.0) return;
    f.motion.vx = f32(f.facing * travelBeforeBodies(world, slot, forward, segment.stopsAtBody === true));
    return;
  }
}


const BEHIND_MARK = 60.0;







export function relocateHeroSpecial(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const move = runningHeroSpecial(f);
  if (move?.motion === undefined) return;
  for (const segment of move.motion) {
    if (segment.relocate === undefined || f.special.frame !== segment.first) continue;
    if (segment.relocate === Relocation.placed) {
      const { placed } = f;
      if (placed.life <= 0) return;
      f.motion.x = placed.x;
      f.motion.z = placed.z;
      f.facing = placed.direction;
      placed.life = 0;
    } else {

      const target = markedTarget(world, f, segment.relocateReach ?? 0.0);
      if (target === undefined) return;
      const back = target.facing < 0 ? 1 : -1;
      f.motion.x = f32(target.motion.x + f32(back * BEHIND_MARK));
      f.motion.z = target.motion.z;
      f.facing = -back;
      target.status.poisonFrames = 0;
    }
    f.motion.vx = 0.0;
    f.motion.vz = 0.0;
    f.motion.grounded = false;
    f.motion.surface = undefined;
    return;
  }
}

function followUpPressed(followUp: Readonly<SpecialFollowUp>, input: Readonly<Controls>): boolean {
  const kind = followUp.input ?? FollowUpInput.special;
  return kind === FollowUpInput.attack ? input.attackPressed : kind === FollowUpInput.shield ? input.shieldPressed : input.specialPressed;
}






export function followUpHeroSpecial(f: Fighter, input: Readonly<Controls>): boolean {
  const { special } = f;
  const followUps = runningHeroSpecial(f)?.followUps;
  if (followUps === undefined || special.form >= FOLLOW_UP_FORM || f.launch.hitlag > 0 || f.launch.hitstun > 0) return false;
  let index = 0;
  while (index < followUps.length && !(inWindow(at(followUps, index).window, special.frame + 1) && followUpPressed(at(followUps, index), input))) index++;
  if (index >= followUps.length) return false;
  const followUp = at(followUps, index);
  const next = followUp.special;
  if (followUp.facesStick === true && input.direction !== 0) f.facing = input.direction < 0 ? -1 : 1;
  special.form += FOLLOW_UP_FORM * (index + 1);
  enterFollowUp(f, next);
  return true;
}


function enterFollowUp(f: Fighter, next: Readonly<AuthoredSpecial>): void {
  const { special } = f;
  special.exArmorUsed = special.ex;
  special.frame = 0;
  special.duration = next.endFrame;
  special.lockFrames = next.endFrame;

  f.attack.cooldown = next.endFrame;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  applyWindows(f, next, 0);
}


/** Starts the fighter's ultimate after the special action began (docs/design/ultimates.md). */
export function enterUltimate(f: Fighter, input: Readonly<Controls>): AuthoredSpecial | undefined {
  const move = f.tuning.ultimate;
  if (move === undefined) return undefined;
  const { special } = f;
  endDivineShield(f);
  special.form = 0;
  special.grabFrame = 0;
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  special.guarded = false;
  applyWindows(f, move, 0);
  return move;
}
