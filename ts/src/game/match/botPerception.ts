// Histories retain shared observations. Storage is reused only after every
// live input and replay snapshot has released that sample.
import { at } from "wisp/src/runtime/lookup";
import { botObservationCanonical, realParts, splitFiniteReal, writeCanonicalNumber, writeObservations } from "../replay/canonical";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { createFighter, type Fighter, type Projectile } from "../sim/fighter";
import { fighterAt, isActive, type Controls, type Roster } from "../sim/roster";

import { botChoice } from "./botRandom";
import { CPU_TIERS, type CpuTier } from "./cpuProfiles";
import type { CpuDecisionPolicy } from "./cpuDecisionPolicy";

export const BOT_DIRECTION_MIN_FRAMES = 4;
// Intended turns stay at most 12 frames: a 13-frame hold enters run; only overshoots run.
const reversalDeciles: readonly (readonly number[])[] = [
  [5, 5, 6, 7, 8, 8, 9, 10, 11, 12],
  [4, 5, 6, 6, 7, 7, 8, 9, 11, 12],
  [4, 5, 5, 6, 7, 7, 8, 9, 11, 12],
  [4, 4, 5, 6, 7, 7, 8, 9, 11, 12],
  [4, 4, 5, 5, 6, 6, 7, 8, 10, 12],
];

/** The same committed turn draws the same deadline throughout a replay. */
export function botReversalFrames(chosenFrame: number, slot: ParticipantSlot, tier: CpuTier, executionPercent: number): number {
  const index = CPU_TIERS.indexOf(tier);
  const intended = at(at(reversalDeciles, index), botChoice(chosenFrame, slot * 37 + 811, 10));
  const missed = 100 - executionPercent;
  const speedError = Math.max(0, 7 - intended) * missed;
  const late = botChoice(chosenFrame, slot * 37 + 829, 400) < speedError ? 1 : 0;
  // Rare long holds become actual runs; ordinary timing noise only delays a turn.
  const runChance = at([44, 32, 11, 7, 6], index);
  const overshoot = botChoice(chosenFrame, slot * 37 + 853, 10000) < runChance;
  return overshoot ? 24 + floorDiv(missed, 20) : intended + late;
}
// The slowest supported computer style sees events 42 frames later.
export const BOT_HISTORY_FRAMES = 43;
// Unobserved input buffers, resource plans and hit registries stay neutral.
const EMPTY = createFighter(1, 0.0, 1);

export interface BotObservationFrame {
  readonly frame: number;
  readonly opponents: Slots<Readonly<Fighter> | undefined>;
  /** UNSETTLED until settleObservationChecksum computes it from the immutable sample. */
  checksumFirst: number;
  checksumSecond: number;
}

/**
 * A checksum not computed yet. Only replay checkpoints and saved moments read
 * checksums, so a sample replaced by a correction before then never pays for one.
 */
const UNSETTLED = -1;

export interface BotMemory {
  history: readonly BotObservationFrame[];
  readonly directions: Slots<number>;
  readonly directionFrames: Slots<number>;
}

type ObservationFighter = Fighter & { readonly projectiles: Projectile[] };

interface ObservationEntry {
  readonly sample: { frame: number; opponents: Slots<Fighter | undefined>; checksumFirst: number; checksumSecond: number };
  readonly bodies: Slots<ObservationFighter>;
  readonly arena: ObservationArena;
  references: number;
}
interface ObservationArena { readonly free: ObservationEntry[] }
interface MemoryStorage {
  arena: ObservationArena;
  readonly history: BotObservationFrame[];
  readonly entries: ObservationEntry[];
}
const memoryStorage = new WeakMap<Readonly<BotMemory>, MemoryStorage>();

export function createBotMemory(): BotMemory {
  return { history: [], directions: [0, 0, 0, 0], directionFrames: [0, 0, 0, 0] };
}

function storageFor(memory: Readonly<BotMemory>): MemoryStorage {
  const existing = memoryStorage.get(memory);
  if (existing !== undefined) return existing;
  const arena: ObservationArena = { free: [] };
  const storage: MemoryStorage = { arena, history: [], entries: [] };
  // Saved moments restore plain records; adopt their samples before a live copy.
  for (const sample of memory.history) {
    const bodies: Slots<ObservationFighter> = [createObservation(), createObservation(), createObservation(), createObservation()];
    const entry: ObservationEntry = {
      sample: { frame: sample.frame, opponents: [undefined, undefined, undefined, undefined],
        checksumFirst: sample.checksumFirst, checksumSecond: sample.checksumSecond },
      bodies, arena, references: 1,
    };
    for (const slot of PARTICIPANT_SLOTS) {
      const body = sample.opponents[slot];
      if (body !== undefined) { copyObservation(bodies[slot], body); entry.sample.opponents[slot] = bodies[slot]; }
    }
    storage.entries.push(entry);
    storage.history.push(entry.sample);
  }
  memoryStorage.set(memory, storage);
  return storage;
}

function release(entry: ObservationEntry): void {
  entry.references--;
  if (entry.references === 0) entry.arena.free.push(entry);
}

function createEntry(arena: ObservationArena): ObservationEntry {
  return { sample: { frame: 0, opponents: [undefined, undefined, undefined, undefined], checksumFirst: 0, checksumSecond: 0 },
    bodies: [createObservation(), createObservation(), createObservation(), createObservation()], arena, references: 0 };
}

/** Reserve the live shell's retained-history storage before gameplay callbacks. */
export function reserveBotObservations(memory: BotMemory, count: number): void {
  const { arena } = storageFor(memory);
  while (arena.free.length < count) arena.free.push(createEntry(arena));
}

export function copyBotMemory(target: BotMemory, source: Readonly<BotMemory>): void {
  if (target === source) return;
  const from = storageFor(source);
  const into = storageFor(target);
  // Retained before released, so a sample both hold never reaches the free list.
  for (const entry of from.entries) entry.references++;
  for (const entry of into.entries) {
    entry.references--;
    if (entry.references === 0) entry.arena.free.push(entry);
  }
  into.arena = from.arena;
  const { entries, history } = into;
  let count = 0;
  for (const entry of from.entries) {
    entries[count] = entry;
    history[count] = entry.sample;
    count++;
  }
  if (entries.length > count) {
    entries.length = count;
    history.length = count;
  }
  target.history = history;
  for (const slot of PARTICIPANT_SLOTS) {
    target.directions[slot] = source.directions[slot];
    target.directionFrames[slot] = source.directionFrames[slot];
  }
}

export function clearBotMemory(memory: BotMemory): void {
  const storage = storageFor(memory);
  for (const entry of storage.entries) release(entry);
  storage.entries.length = 0;
  storage.history.length = 0;
  memory.history = storage.history;
  memory.directions.fill(0);
  memory.directionFrames.fill(0);
}

export function firstBotMemoryDifference(expected: Readonly<BotMemory>, actual: Readonly<BotMemory>): string | undefined {
  if (expected.history.length !== actual.history.length) return "history.length";
  for (let index = 0; index < expected.history.length; index++) {
    const e = at(expected.history, index);
    const a = at(actual.history, index);
    if (e.frame !== a.frame) return `history[${index}].frame`;
    if (e === a) continue;
    if (botObservationCanonical(e) !== botObservationCanonical(a)) return `history[${index}].canonical`;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (expected.directions[slot] !== actual.directions[slot]) return `directions[${slot}]`;
    if (expected.directionFrames[slot] !== actual.directionFrames[slot]) return `directionFrames[${slot}]`;
  }
  return undefined;
}

/** A number as copies keep it: signed zeros differ. */
const exact = (a: number, b: number): boolean => a === b && (a !== 0 || 1 / a === 1 / b);
const sameSlot = (a: number | undefined, b: number | undefined): boolean => a === b;

/** Whether two observed bodies hold every field copyObservation copies equal. */
function sameObservation(a: Readonly<Fighter>, b: Readonly<Fighter>): boolean {
  if (a === b) return true;
  if (a.character !== b.character || !exact(a.facing, b.facing)) return false;
  const t = a.tuning;
  const u = b.tuning;
  if (t.moves !== u.moves || t.specials !== u.specials || t.physics !== u.physics || t.surface !== u.surface || t.ground !== u.ground
    || t.dashGrab !== u.dashGrab || t.shield !== u.shield || t.tech !== u.tech || t.shieldBreak !== u.shieldBreak) return false;
  const m = a.motion;
  const n = b.motion;
  if (!exact(m.x, n.x) || !exact(m.z, n.z) || !exact(m.deltaX, n.deltaX) || !exact(m.deltaZ, n.deltaZ) || !exact(m.vx, n.vx) || !exact(m.vz, n.vz)
    || m.grounded !== n.grounded || m.surface !== n.surface) return false;
  const at1 = a.attack;
  const at2 = b.attack;
  if (at1.style !== at2.style || at1.frame !== at2.frame || at1.duration !== at2.duration || at1.serial !== at2.serial || at1.cooldown !== at2.cooldown) return false;
  const s1 = a.special;
  const s2 = b.special;
  if (s1.action !== s2.action || s1.frame !== s2.frame || s1.duration !== s2.duration || s1.lockFrames !== s2.lockFrames || s1.form !== s2.form || s1.grabFrame !== s2.grabFrame) return false;
  if (a.shield.raised !== b.shield.raised || a.shield.stun !== b.shield.stun || a.shield.releaseLag !== b.shield.releaseLag) return false;
  if (a.launch.hitstun !== b.launch.hitstun || a.launch.hitlag !== b.launch.hitlag || !sameSlot(a.hits.lastAttacker, b.hits.lastAttacker)) return false;
  const st = a.status;
  const su = b.status;
  if (st.out !== su.out || st.stocks !== su.stocks || !exact(st.damage, su.damage) || st.invincible !== su.invincible || st.frozenFrames !== su.frozenFrames
    || st.condition !== su.condition || st.conditionFrames !== su.conditionFrames || st.poisonFrames !== su.poisonFrames) return false;
  if (a.landing.lag !== b.landing.lag) return false;
  if (a.down.state !== b.down.state || a.down.frame !== b.down.frame || a.down.direction !== b.down.direction || a.down.faceUp !== b.down.faceUp) return false;
  if (!sameSlot(a.grab.owner, b.grab.owner) || !sameSlot(a.grab.target, b.grab.target) || a.grab.action !== b.grab.action) return false;
  if (a.ledge.state !== b.ledge.state || a.ledge.side !== b.ledge.side || a.ledge.intangible !== b.ledge.intangible) return false;
  const d1 = a.dodge;
  const d2 = b.dodge;
  if (d1.groundFrame !== d2.groundFrame || d1.groundDirection !== d2.groundDirection || d1.airDodging !== d2.airDodging || d1.airFrame !== d2.airFrame) return false;
  if (a.surfaceRecovery.state !== b.surfaceRecovery.state || a.surfaceRecovery.frame !== b.surfaceRecovery.frame || !sameSlot(a.cannon.held, b.cannon.held)) return false;
  if (a.bear.life !== b.bear.life || !exact(a.bear.x, b.bear.x) || !exact(a.bear.z, b.bear.z) || a.bear.hitSerial !== b.bear.hitSerial) return false;
  const p = a.projectiles;
  const q = b.projectiles;
  if (p.length !== q.length) return false;
  for (let index = 0; index < p.length; index++) {
    const x = p[index];
    const y = q[index];
    if (x === y) continue;
    if (x === undefined || y === undefined) return false;
    if (x.life !== y.life || !exact(x.x, y.x) || !exact(x.z, y.z) || !exact(x.direction, y.direction) || !exact(x.velocityX, y.velocityX)
      || !exact(x.velocityZ, y.velocityZ) || x.serial !== y.serial) return false;
  }
  return true;
}

// Samples sameBotMemory found equal, keyed by the second. A sample's
// observations never change while a history holds it, so a pair stays equal
// until either is reused (observeOpponents); a repair's convergence checks
// then compare each pair once.
const reuses = new WeakMap<BotObservationFrame, number>();
const equalTo = new WeakMap<BotObservationFrame, BotObservationFrame>();
const equalToReuse = new WeakMap<BotObservationFrame, number>();

/** Whether two memories hold the same samples and directions: firstBotMemoryDifference without building canonical text. */
export function sameBotMemory(expected: Readonly<BotMemory>, actual: Readonly<BotMemory>): boolean {
  if (expected.history.length !== actual.history.length) return false;
  for (let index = 0; index < expected.history.length; index++) {
    const e = at(expected.history, index);
    const a = at(actual.history, index);
    if (e === a) continue;
    if (e.frame !== a.frame) return false;
    const reused = reuses.get(e) ?? 0;
    if (equalTo.get(a) === e && equalToReuse.get(a) === reused) continue;
    for (const slot of PARTICIPANT_SLOTS) {
      const x = e.opponents[slot];
      const y = a.opponents[slot];
      if (x === y) continue;
      if (x === undefined || y === undefined || !sameObservation(x, y)) return false;
    }
    equalTo.set(a, e);
    equalToReuse.set(a, reused);
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (expected.directions[slot] !== actual.directions[slot] || expected.directionFrames[slot] !== actual.directionFrames[slot]) return false;
  }
  return true;
}

/** Only the opponent's visible body, action, status and entities enter perception. */
function createObservation(): ObservationFighter {
  const f = EMPTY;
  return {
    ...EMPTY, character: f.character, tuning: { ...f.tuning }, facing: f.facing,
    motion: { ...EMPTY.motion, x: f.motion.x, z: f.motion.z, deltaX: f.motion.deltaX, deltaZ: f.motion.deltaZ,
      vx: f.motion.vx, vz: f.motion.vz, grounded: f.motion.grounded, surface: f.motion.surface },
    attack: { ...EMPTY.attack, style: f.attack.style, frame: f.attack.frame, duration: f.attack.duration,
      serial: f.attack.serial, cooldown: f.attack.cooldown },
    special: { ...EMPTY.special, action: f.special.action, frame: f.special.frame, duration: f.special.duration,
      lockFrames: f.special.lockFrames, form: f.special.form, grabFrame: f.special.grabFrame },
    shield: { ...EMPTY.shield, raised: f.shield.raised, stun: f.shield.stun, releaseLag: f.shield.releaseLag },
    launch: { ...EMPTY.launch, hitstun: f.launch.hitstun, hitlag: f.launch.hitlag },
    hits: { ...EMPTY.hits, lastAttacker: f.hits.lastAttacker },
    status: { ...EMPTY.status, out: f.status.out, stocks: f.status.stocks, damage: f.status.damage,
      invincible: f.status.invincible, frozenFrames: f.status.frozenFrames, condition: f.status.condition,
      conditionFrames: f.status.conditionFrames, poisonFrames: f.status.poisonFrames },
    landing: { lag: f.landing.lag },
    down: { ...EMPTY.down, state: f.down.state, frame: f.down.frame, direction: f.down.direction, faceUp: f.down.faceUp },
    grab: { ...EMPTY.grab, owner: f.grab.owner, target: f.grab.target, action: f.grab.action },
    ledge: { ...EMPTY.ledge, state: f.ledge.state, side: f.ledge.side, intangible: f.ledge.intangible },
    dodge: { ...EMPTY.dodge, groundFrame: f.dodge.groundFrame, groundDirection: f.dodge.groundDirection,
      airDodging: f.dodge.airDodging, airFrame: f.dodge.airFrame },
    surfaceRecovery: { ...EMPTY.surfaceRecovery, state: f.surfaceRecovery.state, frame: f.surfaceRecovery.frame },
    cannon: { ...EMPTY.cannon, held: f.cannon.held },
    bear: { ...EMPTY.bear, life: f.bear.life, x: f.bear.x, z: f.bear.z, hitSerial: f.bear.hitSerial },
    projectiles: f.projectiles.map(p => ({ ...at(EMPTY.projectiles, 0),
      life: p.life, x: p.x, z: p.z, direction: p.direction, velocityX: p.velocityX, velocityZ: p.velocityZ, serial: p.serial })),
  };
}

function copyObservation(target: ObservationFighter, source: Readonly<Fighter>): void {
  target.character = source.character;
  target.facing = source.facing;
  const tuning = target.tuning;
  const sourceTuning = source.tuning;
  tuning.moves = sourceTuning.moves;
  tuning.specials = sourceTuning.specials;
  tuning.physics = sourceTuning.physics;
  tuning.surface = sourceTuning.surface;
  tuning.ground = sourceTuning.ground;
  tuning.dashGrab = sourceTuning.dashGrab;
  tuning.shield = sourceTuning.shield;
  tuning.tech = sourceTuning.tech;
  tuning.shieldBreak = sourceTuning.shieldBreak;
  const motion = target.motion;
  const fromMotion = source.motion;
  motion.x = fromMotion.x;
  motion.z = fromMotion.z;
  motion.deltaX = fromMotion.deltaX;
  motion.deltaZ = fromMotion.deltaZ;
  motion.vx = fromMotion.vx;
  motion.vz = fromMotion.vz;
  motion.grounded = fromMotion.grounded;
  motion.surface = fromMotion.surface;
  const attack = target.attack;
  const fromAttack = source.attack;
  attack.style = fromAttack.style;
  attack.frame = fromAttack.frame;
  attack.duration = fromAttack.duration;
  attack.serial = fromAttack.serial;
  attack.cooldown = fromAttack.cooldown;
  const special = target.special;
  const fromSpecial = source.special;
  special.action = fromSpecial.action;
  special.frame = fromSpecial.frame;
  special.duration = fromSpecial.duration;
  special.lockFrames = fromSpecial.lockFrames;
  special.form = fromSpecial.form;
  special.grabFrame = fromSpecial.grabFrame;
  const shield = target.shield;
  const fromShield = source.shield;
  shield.raised = fromShield.raised;
  shield.stun = fromShield.stun;
  shield.releaseLag = fromShield.releaseLag;
  const launch = target.launch;
  const fromLaunch = source.launch;
  launch.hitstun = fromLaunch.hitstun;
  launch.hitlag = fromLaunch.hitlag;
  const hits = target.hits;
  const fromHits = source.hits;
  hits.lastAttacker = fromHits.lastAttacker;
  const status = target.status;
  const fromStatus = source.status;
  status.out = fromStatus.out;
  status.stocks = fromStatus.stocks;
  status.damage = fromStatus.damage;
  status.invincible = fromStatus.invincible;
  status.frozenFrames = fromStatus.frozenFrames;
  status.condition = fromStatus.condition;
  status.conditionFrames = fromStatus.conditionFrames;
  status.poisonFrames = fromStatus.poisonFrames;
  const landing = target.landing;
  const fromLanding = source.landing;
  landing.lag = fromLanding.lag;
  const down = target.down;
  const fromDown = source.down;
  down.state = fromDown.state;
  down.frame = fromDown.frame;
  down.direction = fromDown.direction;
  down.faceUp = fromDown.faceUp;
  const grab = target.grab;
  const fromGrab = source.grab;
  grab.owner = fromGrab.owner;
  grab.target = fromGrab.target;
  grab.action = fromGrab.action;
  const ledge = target.ledge;
  const fromLedge = source.ledge;
  ledge.state = fromLedge.state;
  ledge.side = fromLedge.side;
  ledge.intangible = fromLedge.intangible;
  const dodge = target.dodge;
  const fromDodge = source.dodge;
  dodge.groundFrame = fromDodge.groundFrame;
  dodge.groundDirection = fromDodge.groundDirection;
  dodge.airDodging = fromDodge.airDodging;
  dodge.airFrame = fromDodge.airFrame;
  const surfaceRecovery = target.surfaceRecovery;
  const fromSurfaceRecovery = source.surfaceRecovery;
  surfaceRecovery.state = fromSurfaceRecovery.state;
  surfaceRecovery.frame = fromSurfaceRecovery.frame;
  const cannon = target.cannon;
  const fromCannon = source.cannon;
  cannon.held = fromCannon.held;
  const bear = target.bear;
  const fromBear = source.bear;
  bear.life = fromBear.life;
  bear.x = fromBear.x;
  bear.z = fromBear.z;
  bear.hitSerial = fromBear.hitSerial;
  const sourceProjectiles = source.projectiles;
  const targetProjectiles = target.projectiles;
  // Both hold PROJECTILE_CAPACITY; plain indexing spares this per-step copy a lookup call per slot.
  for (let index = 0; index < sourceProjectiles.length; index++) {
    const from = sourceProjectiles[index];
    const into = targetProjectiles[index];
    if (from === undefined || into === undefined) throw new Error(`no projectile ${index} to observe`);
    // An observed projectile without life always holds EMPTY's values, so a dead one stays as it is.
    if (from.life <= 0 && into.life <= 0) continue;
    const p = from.life <= 0 ? at(EMPTY.projectiles, 0) : from;
    into.life = p.life;
    into.x = p.x;
    into.z = p.z;
    into.direction = p.direction;
    into.velocityX = p.velocityX;
    into.velocityZ = p.velocityZ;
    into.serial = p.serial;
  }
}

let checksumFirst = 0;
let checksumSecond = 0;
function foldObservationByte(byte: number): void {
  flushObservationZeroes();
  const code = byte + 1;
  checksumFirst = floorMod(checksumFirst * 31 + code, 46337);
  checksumSecond = floorMod(checksumSecond * 37 + code, 46337);
}

interface ObservationDigest { first: number; second: number; firstPower: number; secondPower: number }
const textDigests = new Map<string, ObservationDigest>();
let buildingDigest: ObservationDigest = { first: 0, second: 0, firstPower: 1, secondPower: 1 };
function digestByte(byte: number): void {
  buildingDigest.first = floorMod(buildingDigest.first * 31 + byte + 1, 46337);
  buildingDigest.second = floorMod(buildingDigest.second * 37 + byte + 1, 46337);
  buildingDigest.firstPower = floorMod(buildingDigest.firstPower * 31, 46337);
  buildingDigest.secondPower = floorMod(buildingDigest.secondPower * 37, 46337);
}
function scalarDigest(value: number): ObservationDigest {
  buildingDigest = { first: 0, second: 0, firstPower: 1, secondPower: 1 };
  digestByte(44);
  writeCanonicalNumber(digestByte, value);
  return buildingDigest;
}
const integerDigests: ObservationDigest[] = [];
for (let value = -1; value <= 255; value++) integerDigests.push(scalarDigest(value));

// Neutral fields are consecutive in the canonical record; fold a whole run's unchanged bytes once.
const zeroFirst: number[] = [0];
const zeroSecond: number[] = [0];
const zeroFirstPower: number[] = [1];
const zeroSecondPower: number[] = [1];
let zeroNumbers = 0;
function flushObservationZeroes(): void {
  if (zeroNumbers === 0) return;
  const zero = at(integerDigests, 1);
  while (zeroFirst.length <= zeroNumbers) {
    const previous = zeroFirst.length - 1;
    zeroFirst.push(floorMod(at(zeroFirst, previous) * zero.firstPower + zero.first, 46337));
    zeroSecond.push(floorMod(at(zeroSecond, previous) * zero.secondPower + zero.second, 46337));
    zeroFirstPower.push(floorMod(at(zeroFirstPower, previous) * zero.firstPower, 46337));
    zeroSecondPower.push(floorMod(at(zeroSecondPower, previous) * zero.secondPower, 46337));
  }
  // The loop above filled every table through zeroNumbers.
  checksumFirst = floorMod(checksumFirst * (zeroFirstPower[zeroNumbers] ?? 0) + (zeroFirst[zeroNumbers] ?? 0), 46337);
  checksumSecond = floorMod(checksumSecond * (zeroSecondPower[zeroNumbers] ?? 0) + (zeroSecond[zeroNumbers] ?? 0), 46337);
  zeroNumbers = 0;
}

function foldDigest(digest: Readonly<ObservationDigest>): void {
  // 46336*46337 remains below the signed int32 endpoint.
  checksumFirst = floorMod(checksumFirst * digest.firstPower + digest.first, 46337);
  checksumSecond = floorMod(checksumSecond * digest.secondPower + digest.second, 46337);
}
function textDigest(text: string): ObservationDigest {
  buildingDigest = { first: 0, second: 0, firstPower: 1, secondPower: 1 };
  for (let index = 0; index < text.length; index++) digestByte(text.charCodeAt(index));
  return buildingDigest;
}
// Decimal digits fold three at a time: the leading group unpadded, later groups zero-padded.
const leadingGroupDigests: ObservationDigest[] = [];
const paddedGroupDigests: ObservationDigest[] = [];
for (let group = 0; group < 1000; group++) {
  leadingGroupDigests.push(textDigest(`${group}`));
  paddedGroupDigests.push(textDigest(group < 10 ? `00${group}` : group < 100 ? `0${group}` : `${group}`));
}
const separatorDigest = textDigest(",");
const negativeSeparatorDigest = textDigest(",-");
const positiveRealDigest = textDigest(",+");
const colonDigest = textDigest(":");
const minusDigest = textDigest("-");

function appendDigest(digest: Readonly<ObservationDigest>): void {
  buildingDigest.first = floorMod(buildingDigest.first * digest.firstPower + digest.first, 46337);
  buildingDigest.second = floorMod(buildingDigest.second * digest.secondPower + digest.second, 46337);
  buildingDigest.firstPower = floorMod(buildingDigest.firstPower * digest.firstPower, 46337);
  buildingDigest.secondPower = floorMod(buildingDigest.secondPower * digest.secondPower, 46337);
}

/** Appends a non-negative integer's decimal bytes, exactly as writeCanonicalNumber writes them. */
function digestDecimal(value: number): void {
  if (value < 1000) { appendDigest(at(leadingGroupDigests, value)); return; }
  digestDecimal(floorDiv(value, 1000));
  appendDigest(at(paddedGroupDigests, floorMod(value, 1000)));
}
function digestSignedDecimal(value: number): void {
  if (value < 0) { appendDigest(minusDigest); digestDecimal(-value); } else digestDecimal(value);
}

interface CachedNumberDigest extends ObservationDigest { value: number | undefined }
// A repair revisits recent coordinates; reuse exact digests without retaining a match's numbers indefinitely.
const NUMBER_DIGEST_CAPACITY = 1024;
const numberDigests = new Map<number, CachedNumberDigest>();
const numberDigestRing: CachedNumberDigest[] = [];
for (let index = 0; index < NUMBER_DIGEST_CAPACITY; index++) {
  numberDigestRing.push({ value: undefined, first: 0, second: 0, firstPower: 1, secondPower: 1 });
}
let nextNumberDigest = 0;

function numberDigest(value: number, integer: number): Readonly<ObservationDigest> {
  const cached = numberDigests.get(value);
  if (cached !== undefined) return cached;
  const digest = at(numberDigestRing, nextNumberDigest);
  if (digest.value !== undefined) numberDigests.delete(digest.value);
  nextNumberDigest = floorMod(nextNumberDigest + 1, NUMBER_DIGEST_CAPACITY);
  digest.value = value;
  digest.first = 0;
  digest.second = 0;
  digest.firstPower = 1;
  digest.secondPower = 1;
  buildingDigest = digest;
  if (integer === value && value >= -2147483647 && value <= 2147483647) {
    if (integer < 0) { appendDigest(negativeSeparatorDigest); digestDecimal(-integer); }
    else { appendDigest(separatorDigest); digestDecimal(integer); }
  } else if (integer !== value && splitFiniteReal(value < 0 ? -value : value)) {
    appendDigest(value < 0 ? negativeSeparatorDigest : positiveRealDigest);
    digestSignedDecimal(realParts.exponent);
    appendDigest(colonDigest);
    digestDecimal(realParts.high);
    appendDigest(colonDigest);
    digestDecimal(realParts.low);
  } else {
    digestByte(44);
    writeCanonicalNumber(digestByte, value);
  }
  numberDigests.set(value, digest);
  return digest;
}

function foldObservationNumber(value: number): void {
  if (value === 0) { zeroNumbers++; return; }
  flushObservationZeroes();
  const integer = Math.floor(value);
  if (value >= -1 && value <= 255 && integer === value) {
    foldDigest(at(integerDigests, integer + 1));
  } else if (value === value) {
    foldDigest(numberDigest(value, integer));
  } else {
    // NaN cannot key a Lua table.
    foldObservationByte(44);
    writeCanonicalNumber(foldObservationByte, value);
  }
}
const repeatedTextFirst: number[] = [0];
const repeatedTextSecond: number[] = [0];
const repeatedTextFirstPower: number[] = [1];
const repeatedTextSecondPower: number[] = [1];
let repeatedObservationText = "";

function foldObservationText(text: string, repetitions: number): void {
  flushObservationZeroes();
  let digest = textDigests.get(text);
  if (digest === undefined) {
    buildingDigest = { first: 0, second: 0, firstPower: 1, secondPower: 1 };
    for (let index = 0; index < text.length; index++) digestByte(text.charCodeAt(index));
    digest = buildingDigest;
    textDigests.set(text, digest);
  }
  if (repetitions === 1) { foldDigest(digest); return; }
  if (text !== repeatedObservationText) {
    repeatedObservationText = text;
    repeatedTextFirst.length = 1;
    repeatedTextSecond.length = 1;
    repeatedTextFirstPower.length = 1;
    repeatedTextSecondPower.length = 1;
  }
  while (repeatedTextFirst.length <= repetitions) {
    const previous = repeatedTextFirst.length - 1;
    repeatedTextFirst.push(floorMod(at(repeatedTextFirst, previous) * digest.firstPower + digest.first, 46337));
    repeatedTextSecond.push(floorMod(at(repeatedTextSecond, previous) * digest.secondPower + digest.second, 46337));
    repeatedTextFirstPower.push(floorMod(at(repeatedTextFirstPower, previous) * digest.firstPower, 46337));
    repeatedTextSecondPower.push(floorMod(at(repeatedTextSecondPower, previous) * digest.secondPower, 46337));
  }
  checksumFirst = floorMod(checksumFirst * at(repeatedTextFirstPower, repetitions) + at(repeatedTextFirst, repetitions), 46337);
  checksumSecond = floorMod(checksumSecond * at(repeatedTextSecondPower, repetitions) + at(repeatedTextSecond, repetitions), 46337);
}
const checksumWriter = { byte: foldObservationByte, number: foldObservationNumber, text: foldObservationText };

/** Captures once per input frame even when several computer slots make decisions. */
export function observeOpponents(memory: BotMemory, world: Roster, frame: number): void {
  const storage = storageFor(memory);
  const previous = storage.history.length > 0 ? at(storage.history, storage.history.length - 1) : undefined;
  if (previous?.frame === frame) return;
  if (previous !== undefined && previous.frame >= frame) {
    for (const old of storage.entries) release(old);
    storage.entries.length = 0;
    storage.history.length = 0;
  }
  if (storage.entries.length === BOT_HISTORY_FRAMES) {
    release(at(storage.entries, 0));
    storage.entries.shift();
    storage.history.shift();
  }
  let entry = storage.arena.free.pop();
  if (entry === undefined) {
    entry = createEntry(storage.arena);
  }
  reuses.set(entry.sample, (reuses.get(entry.sample) ?? 0) + 1);
  equalTo.delete(entry.sample);
  entry.references = 1;
  entry.sample.frame = frame;
  for (const slot of PARTICIPANT_SLOTS) {
    const body = entry.bodies[slot];
    if (isActive(world, slot)) { copyObservation(body, fighterAt(world, slot)); entry.sample.opponents[slot] = body; }
    else entry.sample.opponents[slot] = undefined;
  }
  entry.sample.checksumFirst = UNSETTLED;
  entry.sample.checksumSecond = UNSETTLED;
  storage.entries.push(entry);
  storage.history.push(entry.sample);
  memory.history = storage.history;
}

/** Computes a sample's checksum on its first read; its observations never change while any history holds it. */
export function settleObservationChecksum(sample: BotObservationFrame): void {
  if (sample.checksumFirst !== UNSETTLED) return;
  checksumFirst = 0;
  checksumSecond = 0;
  zeroNumbers = 0;
  writeObservations(checksumWriter, sample.opponents);
  flushObservationZeroes();
  sample.checksumFirst = checksumFirst;
  sample.checksumSecond = checksumSecond;
}

/** Settles one waiting sample per callback, including callbacks waiting for remote input. */
export function settleNextObservation(memory: Readonly<BotMemory>): void {
  for (const sample of memory.history) {
    if (sample.checksumFirst !== UNSETTLED) continue;
    settleObservationChecksum(sample);
    return;
  }
}

/** Settles every retained sample's checksum, before a memory is written out as text. */
export function settleBotMemoryChecksums(memory: Readonly<BotMemory>): void {
  for (const sample of memory.history) settleObservationChecksum(sample);
}

function perceivedFrame(memory: Readonly<BotMemory>, frame: number, delay: number): BotObservationFrame | undefined {
  // Frames strictly increase along a history, one a frame in play: try the
  // index that holds the wanted frame before walking back to it.
  const history = memory.history;
  const last = history.length - 1;
  const wanted = frame - delay;
  const newest = history[last];
  if (newest !== undefined) {
    const guess = last - (newest.frame - wanted);
    const candidate = guess >= 0 && guess <= last ? history[guess] : undefined;
    if (candidate !== undefined && candidate.frame <= wanted) {
      const next = history[guess + 1];
      if (next === undefined || next.frame > wanted) return candidate;
    }
  }
  for (let index = memory.history.length - 1; index >= 0; index--) {
    const candidate = at(memory.history, index);
    if (candidate.frame <= frame - delay) return candidate;
  }
  return undefined;
}

/**
 * Whether two memories show a computer in `slot` the same past: the same
 * sample at its perception delay and the same committed direction. Samples
 * never change while a history holds them, so the same sample is the same view.
 */
export function samePerception(a: Readonly<BotMemory>, b: Readonly<BotMemory>, slot: ParticipantSlot, frame: number, delay: number): boolean {
  return a.directions[slot] === b.directions[slot] && a.directionFrames[slot] === b.directionFrames[slot]
    && perceivedFrame(a, frame, delay) === perceivedFrame(b, frame, delay);
}

/** Own grab ownership selects the held slot, without revealing that opponent's newer state. */
export function perceivedHeldFighter(memory: Readonly<BotMemory>, heldSlot: number, frame: number, delay: number): Readonly<Fighter> | undefined {
  return perceivedFrame(memory, frame, delay)?.opponents[heldSlot];
}

/** The latest frame old enough to see; opponent selection also uses that observation. */
export function perceivedOpponent(memory: Readonly<BotMemory>, own: Readonly<Fighter>, slot: ParticipantSlot, frame: number, delay: number): Readonly<Fighter> | undefined {
  const sample = perceivedFrame(memory, frame, delay);
  if (sample === undefined) return undefined;
  let nearest: Readonly<Fighter> | undefined;
  let distance = 0.0;
  for (const candidate of PARTICIPANT_SLOTS) {
    const target = sample.opponents[candidate];
    if (candidate === slot || target === undefined || target.status.out || target.status.stocks <= 0) continue;
    const gap = Math.abs(f32(target.motion.x - own.motion.x));
    if (nearest === undefined || gap < distance) { nearest = target; distance = gap; }
  }
  return nearest;
}

/** Neutral may brake immediately; it does not shorten the hold before the opposite direction. */
export function commitBotDirection(memory: BotMemory, slot: ParticipantSlot, frame: number, input: Controls, tier: CpuTier = "expert", policy?: CpuDecisionPolicy): void {
  const wanted = input.direction;
  const previous = memory.directions[slot];
  if (wanted === 0) return;
  if (previous !== 0 && wanted !== previous && frame - memory.directionFrames[slot] < botReversalFrames(memory.directionFrames[slot], slot, tier, policy?.executionPercent ?? 97)) {
    input.direction = previous;
    return;
  }
  if (wanted !== previous) {
    memory.directions[slot] = wanted;
    memory.directionFrames[slot] = frame;
  }
}
