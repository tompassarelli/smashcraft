// Histories retain shared observations. Storage is reused only after every
// live input and replay snapshot has released that sample.
import { at } from "wisp/src/runtime/lookup";
import { botObservationCanonical, realParts, splitFiniteReal, writeCanonicalNumber, writeObservations } from "../replay/canonical";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { createFighter, type Fighter, type Projectile } from "../sim/fighter";
import { fighterAt, isActive, type Controls, type Roster } from "../sim/roster";

export const BOT_DIRECTION_FRAMES = 5;
// The slowest supported computer style sees events 42 frames later.
export const BOT_HISTORY_FRAMES = 43;
// Unobserved input buffers, resource plans and hit registries stay neutral.
const EMPTY = createFighter(0, 0.0, 1);

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
    passive: { ...EMPTY.passive, stacks: f.passive.stacks, window: f.passive.window, serial: f.passive.serial,
      spent: f.passive.spent, used: f.passive.used },
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
  target.tuning.moves = source.tuning.moves;
  target.tuning.specials = source.tuning.specials;
  target.tuning.physics = source.tuning.physics;
  target.tuning.surface = source.tuning.surface;
  target.tuning.ground = source.tuning.ground;
  target.tuning.dashGrab = source.tuning.dashGrab;
  target.tuning.shield = source.tuning.shield;
  target.tuning.tech = source.tuning.tech;
  target.tuning.shieldBreak = source.tuning.shieldBreak;
  target.motion.x = source.motion.x;
  target.motion.z = source.motion.z;
  target.motion.deltaX = source.motion.deltaX;
  target.motion.deltaZ = source.motion.deltaZ;
  target.motion.vx = source.motion.vx;
  target.motion.vz = source.motion.vz;
  target.motion.grounded = source.motion.grounded;
  target.motion.surface = source.motion.surface;
  target.attack.style = source.attack.style;
  target.attack.frame = source.attack.frame;
  target.attack.duration = source.attack.duration;
  target.attack.serial = source.attack.serial;
  target.attack.cooldown = source.attack.cooldown;
  target.special.action = source.special.action;
  target.special.frame = source.special.frame;
  target.special.duration = source.special.duration;
  target.special.lockFrames = source.special.lockFrames;
  target.special.form = source.special.form;
  target.special.grabFrame = source.special.grabFrame;
  target.shield.raised = source.shield.raised;
  target.shield.stun = source.shield.stun;
  target.shield.releaseLag = source.shield.releaseLag;
  target.launch.hitstun = source.launch.hitstun;
  target.launch.hitlag = source.launch.hitlag;
  target.hits.lastAttacker = source.hits.lastAttacker;
  target.status.out = source.status.out;
  target.status.stocks = source.status.stocks;
  target.status.damage = source.status.damage;
  target.status.invincible = source.status.invincible;
  target.status.frozenFrames = source.status.frozenFrames;
  target.status.condition = source.status.condition;
  target.status.conditionFrames = source.status.conditionFrames;
  target.status.poisonFrames = source.status.poisonFrames;
  target.passive.stacks = source.passive.stacks;
  target.passive.window = source.passive.window;
  target.passive.serial = source.passive.serial;
  target.passive.spent = source.passive.spent;
  target.passive.used = source.passive.used;
  target.landing.lag = source.landing.lag;
  target.down.state = source.down.state;
  target.down.frame = source.down.frame;
  target.down.direction = source.down.direction;
  target.down.faceUp = source.down.faceUp;
  target.grab.owner = source.grab.owner;
  target.grab.target = source.grab.target;
  target.grab.action = source.grab.action;
  target.ledge.state = source.ledge.state;
  target.ledge.side = source.ledge.side;
  target.ledge.intangible = source.ledge.intangible;
  target.dodge.groundFrame = source.dodge.groundFrame;
  target.dodge.groundDirection = source.dodge.groundDirection;
  target.dodge.airDodging = source.dodge.airDodging;
  target.dodge.airFrame = source.dodge.airFrame;
  target.surfaceRecovery.state = source.surfaceRecovery.state;
  target.surfaceRecovery.frame = source.surfaceRecovery.frame;
  target.cannon.held = source.cannon.held;
  target.bear.life = source.bear.life;
  target.bear.x = source.bear.x;
  target.bear.z = source.bear.z;
  target.bear.hitSerial = source.bear.hitSerial;
  for (let index = 0; index < source.projectiles.length; index++) {
    const from = at(source.projectiles, index);
    const into = at(target.projectiles, index);
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
  checksumFirst = floorMod(checksumFirst * at(zeroFirstPower, zeroNumbers) + at(zeroFirst, zeroNumbers), 46337);
  checksumSecond = floorMod(checksumSecond * at(zeroSecondPower, zeroNumbers) + at(zeroSecond, zeroNumbers), 46337);
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
export function commitBotDirection(memory: BotMemory, slot: ParticipantSlot, frame: number, input: Controls): void {
  const wanted = input.direction;
  const previous = memory.directions[slot];
  if (wanted === 0) return;
  if (previous !== 0 && wanted !== previous && frame - memory.directionFrames[slot] < BOT_DIRECTION_FRAMES) {
    input.direction = previous;
    return;
  }
  if (wanted !== previous) {
    memory.directions[slot] = wanted;
    memory.directionFrames[slot] = frame;
  }
}
