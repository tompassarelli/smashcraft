import { at } from "wisp/src/runtime/lookup";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "../sim/fighter";
import { ROSTER_MANA, gainMana } from "../sim/mana";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { STAGE_AT_REST, mainDeckZAt, surfaceCount, surfaceLeft, surfaceMoves, surfacePass, surfaceRight, surfaceZ } from "../sim/stage";
import { bodyTop } from "../sim/surfaces";
import { melee } from "../sim/tuning";
import { itemDraw } from "./centreItem";
import type { MatchState } from "./rules";

const FRAMES_PER_SECOND = 60;

export const DROP_TELEGRAPH_FRAMES = 3 * FRAMES_PER_SECOND;

export const DROP_FIRST_SECONDS = 15;

export const DROP_INTERVAL_MIN_SECONDS = 10;
export const DROP_INTERVAL_MAX_SECONDS = 18;

export const DROP_METER = ROSTER_MANA.exCost;

const DROP_REACH = melee(8.0);

export const DROP_HEIGHT = melee(10.0);

const DROP_POINT_SPAN = 150.0;

const INTERVAL_SALT = 3;
const POINT_SALT = 4;

export interface DropPoint {
  readonly x: number;
  readonly z: number;
}

export interface MatchMeterDrops {

  on: boolean;

  nextSpawnFrame: number;

  nextPoint: number;

  point: number;

  draws: number;

  spawnSerial: number;
  pickupSerial: number;

  lastTaker: number;
}

export function createMatchMeterDrops(): MatchMeterDrops {
  return { on: true, nextSpawnFrame: 0, nextPoint: -1, point: -1, draws: 0, spawnSerial: 0, pickupSerial: 0, lastTaker: -1 };
}

export function copyMatchMeterDrops(target: MatchMeterDrops, source: Readonly<MatchMeterDrops>): void {
  target.on = source.on;
  target.nextSpawnFrame = source.nextSpawnFrame;
  target.nextPoint = source.nextPoint;
  target.point = source.point;
  target.draws = source.draws;
  target.spawnSerial = source.spawnSerial;
  target.pickupSerial = source.pickupSerial;
  target.lastTaker = source.lastTaker;
}

function resetMatchMeterDrops(drops: MatchMeterDrops): void {
  drops.nextSpawnFrame = 0;
  drops.nextPoint = -1;
  drops.point = -1;
  drops.draws = 0;
  drops.spawnSerial = 0;
  drops.pickupSerial = 0;
  drops.lastTaker = -1;
}

export function firstMeterDropsDifference(e: Readonly<MatchMeterDrops>, a: Readonly<MatchMeterDrops>): string | undefined {
  if (e.on !== a.on) return "match.drops.on";
  if (e.nextSpawnFrame !== a.nextSpawnFrame) return "match.drops.nextSpawnFrame";
  if (e.nextPoint !== a.nextPoint) return "match.drops.nextPoint";
  if (e.point !== a.point) return "match.drops.point";
  if (e.draws !== a.draws) return "match.drops.draws";
  if (e.spawnSerial !== a.spawnSerial) return "match.drops.spawnSerial";
  if (e.pickupSerial !== a.pickupSerial) return "match.drops.pickupSerial";
  if (e.lastTaker !== a.lastTaker) return "match.drops.lastTaker";
  return undefined;
}

export function writeMatchMeterDrops(drops: Readonly<MatchMeterDrops>, int: (name: string, value: number) => void, bool: (name: string, value: boolean) => void): void {
  if (!drops.on) bool("match.drops.on", false);
  if (drops.draws === 0 && drops.nextSpawnFrame === 0 && drops.point < 0) return;
  int("match.drops.nextSpawnFrame", drops.nextSpawnFrame);
  int("match.drops.nextPoint", drops.nextPoint);
  int("match.drops.point", drops.point);
  int("match.drops.draws", drops.draws);
  int("match.drops.spawnSerial", drops.spawnSerial);
  int("match.drops.pickupSerial", drops.pickupSerial);
  int("match.drops.lastTaker", drops.lastTaker);
}

const POINTS_BY_STAGE: Record<number, DropPoint[] | undefined> = {};

export function meterDropPoints(stage: number): readonly DropPoint[] {
  const cached = POINTS_BY_STAGE[stage];
  if (cached !== undefined) return cached;
  const points: DropPoint[] = [{ x: 0.0, z: mainDeckZAt(stage, 0.0) }];
  for (let index = 1; index < surfaceCount(stage); index++) {
    if (surfaceMoves(stage, index) || !surfacePass(stage, index)) continue;
    const x = f32(f32(surfaceLeft(stage, index, STAGE_AT_REST) + surfaceRight(stage, index, STAGE_AT_REST)) * 0.5);
    if (Math.abs(x) <= DROP_POINT_SPAN) points.push({ x, z: surfaceZ(stage, index, STAGE_AT_REST) });
  }
  POINTS_BY_STAGE[stage] = points;
  return points;
}

/** The stage's cached point list itself, which only field drop variants (scripts/dropVariants.ts) rewrite. */
export function editableMeterDropPoints(stage: number): DropPoint[] {
  meterDropPoints(stage);
  return POINTS_BY_STAGE[stage] ?? [];
}

export const meterDropPoint = (stage: number, index: number): DropPoint => at(meterDropPoints(stage), index);

const matchHasMeterDrops = (game: Readonly<MatchState>): boolean => game.drops.on && !game.training && !game.run.active;

function scheduleNext(drops: MatchMeterDrops, seed: number, stage: number, from: number): void {
  const count = meterDropPoints(stage).length;
  const seconds = drops.draws === 0 ? DROP_FIRST_SECONDS
    : DROP_INTERVAL_MIN_SECONDS + itemDraw(seed, drops.draws, INTERVAL_SALT, DROP_INTERVAL_MAX_SECONDS - DROP_INTERVAL_MIN_SECONDS + 1);
  drops.nextPoint = drops.draws === 0 ? 0 : floorMod(itemDraw(seed, 0, POINT_SALT, count) + drops.draws, count);
  drops.nextSpawnFrame = from + seconds * FRAMES_PER_SECOND;
  drops.draws++;
}

export function scheduleMeterDrops(game: MatchState): void {
  resetMatchMeterDrops(game.drops);
  if (matchHasMeterDrops(game)) scheduleNext(game.drops, game.matchSeed, game.stageChoice, game.startHold + 1);
}

export function dropTelegraphFrames(drops: Readonly<MatchMeterDrops>, matchFrame: number): number | undefined {
  if (drops.nextSpawnFrame === 0) return undefined;
  const left = drops.nextSpawnFrame - matchFrame;
  return left > 0 && left <= DROP_TELEGRAPH_FRAMES ? left : undefined;
}

export function contestedDropPoint(drops: Readonly<MatchMeterDrops>, matchFrame: number): number {
  if (drops.point >= 0) return drops.point;
  return dropTelegraphFrames(drops, matchFrame) === undefined ? -1 : drops.nextPoint;
}

function touchesDrop(f: Readonly<Fighter>, point: DropPoint): boolean {
  const { x, z } = f.motion;
  return x >= f32(point.x - DROP_REACH) && x <= f32(point.x + DROP_REACH)
    && z <= f32(point.z + DROP_HEIGHT) && z >= f32(point.z - melee(bodyTop(f.character)));
}

export function advanceMeterDrops(game: MatchState, world: Roster): void {
  const { drops } = game;
  if (drops.nextSpawnFrame !== 0 && game.matchFrame >= drops.nextSpawnFrame) {
    drops.point = drops.nextPoint;
    drops.nextSpawnFrame = 0;
    drops.nextPoint = -1;
    drops.spawnSerial++;
  }
  if (drops.point < 0) return;
  const point = meterDropPoint(game.stageChoice, drops.point);
  let taker = -1;
  let nearest = 0.0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (f.status.out || !touchesDrop(f, point)) continue;
    const gap = Math.abs(f32(f.motion.x - point.x));
    if (taker < 0 || gap < nearest) {
      taker = slot;
      nearest = gap;
    }
  }
  if (taker < 0) return;
  gainMana(fighterAt(world, taker), DROP_METER);
  drops.point = -1;
  drops.pickupSerial++;
  drops.lastTaker = taker;
  scheduleNext(drops, game.matchSeed, game.stageChoice, game.matchFrame);
}
