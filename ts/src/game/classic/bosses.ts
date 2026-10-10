






import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, ContactKind, HitElement } from "../sim/codes";
import { isIntangible } from "../sim/conditions";
import { collectDamageContact } from "../sim/contacts";
import { mutableProjectile } from "../sim/fighterProjectiles";
import { type HitEffect, type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { capsuleCircleIntersects } from "../sim/shield";
import { BossKind, type BossState } from "./runState";


interface BossZone {
  readonly x: number;
  readonly halfWidth: number;
  readonly bottom: number;
  readonly top: number;
}

export interface BossStrike {
  readonly name: string;

  readonly tell: number;
  readonly active: number;
  readonly rest: number;

  readonly aimed: boolean;
  readonly zones: readonly BossZone[];

  readonly away: boolean;
  readonly effect: Readonly<HitEffect>;

  readonly x: number;
  readonly z: number;
}

export interface BossDefinition {
  readonly kind: BossKind;
  readonly name: string;
  readonly stage: 2 | 7 | 10;

  readonly model: string;
  readonly scale: number;
  readonly tint: readonly [number, number, number];

  readonly drawn: Readonly<{ min: readonly [number, number, number]; max: readonly [number, number, number] }>;

  readonly depth: number;
  readonly standZ: number;

  readonly health: number;

  readonly radius: number;
  readonly strikes: readonly BossStrike[];

  readonly hitArt: string;
  readonly intro: string;
}


const WARLOCK_DRAWN = { min: [-135.0, -127.0, 0.0], max: [118.0, 127.0, 145.0] } as const;

const LICH_KING_DRAWN = { min: [-35.0, -45.0, 0.0], max: [143.0, 45.0, 161.0] } as const;


export const BOSS_OPENING_FRAMES = 90;
const BOSS_HEALTH_PER_TIER = 30;

const BOSS_PROJECTILE_DAMAGE = 6;

const DECK_HALF = 600.0;
const effect = (damage: number, base: number, growth: number, launchX: number, launchZ: number, element: HitElement): HitEffect =>
  ({ damage, growth, base, launchX, launchZ, electric: false, element });
const column = (x: number, halfWidth: number): BossZone => ({ x, halfWidth, bottom: -60.0, top: 700.0 });
const band = (left: number, right: number, bottom: number, top: number): BossZone => ({ x: (left + right) / 2, halfWidth: (right - left) / 2, bottom, top });


const LICH_KING: BossDefinition = {
  kind: BossKind.lichKing, name: "The Lich King", stage: 2,
  model: "war3mapImported\\LichKing2.mdx", scale: f32(2.6), tint: [190, 220, 255], drawn: LICH_KING_DRAWN, depth: 480.0, standZ: -20.0,
  health: 210, radius: 120.0, hitArt: "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx",
  intro: "Champions of Azeroth. Kneel before the Frozen Throne.",
  strikes: [
    { name: "Howling Blast", tell: 45, active: 10, rest: 35, aimed: true, zones: [column(0.0, 75.0)], away: false, effect: effect(12, 60, 70, 0.0, 1.0, HitElement.ice), x: 0.0, z: 330.0 },
    { name: "Remorseless Winter", tell: 50, active: 12, rest: 40, aimed: false, zones: [band(-DECK_HALF, DECK_HALF, -30.0, 55.0)], away: true, effect: effect(10, 70, 60, f32(0.35), f32(0.94), HitElement.ice), x: -320.0, z: 260.0 },
    { name: "Frostmourne's Cleave", tell: 40, active: 8, rest: 45, aimed: false, zones: [band(0.0, DECK_HALF, -30.0, 230.0)], away: false, effect: effect(16, 80, 85, f32(0.8), f32(0.6), HitElement.ice), x: 320.0, z: 210.0 },
    { name: "Howling Blast", tell: 45, active: 10, rest: 35, aimed: true, zones: [column(0.0, 75.0)], away: false, effect: effect(12, 60, 70, 0.0, 1.0, HitElement.ice), x: 0.0, z: 330.0 },
    { name: "Frostmourne's Cleave", tell: 40, active: 8, rest: 60, aimed: false, zones: [band(-DECK_HALF, 0.0, -30.0, 230.0)], away: false, effect: effect(16, 80, 85, f32(-0.8), f32(0.6), HitElement.ice), x: -320.0, z: 210.0 },
  ],
};


const ARCHIMONDE: BossDefinition = {
  kind: BossKind.archimonde, name: "Archimonde", stage: 10,
  model: "Units\\Demon\\Warlock\\Warlock.mdx", scale: f32(2.2), tint: [255, 255, 255], drawn: WARLOCK_DRAWN, depth: 400.0, standZ: -60.0,
  health: 240, radius: 130.0, hitArt: "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx",
  intro: "The World Tree will burn, and your little tournament with it.",
  strikes: [
    { name: "Rain of Fire", tell: 50, active: 14, rest: 20, aimed: false, zones: [column(-450.0, 90.0), column(-150.0, 90.0), column(150.0, 90.0), column(450.0, 90.0)], away: false, effect: effect(9, 50, 70, 0.0, 1.0, HitElement.fire), x: 0.0, z: 360.0 },
    { name: "Rain of Fire", tell: 50, active: 14, rest: 35, aimed: false, zones: [column(-300.0, 90.0), column(0.0, 90.0), column(300.0, 90.0)], away: false, effect: effect(9, 50, 70, 0.0, 1.0, HitElement.fire), x: 0.0, z: 360.0 },
    { name: "Finger of Death", tell: 35, active: 6, rest: 45, aimed: true, zones: [column(0.0, 55.0)], away: false, effect: effect(20, 90, 95, 0.0, 1.0, HitElement.dark), x: 260.0, z: 260.0 },
    { name: "Doom's Shockwave", tell: 45, active: 10, rest: 60, aimed: false, zones: [band(-DECK_HALF, DECK_HALF, -30.0, 50.0)], away: true, effect: effect(12, 70, 70, f32(0.4), f32(0.92), HitElement.fire), x: -260.0, z: 230.0 },
  ],
};


const KILJAEDEN: BossDefinition = {
  kind: BossKind.kiljaeden, name: "Kil'jaeden", stage: 7,
  model: "Units\\Demon\\Warlock\\Warlock.mdx", scale: f32(2.4), tint: [255, 120, 150], drawn: WARLOCK_DRAWN, depth: 420.0, standZ: -60.0,
  health: 270, radius: 130.0, hitArt: "Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx",
  intro: "Illidan failed me. You will not even be a disappointment.",
  strikes: [
    { name: "Shadow Spike", tell: 40, active: 8, rest: 12, aimed: true, zones: [column(0.0, 65.0)], away: false, effect: effect(10, 60, 70, 0.0, 1.0, HitElement.dark), x: -200.0, z: 320.0 },
    { name: "Shadow Spike", tell: 40, active: 8, rest: 12, aimed: true, zones: [column(0.0, 65.0)], away: false, effect: effect(10, 60, 70, 0.0, 1.0, HitElement.dark), x: 0.0, z: 340.0 },
    { name: "Shadow Spike", tell: 40, active: 8, rest: 35, aimed: true, zones: [column(0.0, 65.0)], away: false, effect: effect(10, 60, 70, 0.0, 1.0, HitElement.dark), x: 200.0, z: 320.0 },
    { name: "Legion Lightning", tell: 45, active: 12, rest: 40, aimed: false, zones: [band(-DECK_HALF, DECK_HALF, 150.0, 420.0)], away: true, effect: effect(13, 70, 80, f32(0.7), f32(0.7), HitElement.electric), x: 0.0, z: 470.0 },
    { name: "Darkness", tell: 55, active: 14, rest: 70, aimed: false, zones: [band(-260.0, 260.0, -30.0, 400.0)], away: true, effect: effect(18, 90, 90, f32(0.7), f32(0.7), HitElement.dark), x: 0.0, z: 160.0 },
  ],
};

export const BOSSES: readonly BossDefinition[] = [LICH_KING, ARCHIMONDE, KILJAEDEN];

export function bossDefinition(kind: BossKind): BossDefinition | undefined {
  for (const boss of BOSSES) if (boss.kind === kind) return boss;
  return undefined;
}

export const bossHealth = (kind: BossKind, tier: number): number => (bossDefinition(kind)?.health ?? 0) + tier * BOSS_HEALTH_PER_TIER;

const strikeLength = (strike: Readonly<BossStrike>): number => strike.tell + strike.active + strike.rest;

export function bossCycleFrames(boss: Readonly<BossDefinition>): number {
  let frames = 0;
  for (const strike of boss.strikes) frames += strikeLength(strike);
  return frames;
}

export const BossPhase = { opening: 0, tell: 1, active: 2, rest: 3 } as const;
export type BossPhase = (typeof BossPhase)[keyof typeof BossPhase];


export interface BossMoment {
  strike: number;
  index: number;
  phase: BossPhase;
  frame: number;
}


const moment: BossMoment = { strike: -1, index: 0, phase: BossPhase.opening, frame: 0 };

export function bossMoment(boss: Readonly<BossDefinition>, clock: number, out: BossMoment = moment): BossMoment {
  const time = clock - BOSS_OPENING_FRAMES - 1;
  if (time < 0) {
    out.strike = -1;
    out.index = 0;
    out.phase = BossPhase.opening;
    out.frame = clock;
    return out;
  }
  const cycle = bossCycleFrames(boss);
  const cycles = floorDiv(time, cycle);
  let rest = floorMod(time, cycle);
  for (let index = 0; index < boss.strikes.length; index++) {
    const strike = boss.strikes[index];
    if (strike === undefined) continue;
    const length = strikeLength(strike);
    if (rest < length) {
      out.strike = cycles * boss.strikes.length + index;
      out.index = index;
      out.phase = rest < strike.tell ? BossPhase.tell : rest < strike.tell + strike.active ? BossPhase.active : BossPhase.rest;
      out.frame = rest < strike.tell ? rest : rest < strike.tell + strike.active ? rest - strike.tell : rest - strike.tell - strike.active;
      return out;
    }
    rest -= length;
  }
  return out;
}


export const bossClock = (matchFrame: number, startHold: number): number => Math.max(0, matchFrame - startHold);


export const zoneCenter = (strike: Readonly<BossStrike>, zone: Readonly<BossZone>, aimX: number): number => strike.aimed ? f32(aimX + zone.x) : zone.x;

const FIGHTER_HEIGHT = 120.0;


function inZone(strike: Readonly<BossStrike>, zone: Readonly<BossZone>, aimX: number, x: number, z: number): boolean {
  const center = zoneCenter(strike, zone, aimX);
  return Math.abs(f32(x - center)) <= zone.halfWidth && z <= zone.top && f32(z + FIGHTER_HEIGHT) >= zone.bottom;
}


const scratchMoment: BossMoment = { strike: -1, index: 0, phase: BossPhase.opening, frame: 0 };
const hover = { x: 0.0, z: 0.0 };


export function bossPosition(boss: Readonly<BossDefinition>, clock: number): Readonly<{ x: number; z: number }> {
  const now = bossMoment(boss, clock, scratchMoment);
  const strike = boss.strikes[now.index];
  if (strike === undefined) return hover;
  hover.x = strike.x;
  hover.z = strike.z;
  if (now.phase !== BossPhase.tell || now.strike < 0) return hover;
  const previous = boss.strikes[floorMod(now.index - 1, boss.strikes.length)] ?? strike;
  const t = Math.min(1.0, now.frame / 20.0);
  hover.x = f32(previous.x + f32(f32(strike.x - previous.x) * t));
  hover.z = f32(previous.z + f32(f32(strike.z - previous.z) * t));
  return hover;
}


export function collectBossContacts(state: BossState, world: Roster, clock: number, player: number): void {
  const boss = bossDefinition(state.kind);
  if (boss === undefined || state.health <= 0) return;
  const now = bossMoment(boss, clock);
  const strike = boss.strikes[now.index];
  if (strike === undefined || now.strike < 0) return;
  if (now.strike !== state.strike) {
    state.strike = now.strike;
    state.hitMask = 0;
    const x = isActive(world, player) ? fighterAt(world, player).motion.x : 0.0;
    state.aimX = Math.max(-DECK_HALF, Math.min(DECK_HALF, x));
  }
  if (now.phase !== BossPhase.active) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || participantActive(state.hitMask, slot)) continue;
    const fighter = fighterAt(world, slot);
    const { motion, status, launch } = fighter;
    if (status.out || isIntangible(fighter) || launch.hitlag > 0) continue;
    for (const zone of strike.zones) {
      if (!inZone(strike, zone, state.aimX, motion.x, motion.z)) continue;
      state.hitMask |= 1 << slot;
      const facing = strike.away ? (motion.x < zoneCenter(strike, zone, state.aimX) ? -1 : 1) : 1;
      collectDamageContact(world, slot, slot, strike.effect, facing, ContactKind.launch, false, undefined, fighter.shield.raised, undefined, undefined);
      break;
    }
  }
}


const region: HitRegion = emptyHitRegion();
const capsule = emptyCapsule();


export function strikeBoss(state: BossState, world: Roster, clock: number, slot: number): void {
  const boss = bossDefinition(state.kind);
  if (state.flash > 0) state.flash--;
  if (boss === undefined || state.health <= 0 || !isActive(world, slot)) return;
  const { x, z } = bossPosition(boss, clock);
  const fighter = fighterAt(world, slot);
  const { attack } = fighter;
  if (!fighter.status.out && fighter.launch.hitlag === 0 && attack.style !== undefined && attack.style !== AttackStyle.grab) {
    for (let index = 0; index < authoredHitRegionCount(attack.style, fighter.tuning.moves); index++) {
      authoredHitRegion(region, fighter.character, attack.style, attack.frame, attack.smashChargeFrames, index, fighter.tuning.moves);
      if (region.window <= 0 || (state.lastSerial === attack.serial && state.lastWindow >= region.window)) continue;
      attackCapsule(capsule, attack.style, region);
      placeCapsule(capsule, capsule, fighter.motion.x, fighter.motion.z, fighter.facing);
      if (!capsuleCircleIntersects(capsule.x1, capsule.z1, capsule.x2, capsule.z2, capsule.radius, x, z, boss.radius, 1.0)) continue;
      state.lastSerial = attack.serial;
      state.lastWindow = region.window;
      hurtBoss(state, region.effect.damage);
      break;
    }
  }
  for (let index = 0; index < fighter.projectiles.length; index++) {
    const shot = fighter.projectiles[index];
    if (shot === undefined || shot.life <= 0) continue;
    const reach = boss.radius + (shot.spec?.radius ?? 30.0);
    const dx = f32(shot.x - x);
    const dz = f32(shot.z - z);
    if (f32(f32(dx * dx) + f32(dz * dz)) > f32(reach * reach)) continue;
    mutableProjectile(fighter, index).life = 0;
    hurtBoss(state, f32((shot.spec?.effect.damage ?? BOSS_PROJECTILE_DAMAGE) * shot.damageMultiplier));
  }
}

function hurtBoss(state: BossState, damage: number): void {
  state.health = Math.max(0, state.health - Math.max(1, Math.floor(damage)));
  state.flash = 12;
}
