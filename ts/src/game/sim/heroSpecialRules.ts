// Executes the expansion heroes' authored specials (heroSpecials.ts) and the
// roster's mana contract: costs spent once on entry, the free up special,
// grounded regeneration, strike paths, motion, projectiles, intangible and
// armor windows, airtime limits and helpless ends. Every value it changes is
// fighter state, so rollback restores it with the fighter.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { advanceHeroConditions } from "./heroStatus";
import { AttackStyle, ProjectileKind, SpecialAction } from "./codes";
import { canAttack, inGrabContext, isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { type FighterSpecials, type AuthoredSpecial, type SpecialFollowUp, type SpecialGuard, type SpecialKit, type SpecialPlacement, type SpecialProjectile, FOLLOW_UP_FORM, FollowUpInput, Relocation, SpecialForm, SpecialSlot, specialForm, specialKit } from "./heroSpecials";
import { type HitRegion, NO_HIT_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { type Controls, type Roster, fighterAt, isActive } from "./roster";
import { travelBeforeBodies } from "./travelStop";
import { capsuleCircleIntersects, shieldSizeMultiplier } from "./shield";
import { attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { HurtContact, strikeHurtContact } from "./hurtboxes";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { solidSurfaceAt, solidSurfaceCount } from "./stage";

/** Diagonal aim keeps the authored speed. */
const DIAGONAL = 0.7071067690849304;
/** Ordinary traveling projectiles one fighter may own (roster "Projectiles and summons"). */
export const HERO_PROJECTILE_CAP = 3;

export const isHeroSpecialAction = (action: number): boolean => action >= SpecialAction.heroNeutral && action <= SpecialAction.heroDown;

/** The authored special a running hero action uses, if any. */
export function runningHeroSpecial(f: Readonly<Fighter>): AuthoredSpecial | undefined {
  const specials = f.tuning.specials;
  if (specials === undefined || !isHeroSpecialAction(f.special.action)) return undefined;
  return specialForm(specialKit(specials, f.special.action - SpecialAction.heroNeutral), f.special.form);
}

function requestedSlot(input: Readonly<Controls>): SpecialSlot {
  return input.specialZ > 0 ? SpecialSlot.up : input.specialZ < 0 ? SpecialSlot.down : input.specialX !== 0 ? SpecialSlot.side : SpecialSlot.neutral;
}

function ownedCount(f: Readonly<Fighter>, spec: Readonly<SpecialProjectile> | undefined): number {
  let count = 0;
  for (const projectile of f.projectiles) if (projectile.life > 0 && projectile.kind === ProjectileKind.hero && (spec === undefined || projectile.spec === spec)) count++;
  return count;
}

/** The nearest marked (poisoned) opponent of the fighter within `range` on both axes, if any. */
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

/** Turns every outbound returning projectile of the fighter back toward it now. */
function recallProjectiles(f: Fighter): void {
  for (const projectile of f.projectiles) {
    const returns = projectile.spec?.returns;
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || returns === undefined || projectile.spec === undefined || projectile.damageMultiplier !== 1.0) continue;
    projectile.life = min(projectile.life, projectile.spec.life - returns.age);
  }
}

/** Whether the move's projectiles fit under their own limits and the fighter's cap. */
function projectilesFit(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  const projectiles = move.projectiles ?? [];
  if (projectiles.length === 0) return true;
  if (ownedCount(f, undefined) + projectiles.length > HERO_PROJECTILE_CAP) return false;
  for (const spec of projectiles) if (ownedCount(f, spec) >= spec.limit) return false;
  return true;
}

/** Whether the kit's `recall` form is the one a press starts now. */
function recallHolds(f: Readonly<Fighter>, kit: Readonly<SpecialKit>): boolean {
  if (kit.recallWhile === "armor") return f.status.armorFrames > 0;
  if (kit.recallWhile === "projectile") {
    const spec = kit.ground.projectiles?.[0];
    return spec !== undefined && ownedCount(f, spec) > 0;
  }
  return f.placed.life > 0;
}

export interface HeroSpecialChoice {
  slot: SpecialSlot;
  form: SpecialForm;
}

// Preallocated: a special press is resolved every frame during rollback replays.
const choice: HeroSpecialChoice = { slot: SpecialSlot.neutral, form: SpecialForm.ground };

/**
 * The form a press would start, or undefined when it may not: ground-only in
 * the air, already used this airtime, or past an entity limit. Below the full
 * cost, a kit with a free form chooses it; one without refuses (`manaShort`).
 */
export function chooseHeroSpecial(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, input: Readonly<Controls>, out: { manaShort: boolean }, world?: Roster): HeroSpecialChoice | undefined {
  out.manaShort = false;
  const slot = requestedSlot(input);
  const kit = specialKit(specials, slot);
  const airborne = !f.motion.grounded;
  const recalls = kit.recall !== undefined && recallHolds(f, kit);
  const marks = kit.marked !== undefined && world !== undefined && markedTarget(world, f, kit.marked.range) !== undefined;
  let form: SpecialForm = recalls ? SpecialForm.recall : marks ? SpecialForm.marked : airborne && kit.air !== undefined ? SpecialForm.air : SpecialForm.ground;
  let move = specialForm(kit, form);
  if (move.groundOnly === true && airborne) return undefined;
  if (move.armor?.shell === true && f.status.armorFrames > 0) return undefined;
  if (move.cost > f.mana.points) {
    if (kit.free === undefined) {
      out.manaShort = true;
      return undefined;
    }
    form = SpecialForm.free;
    move = kit.free;
  }
  if (move.oncePerAirtime === true && airborne && (f.special.airtimeUses & (1 << slot)) !== 0) return undefined;
  if (!projectilesFit(f, move)) return undefined;
  choice.slot = slot;
  choice.form = form;
  return choice;
}

/** Mana may regenerate: grounded and actionable, not shielding, held, stunned or acting. */
function regenerates(f: Readonly<Fighter>): boolean {
  return f.motion.grounded && !f.status.out && f.attack.style === undefined && f.special.action === SpecialAction.none
    && !inGrabContext(f) && canAttack(f);
}

/** One frame of the roster resource: the spend delay, then a point per eligible `framesPerPoint`. */
export function regenerateMana(f: Fighter): void {
  const profile = f.tuning.specials?.mana;
  if (profile === undefined) return;
  const { mana } = f;
  if (mana.sinceSpend < profile.regenDelayFrames) {
    mana.sinceSpend++;
    return;
  }
  if (mana.points >= profile.max) {
    mana.progress = 0;
    return;
  }
  if (!regenerates(f)) return;
  mana.progress++;
  if (mana.progress >= profile.framesPerPoint) {
    mana.progress = 0;
    mana.points = min(profile.max, mana.points + 1);
  }
}

/** A new stock starts with full mana, its airtime uses restored and no guard healing spent. */
export function refillMana(f: Fighter): void {
  const profile = f.tuning.specials?.mana;
  f.mana.points = profile?.max ?? 0;
  f.mana.sinceSpend = profile?.regenDelayFrames ?? 0;
  f.mana.progress = 0;
  f.special.airtimeUses = 0;
  f.status.guardHealed = 0.0;
}

/** While the running form's `aimFrames` last, a held stick re-chooses its aim. */
export function steerHeroSpecial(f: Fighter, input: Readonly<Controls>): void {
  const move = runningHeroSpecial(f);
  if (move?.aimFrames === undefined || f.special.frame >= move.aimFrames) return;
  if (input.direction === 0 && input.verticalDirection === 0) return;
  f.special.aimX = input.direction < 0 ? -1 : input.direction > 0 ? 1 : 0;
  f.special.aimZ = input.verticalDirection < 0 ? -1 : input.verticalDirection > 0 ? 1 : 0;
}

/** Spends the chosen form's cost and records the entry; the caller has started the action. */
export function enterHeroSpecial(f: Fighter, chosen: Readonly<HeroSpecialChoice>, input: Readonly<Controls>): AuthoredSpecial {
  const specials = f.tuning.specials;
  if (specials === undefined) throw new Error("hero special without a kit");
  const move = specialForm(specialKit(specials, chosen.slot), chosen.form);
  const { special, mana } = f;
  special.form = chosen.form;
  special.grabFrame = 0;
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  special.guarded = false;
  if (move.cost > 0) {
    mana.points = max(0, mana.points - move.cost);
    mana.sinceSpend = 0;
    mana.progress = 0;
  }
  if (move.oncePerAirtime === true) special.airtimeUses |= 1 << chosen.slot;
  if (move.recallsProjectiles === true) recallProjectiles(f);
  applyWindows(f, move, 0);
  return move;
}

const inWindow = (window: { readonly first: number; readonly last: number } | undefined, frame: number): boolean =>
  window !== undefined && frame >= window.first && frame <= window.last;

/**
 * Contacts resolve before specials advance in a match step, so the frame
 * resolved next is one past `frame`; protection set now covers it.
 */
function applyWindows(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number): void {
  const { status } = f;
  if (inWindow(move.intangible, frame + 1)) status.invincible = max(status.invincible, 2);
  else if (inWindow(move.intangible, frame)) status.invincible = max(status.invincible, 1);
  const armor = move.armor;
  if (armor?.shell === true) {
    // Armed once; the step's status countdown then runs it through `last`.
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

/** Whether segment a-b properly crosses segment c-d. */
function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const side = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number): number =>
    f32(f32(f32(qx - px) * f32(rz - pz)) - f32(f32(qz - pz) * f32(rx - px)));
  const c = side(ax, az, bx, bz, cx, cz);
  const d = side(ax, az, bx, bz, dx, dz);
  const a = side(cx, cz, dx, dz, ax, az);
  const b = side(cx, cz, dx, dz, bx, bz);
  return ((c > 0 && d < 0) || (c < 0 && d > 0)) && ((a > 0 && b < 0) || (a < 0 && b > 0));
}

/** Whether no solid stage surface lies between two points. */
function clearLine(stage: number, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
  for (let index = 0; index < solidSurfaceCount(stage); index++) {
    const surface = solidSurfaceAt(stage, index);
    if (segmentsCross(fromX, fromZ, toX, toZ, surface.startX, surface.startZ, surface.endX, surface.endZ)) return false;
  }
  return true;
}

/** Whether the special was pressed toward the fighter's back, which keeps its facing. */
const pressedBackward = (f: Readonly<Fighter>): boolean => f.special.aimX !== 0 && f.special.aimX === -f.facing;

function spawnHeroProjectile(owner: Fighter, spec: Readonly<SpecialProjectile>, serial: number, stage: number): void {
  const offsetX = spec.backOffsetX !== undefined && pressedBackward(owner) ? spec.backOffsetX : spec.offsetX;
  const x = f32(owner.motion.x + f32(owner.facing * offsetX));
  const z = f32(owner.motion.z + spec.offsetZ);
  if (spec.needsLineOfSight === true && !clearLine(stage, owner.motion.x, z, x, z)) return;
  const up = owner.special.aimZ > 0 && spec.upVelocityX !== undefined;
  spawnHeroProjectileAt(owner, spec, x, z, owner.facing, up, serial);
}

/** Emits an owned hero projectile at a point along a facing: a caster's spawn point or its placed object's. */
export function spawnHeroProjectileAt(owner: Fighter, spec: Readonly<SpecialProjectile>, x: number, z: number, facing: number, up: boolean, serial: number): void {
  for (const projectile of owner.projectiles) {
    if (projectile.life > 0) continue;
    const velocityX = up ? spec.upVelocityX ?? spec.velocityX : spec.velocityX;
    const velocityZ = up ? spec.upVelocityZ ?? spec.velocityZ : spec.velocityZ;
    projectile.kind = ProjectileKind.hero;
    projectile.spec = spec;
    projectile.visualFamily = owner.character;
    // A projectile sent backward strikes the way it flies.
    projectile.direction = f32(facing * velocityX) < 0 ? -1 : f32(facing * velocityX) > 0 ? 1 : facing < 0 ? -1 : 1;
    projectile.velocityX = f32(facing * velocityX);
    projectile.velocityZ = velocityZ;
    projectile.x = x;
    projectile.z = z;
    projectile.serial = serial;
    projectile.damageMultiplier = 1.0;
    projectile.newlyReflected = false;
    projectile.life = spec.life;
    return;
  }
}

function applyMotion(f: Fighter, move: Readonly<AuthoredSpecial>, frame: number, input: Readonly<Controls> | undefined): void {
  const { motion, special } = f;
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
    motion.vx = velocityX;
    motion.vz = velocityZ;
    if (velocityZ > 0 && motion.grounded) {
      motion.grounded = false;
      motion.surface = undefined;
    }
  }
}

/** Stands the fighter's placed object ahead of its feet, facing its way, with a clean strike record. */
function placeObject(f: Fighter, spec: Readonly<SpecialPlacement>): void {
  const { placed } = f;
  placed.life = spec.life;
  placed.age = 0;
  placed.x = f32(f.motion.x + f32(f.facing * spec.offsetX));
  placed.z = f.motion.z;
  placed.direction = f.facing < 0 ? -1 : 1;
  placed.durability = spec.durability;
  placed.serial++;
  placed.spec = spec;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) placed.struck[slot] = undefined;
  placed.specialStruck = 0;
}

/**
 * Whether the velocity this frame moves by was set by the running special's
 * motion (its window covered the frame just advanced): steering and drag then
 * leave it alone, and so do gravity and the fall-speed cap; collision still applies.
 */
export function heroMotionHolds(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  if (move === undefined) return false;
  for (const segment of move.motion ?? []) if (f.special.frame >= segment.first && f.special.frame <= segment.last) return true;
  return false;
}

/** Ends the action; a helpless form that ends airborne leaves a helpless fall. */
function endHeroSpecial(f: Fighter, move: Readonly<AuthoredSpecial>): void {
  if (move.helpless === true && !f.motion.grounded) {
    f.special.fall = true;
    f.jump.remaining = 0;
  }
  f.special.action = SpecialAction.none;
  f.special.frame = 0;
}

/** Stops each of the fighter's live `from` projectiles where it is and makes it `into`, newly aged. */
function burstProjectiles(f: Fighter, from: Readonly<SpecialProjectile>, into: Readonly<SpecialProjectile>): void {
  for (const projectile of f.projectiles) {
    if (projectile.life <= 0 || projectile.kind !== ProjectileKind.hero || projectile.spec !== from) continue;
    projectile.spec = into;
    projectile.velocityX = 0.0;
    projectile.velocityZ = 0.0;
    projectile.life = into.life;
  }
}

/** One frame of a running hero special, after its frame counter advanced. */
export function advanceHeroSpecial(f: Fighter, stage = 0, input?: Readonly<Controls>): void {
  const move = runningHeroSpecial(f);
  if (move === undefined) return;
  const frame = f.special.frame;
  applyMotion(f, move, frame, input);
  for (const spec of move.projectiles ?? []) if (spec.spawnFrame === frame) spawnHeroProjectile(f, spec, f.attack.serial + 1, stage);
  if (move.placement?.frame === frame) placeObject(f, move.placement);
  if (move.burst?.frame === frame) burstProjectiles(f, move.burst.from, move.burst.into);
  if (move.ritual?.frame === frame) {
    f.status.armorFrames = 0;
    f.status.armorChills = false;
    f.mana.points = min(f.tuning.specials?.mana.max ?? 0, f.mana.points + move.ritual.mana);
  }
  applyWindows(f, move, frame);
  if (frame >= heroSpecialEndFrame(f, move)) {
    if (move.recall === true) f.placed.life = 0;
    endHeroSpecial(f, move);
  }
}

/** The last frame of the running form: a caught command grab ends after its release and recovery. */
export function heroSpecialEndFrame(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): number {
  const grab = move.commandGrab;
  return grab !== undefined && f.special.grabFrame > 0 ? f.special.grabFrame + grab.holdFrames + grab.recovery : move.endFrame;
}

/** Landing ends a form that sets a landing lag; true when it did. */
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

// Preallocated: hit selection builds these capsules for every pair every frame.
const strike = emptyCapsule();

/** Whether the strike path touches the target's raised shield. */
export function heroStrikeMeetsShield(owner: Readonly<Fighter>, target: Readonly<Fighter>, region: Readonly<HitRegion>): boolean {
  const path = region.strike;
  if (!target.shield.raised || path === undefined) return false;
  placeCapsule(strike, path, owner.motion.x, owner.motion.z, owner.facing);
  const geometry = target.tuning.shield;
  return capsuleCircleIntersects(strike.x1, strike.z1, strike.x2, strike.z2, strike.radius,
    f32(target.motion.x + f32(target.facing * geometry.centerX)), f32(target.motion.z + geometry.centerZ), geometry.radius,
    shieldSizeMultiplier(target.shield.energy, target.shield.strength));
}

/**
 * The strike path of the owner's running hero special that reaches the target
 * this frame: the first active region whose path meets its body or shield.
 * Each target is struck once per action.
 */
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

// Preallocated: guards test every opponent's strikes every frame, replays included.
const guardRegion = emptyHitRegion();
const guardStrike = emptyCapsule();
/** Original projectiles carry no radius of their own; the blaster's is the largest. */
const ORIGINAL_PROJECTILE_RADIUS = 24.0;

/** Whether the attacker's damaging melee, hero special strike or projectile overlaps the target's body now. */
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
  // Before this frame's special advance, the frame about to resolve is one past the counter.
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
  const heal = min(min(guard.heal, max(0.0, f32(guard.healCapPerStock - status.guardHealed))), max(0.0, status.damage));
  status.damage = f32(status.damage - heal);
  status.guardHealed = f32(status.guardHealed + heal);
}

/**
 * Runs before this frame's specials advance, after melee selection: a guard
 * whose window covers the frame being resolved succeeds once when any
 * opponent's damaging strike or projectile overlaps the guarding body, though
 * its intangibility lets that strike pass.
 */
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

/** One frame of a fighter's hero armor, hitlag included. */
export function advanceHeroStatus(f: Fighter): void {
  if (f.status.armorFrames > 0) f.status.armorFrames--;
  advanceHeroConditions(f);
}

/** Whether a special action is off cooldown; hero actions have none and spend mana when they start. */
export function specialCooldownReady(f: Readonly<Fighter>, action: number): boolean {
  return isHeroSpecialAction(action) || (f.special.cooldowns[action] ?? 0) <= 0;
}

/**
 * Clamps the forward velocity a running special's `stopsAtBody` motion set
 * this frame so it ends short of a raised shield or another fighter's body.
 */
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

/** How far behind a marked target's body a relocation puts the fighter. */
const BEHIND_MARK = 60.0;

/**
 * On the first frame of a relocating motion window, moves the fighter at
 * once: onto its placed object, which is spent, facing the object's way, or
 * just behind its nearest marked target in reach, facing it.
 * It then falls from rest, so a spot on the deck lands it at once.
 */
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
      // Just behind the marked target, facing it; the mark is spent.
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

/**
 * A fresh press that takes one of the running form's branches inside its
 * window replaces the rest of the action with that follow-up; true when it
 * did. The press tick is the follow-up's frame 1, as an entry is.
 */
export function followUpHeroSpecial(f: Fighter, input: Readonly<Controls>): boolean {
  const { special, mana } = f;
  const followUps = runningHeroSpecial(f)?.followUps;
  if (followUps === undefined || special.form >= FOLLOW_UP_FORM || f.launch.hitlag > 0 || f.launch.hitstun > 0) return false;
  let index = 0;
  while (index < followUps.length && !(inWindow(at(followUps, index).window, special.frame + 1) && followUpPressed(at(followUps, index), input))) index++;
  if (index >= followUps.length) return false;
  const followUp = at(followUps, index);
  const next = followUp.special;
  if (next.cost > mana.points) {
    f.visuals.manaDenied++;
    return false;
  }
  if (followUp.facesStick === true && input.direction !== 0) f.facing = input.direction < 0 ? -1 : 1;
  special.form += FOLLOW_UP_FORM * (index + 1);
  special.frame = 0;
  special.duration = next.endFrame;
  special.lockFrames = next.endFrame;
  // The entry held attacks for the whole base form; a shorter branch frees them at its own end.
  f.attack.cooldown = next.endFrame;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  if (next.cost > 0) {
    mana.points = max(0, mana.points - next.cost);
    mana.sinceSpend = 0;
    mana.progress = 0;
  }
  applyWindows(f, next, 0);
  return true;
}
