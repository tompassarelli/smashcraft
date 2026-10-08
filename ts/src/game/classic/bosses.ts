// Classic's three lore bosses (#284, smashcraft:docs/design/classic-mode.md,
// "Bosses"). Like Master Hand, a boss is not a fighter: it hovers over the
// stage on its own fixed timetable of strikes, each telegraphed before it can
// hurt, and the player's strikes and projectiles take its health. Following
// the hazard rule (#274), a strike's timing comes from the match clock alone
// and its place from the clock or from where the player stood on the tell's
// first frame; nothing reads a random draw.
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { AttackStyle, ContactKind, HitElement, HitOrigin } from "../sim/codes";
import { isIntangible } from "../sim/conditions";
import { collectDamageContact } from "../sim/contacts";
import { mutableProjectile } from "../sim/fighterProjectiles";
import { type HitEffect, type HitRegion, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../sim/hitRegions";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { capsuleCircleIntersects } from "../sim/shield";
import { BossKind, type BossState } from "./runState";

/** One area a strike hurts, in stage coordinates or, for an aimed strike, offset from its aim. */
export interface BossZone {
  readonly x: number;
  readonly halfWidth: number;
  readonly bottom: number;
  readonly top: number;
}

export interface BossStrike {
  readonly name: string;
  /** Warning frames, then frames the zones hurt, then frames before the next strike's tell. */
  readonly tell: number;
  readonly active: number;
  readonly rest: number;
  /** Zones follow the player's x on the tell's first frame. */
  readonly aimed: boolean;
  readonly zones: readonly BossZone[];
  /** Launches away from the zone's middle when set; straight along `effect` otherwise. */
  readonly away: boolean;
  readonly effect: Readonly<HitEffect>;
  /** Where the boss hovers through this strike. */
  readonly x: number;
  readonly z: number;
}

export interface BossDefinition {
  readonly kind: BossKind;
  readonly name: string;
  readonly stage: 2 | 7 | 10;
  /** Stock model drawn scaled up, and its tint. */
  readonly model: string;
  readonly scale: number;
  readonly tint: readonly [number, number, number];
  /** The model's drawn box while it stands, in model units (x forward, z up), from its visible geosets' vertices. */
  readonly drawn: Readonly<{ min: readonly [number, number, number]; max: readonly [number, number, number] }>;
  /** Where the body stands from the stage origin: this far behind the fighters' plane and this high, so the whole drawn box sits behind the deck inside both camera extremes. */
  readonly depth: number;
  readonly standZ: number;
  /** Health at Rookie; each tier above adds BOSS_HEALTH_PER_TIER. */
  readonly health: number;
  /** The boss's hurt circle around its hover point. */
  readonly radius: number;
  readonly strikes: readonly BossStrike[];
  /** Presentation: the stock effects of a strike's warning and its hit. */
  readonly tellArt: string;
  readonly hitArt: string;
  readonly intro: string;
}

/** Warlock.mdx: body geosets 0-2 and its ground ring 3-4. */
const WARLOCK_DRAWN = { min: [-135.0, -127.0, 0.0], max: [118.0, 127.0, 145.0] } as const;
/** LichKing2.mdx: every geoset, Frostmourne reaching forward to x 143. */
const LICH_KING_DRAWN = { min: [-35.0, -45.0, 0.0], max: [143.0, 45.0, 161.0] } as const;

/** Frames between GO! and the boss's first tell. */
export const BOSS_OPENING_FRAMES = 90;
export const BOSS_HEALTH_PER_TIER = 30;
/** What a projectile without its own hit takes from a boss. */
export const BOSS_PROJECTILE_DAMAGE = 6;

const DECK_HALF = 600.0;
const effect = (damage: number, base: number, growth: number, launchX: number, launchZ: number, element: HitElement): HitEffect =>
  ({ damage, growth, base, launchX, launchZ, electric: false, element });
const column = (x: number, halfWidth: number): BossZone => ({ x, halfWidth, bottom: -60.0, top: 700.0 });
const band = (left: number, right: number, bottom: number, top: number): BossZone => ({ x: (left + right) / 2, halfWidth: (right - left) / 2, bottom, top });

/** Frost: a column at the player, a low sweep to jump over, then a cleave across each half in turn. */
const LICH_KING: BossDefinition = {
  kind: BossKind.lichKing, name: "The Lich King", stage: 2,
  model: "war3mapImported\\LichKing2.mdx", scale: f32(2.6), tint: [190, 220, 255], drawn: LICH_KING_DRAWN, depth: 480.0, standZ: -20.0,
  health: 210, radius: 120.0, tellArt: "Abilities\\Spells\\Undead\\FrostNova\\FrostNovaTarget.mdx", hitArt: "Abilities\\Spells\\Human\\Blizzard\\BlizzardTarget.mdx",
  intro: "Champions of Azeroth. Kneel before the Frozen Throne.",
  strikes: [
    { name: "Howling Blast", tell: 45, active: 10, rest: 35, aimed: true, zones: [column(0.0, 75.0)], away: false, effect: effect(12, 60, 70, 0.0, 1.0, HitElement.ice), x: 0.0, z: 330.0 },
    { name: "Remorseless Winter", tell: 50, active: 12, rest: 40, aimed: false, zones: [band(-DECK_HALF, DECK_HALF, -30.0, 55.0)], away: true, effect: effect(10, 70, 60, f32(0.35), f32(0.94), HitElement.ice), x: -320.0, z: 260.0 },
    { name: "Frostmourne's Cleave", tell: 40, active: 8, rest: 45, aimed: false, zones: [band(0.0, DECK_HALF, -30.0, 230.0)], away: false, effect: effect(16, 80, 85, f32(0.8), f32(0.6), HitElement.ice), x: 320.0, z: 210.0 },
    { name: "Howling Blast", tell: 45, active: 10, rest: 35, aimed: true, zones: [column(0.0, 75.0)], away: false, effect: effect(12, 60, 70, 0.0, 1.0, HitElement.ice), x: 0.0, z: 330.0 },
    { name: "Frostmourne's Cleave", tell: 40, active: 8, rest: 60, aimed: false, zones: [band(-DECK_HALF, 0.0, -30.0, 230.0)], away: false, effect: effect(16, 80, 85, f32(-0.8), f32(0.6), HitElement.ice), x: -320.0, z: 210.0 },
  ],
};

/** Fire: two staggered rains of fire, a Finger of Death at the player, then a ground shockwave to jump. */
const ARCHIMONDE: BossDefinition = {
  kind: BossKind.archimonde, name: "Archimonde", stage: 10,
  model: "Units\\Demon\\Warlock\\Warlock.mdx", scale: f32(2.2), tint: [255, 255, 255], drawn: WARLOCK_DRAWN, depth: 400.0, standZ: -60.0,
  health: 240, radius: 130.0, tellArt: "Abilities\\Spells\\Human\\MarkOfChaos\\MarkOfChaosTarget.mdx", hitArt: "Abilities\\Spells\\Other\\Incinerate\\FireLordDeathExplode.mdx",
  intro: "The World Tree will burn, and your little tournament with it.",
  strikes: [
    { name: "Rain of Fire", tell: 50, active: 14, rest: 20, aimed: false, zones: [column(-450.0, 90.0), column(-150.0, 90.0), column(150.0, 90.0), column(450.0, 90.0)], away: false, effect: effect(9, 50, 70, 0.0, 1.0, HitElement.fire), x: 0.0, z: 360.0 },
    { name: "Rain of Fire", tell: 50, active: 14, rest: 35, aimed: false, zones: [column(-300.0, 90.0), column(0.0, 90.0), column(300.0, 90.0)], away: false, effect: effect(9, 50, 70, 0.0, 1.0, HitElement.fire), x: 0.0, z: 360.0 },
    { name: "Finger of Death", tell: 35, active: 6, rest: 45, aimed: true, zones: [column(0.0, 55.0)], away: false, effect: effect(20, 90, 95, 0.0, 1.0, HitElement.dark), x: 260.0, z: 260.0 },
    { name: "Doom's Shockwave", tell: 45, active: 10, rest: 60, aimed: false, zones: [band(-DECK_HALF, DECK_HALF, -30.0, 50.0)], away: true, effect: effect(12, 70, 70, f32(0.4), f32(0.92), HitElement.fire), x: -260.0, z: 230.0 },
  ],
};

/** Shadow: three Shadow Spikes at the player, Legion Lightning across the air, then Darkness around himself. */
const KILJAEDEN: BossDefinition = {
  kind: BossKind.kiljaeden, name: "Kil'jaeden", stage: 7,
  model: "Units\\Demon\\Warlock\\Warlock.mdx", scale: f32(2.4), tint: [255, 120, 150], drawn: WARLOCK_DRAWN, depth: 420.0, standZ: -60.0,
  health: 270, radius: 130.0, tellArt: "Abilities\\Spells\\Undead\\DeathAndDecay\\DeathAndDecayTarget.mdx", hitArt: "Abilities\\Spells\\Undead\\DeathCoil\\DeathCoilSpecialArt.mdx",
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

/** Where the timetable is on boss frame `clock` (1 is GO!): the strike counted from the first, its phase and the frame within it. */
export interface BossMoment {
  strike: number;
  index: number;
  phase: BossPhase;
  frame: number;
}

// Preallocated: the step and the presentation read the moment every frame.
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

/** The boss clock: frames since GO!. */
export const bossClock = (matchFrame: number, startHold: number): number => Math.max(0, matchFrame - startHold);

/** A zone's centre this strike: its own x, or offset from the aim. */
export const zoneCenter = (strike: Readonly<BossStrike>, zone: Readonly<BossZone>, aimX: number): number => strike.aimed ? f32(aimX + zone.x) : zone.x;

const FIGHTER_HEIGHT = 120.0;

/** Whether a fighter standing at (x, z) is inside the zone. */
export function inZone(strike: Readonly<BossStrike>, zone: Readonly<BossZone>, aimX: number, x: number, z: number): boolean {
  const center = zoneCenter(strike, zone, aimX);
  return Math.abs(f32(x - center)) <= zone.halfWidth && z <= zone.top && f32(z + FIGHTER_HEIGHT) >= zone.bottom;
}

// Preallocated: the hover point the step and the presentation read.
const scratchMoment: BossMoment = { strike: -1, index: 0, phase: BossPhase.opening, frame: 0 };
const hover = { x: 0.0, z: 0.0 };

/** The boss's hover point this frame: it glides to each strike's spot over the first frames of its tell. */
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

/** Inside the damage batch: the strike's aim on its tell's first frame, and its hits while it is active. */
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
      collectDamageContact(world, slot, slot, strike.effect, facing, ContactKind.launch, false, undefined, fighter.shield.raised, undefined, HitOrigin.foreign, undefined, true);
      break;
    }
  }
}

// Preallocated: the player's strikes are tested against the boss every frame.
const region: HitRegion = emptyHitRegion();
const capsule = emptyCapsule();

/** After attacks resolve: the player's strikes and projectiles that reach the boss take its health. */
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
