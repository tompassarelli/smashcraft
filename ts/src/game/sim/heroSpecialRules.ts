// Executes the expansion heroes' authored specials (heroSpecials.ts) and the
// roster's mana contract: costs spent once on entry, the free up special,
// grounded regeneration, strike paths, motion, projectiles, intangible and
// armor windows, airtime limits and helpless ends. Every value it changes is
// fighter state, so rollback restores it with the fighter.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { ProjectileKind, SpecialAction } from "./codes";
import { canAttack, inGrabContext, isIntangible } from "./conditions";
import type { Fighter } from "./fighter";
import { type FighterSpecials, type AuthoredSpecial, type SpecialProjectile, SpecialForm, SpecialSlot, specialForm, specialKit } from "./heroSpecials";
import { type HitRegion, NO_HIT_REGION } from "./hitRegions";
import type { Controls } from "./roster";
import { capsuleCircleIntersects, shieldSizeMultiplier } from "./shield";
import { emptyCapsule, placeCapsule } from "../physics/contactGeometry";
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

/** Whether the move's projectiles fit under their own limits and the fighter's cap. */
function projectilesFit(f: Readonly<Fighter>, move: Readonly<AuthoredSpecial>): boolean {
  const projectiles = move.projectiles ?? [];
  if (projectiles.length === 0) return true;
  if (ownedCount(f, undefined) + projectiles.length > HERO_PROJECTILE_CAP) return false;
  for (const spec of projectiles) if (ownedCount(f, spec) >= spec.limit) return false;
  return true;
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
export function chooseHeroSpecial(f: Readonly<Fighter>, specials: Readonly<FighterSpecials>, input: Readonly<Controls>, out: { manaShort: boolean }): HeroSpecialChoice | undefined {
  out.manaShort = false;
  const slot = requestedSlot(input);
  const kit = specialKit(specials, slot);
  const airborne = !f.motion.grounded;
  let form: SpecialForm = airborne && kit.air !== undefined ? SpecialForm.air : SpecialForm.ground;
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

/** A new stock starts with full mana and its airtime uses restored. */
export function refillMana(f: Fighter): void {
  const profile = f.tuning.specials?.mana;
  f.mana.points = profile?.max ?? 0;
  f.mana.sinceSpend = profile?.regenDelayFrames ?? 0;
  f.mana.progress = 0;
  f.special.airtimeUses = 0;
}

/** Spends the chosen form's cost and records the entry; the caller has started the action. */
export function enterHeroSpecial(f: Fighter, chosen: Readonly<HeroSpecialChoice>, input: Readonly<Controls>): AuthoredSpecial {
  const specials = f.tuning.specials;
  if (specials === undefined) throw new Error("hero special without a kit");
  const move = specialForm(specialKit(specials, chosen.slot), chosen.form);
  const { special, mana } = f;
  special.form = chosen.form;
  const aimX = input.specialX !== 0 ? input.specialX : input.direction;
  const aimZ = input.specialZ !== 0 ? input.specialZ : input.verticalDirection;
  special.aimX = aimX < 0 ? -1 : aimX > 0 ? 1 : 0;
  special.aimZ = aimZ < 0 ? -1 : aimZ > 0 ? 1 : 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) special.hitTargets[entry] = undefined;
  special.hit = false;
  if (move.cost > 0) {
    mana.points = max(0, mana.points - move.cost);
    mana.sinceSpend = 0;
    mana.progress = 0;
  }
  if (move.oncePerAirtime === true) special.airtimeUses |= 1 << chosen.slot;
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
    }
  } else if (armor !== undefined && (inWindow(armor, frame + 1) || inWindow(armor, frame))) {
    status.armorFrames = max(status.armorFrames, inWindow(armor, frame + 1) ? 2 : 1);
    status.armorMaxDamage = armor.maxDamage;
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
export const pressedBackward = (f: Readonly<Fighter>): boolean => f.special.aimX !== 0 && f.special.aimX === -f.facing;

function spawnHeroProjectile(owner: Fighter, spec: Readonly<SpecialProjectile>, serial: number, stage: number): void {
  const offsetX = spec.backOffsetX !== undefined && pressedBackward(owner) ? spec.backOffsetX : spec.offsetX;
  const x = f32(owner.motion.x + f32(owner.facing * offsetX));
  const z = f32(owner.motion.z + spec.offsetZ);
  if (spec.needsLineOfSight === true && !clearLine(stage, owner.motion.x, z, x, z)) return;
  for (const projectile of owner.projectiles) {
    if (projectile.life > 0) continue;
    const up = owner.special.aimZ > 0 && spec.upVelocityX !== undefined;
    const velocityX = up ? spec.upVelocityX ?? spec.velocityX : spec.velocityX;
    const velocityZ = up ? spec.upVelocityZ ?? spec.velocityZ : spec.velocityZ;
    projectile.kind = ProjectileKind.hero;
    projectile.spec = spec;
    projectile.visualFamily = owner.character;
    projectile.direction = owner.facing < 0 ? -1 : 1;
    projectile.velocityX = f32(owner.facing * velocityX);
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
    let velocityZ = segment.offsetsGravity === true ? f32(segment.velocityZ + f.tuning.physics.gravity) : segment.velocityZ;
    if (segment.aimedSpeed !== undefined && (special.aimX !== 0 || special.aimZ !== 0)) {
      const scale = special.aimX !== 0 && special.aimZ !== 0 ? f32(segment.aimedSpeed * DIAGONAL) : segment.aimedSpeed;
      velocityX = f32(special.aimX * scale);
      velocityZ = f32(special.aimZ * scale);
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

/** Whether the running special steers horizontally itself (driftSpeed), replacing the shared air drift. */
export function heroSpecialSteers(f: Readonly<Fighter>): boolean {
  const move = runningHeroSpecial(f);
  if (move === undefined) return false;
  const frame = f.special.frame;
  for (const segment of move.motion ?? []) if (segment.driftSpeed !== undefined && frame >= segment.first && frame <= segment.last) return true;
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

/** One frame of a running hero special, after its frame counter advanced. */
export function advanceHeroSpecial(f: Fighter, stage = 0, input?: Readonly<Controls>): void {
  const move = runningHeroSpecial(f);
  if (move === undefined) return;
  const frame = f.special.frame;
  applyMotion(f, move, frame, input);
  for (const spec of move.projectiles ?? []) if (spec.spawnFrame === frame) spawnHeroProjectile(f, spec, f.attack.serial + 1, stage);
  applyWindows(f, move, frame);
  if (frame >= move.endFrame) endHeroSpecial(f, move);
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

/** One frame of a fighter's hero armor, hitlag included. */
export function advanceHeroStatus(f: Fighter): void {
  if (f.status.armorFrames > 0) f.status.armorFrames--;
}

/** Whether a special action is off cooldown; hero actions have none and spend mana when they start. */
export function specialCooldownReady(f: Readonly<Fighter>, action: number): boolean {
  return isHeroSpecialAction(action) || (f.special.cooldowns[action] ?? 0) <= 0;
}
