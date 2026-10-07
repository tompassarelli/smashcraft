// Opponent observations are immutable once published. Replay snapshots share
// their bounded history; the live simulation never changes an earlier sample.
import { at } from "wisp/src/runtime/lookup";
import { canonicalInt, observedOpponentKitCanonical } from "../replay/canonical";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import { createFighter, type Fighter } from "../sim/fighter";
import { fighterAt, isActive, type Controls, type Roster } from "../sim/roster";
import { cpuSkill } from "./cpuLevel";

export const BOT_DIRECTION_FRAMES = 5;
const HISTORY_FRAMES = cpuSkill(1).reactionFrames + 1;
// Unobserved input buffers, resource plans and hit registries stay neutral.
const EMPTY = createFighter(0, 0.0, 1);

export interface BotObservationFrame {
  readonly frame: number;
  readonly opponents: Slots<Readonly<Fighter> | undefined>;
  readonly canonical: string;
  readonly checksumFirst: number;
  readonly checksumSecond: number;
}

export interface BotMemory {
  history: readonly BotObservationFrame[];
  readonly directions: Slots<number>;
  readonly directionFrames: Slots<number>;
}

export function createBotMemory(): BotMemory {
  return { history: [], directions: [0, 0, 0, 0], directionFrames: [0, 0, 0, 0] };
}

export function copyBotMemory(target: BotMemory, source: Readonly<BotMemory>): void {
  target.history = source.history;
  for (const slot of PARTICIPANT_SLOTS) {
    target.directions[slot] = source.directions[slot];
    target.directionFrames[slot] = source.directionFrames[slot];
  }
}

export function clearBotMemory(memory: BotMemory): void {
  memory.history = [];
  memory.directions.fill(0);
  memory.directionFrames.fill(0);
}

export function firstBotMemoryDifference(expected: Readonly<BotMemory>, actual: Readonly<BotMemory>): string | undefined {
  if (expected.history.length !== actual.history.length) return "history.length";
  for (let index = 0; index < expected.history.length; index++) {
    const e = at(expected.history, index);
    const a = at(actual.history, index);
    if (e.frame !== a.frame) return `history[${index}].frame`;
    if (e.canonical !== a.canonical) return `history[${index}].canonical`;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (expected.directions[slot] !== actual.directions[slot]) return `directions[${slot}]`;
    if (expected.directionFrames[slot] !== actual.directionFrames[slot]) return `directionFrames[${slot}]`;
  }
  return undefined;
}

/** Only the opponent's visible body, action, status and entities enter perception. */
function observe(f: Readonly<Fighter>): Readonly<Fighter> {
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
    projectiles: f.projectiles.map(p => p.life <= 0 ? at(EMPTY.projectiles, 0) : { ...at(EMPTY.projectiles, 0),
      life: p.life, x: p.x, z: p.z, direction: p.direction, velocityX: p.velocityX, velocityZ: p.velocityZ, serial: p.serial }),
  };
}

/** Exact scalar serialization is cached once per immutable observation. */
function observationsCanonical(opponents: Slots<Readonly<Fighter> | undefined>): string {
  const parts: string[] = [];
  const fold = (value: number) => { parts.push(canonicalInt("", value).slice(2)); };
  for (const slot of PARTICIPANT_SLOTS) {
    const f = opponents[slot];
    fold(f === undefined ? 0 : 1);
    if (f === undefined) continue;
    parts.push(observedOpponentKitCanonical(f).replaceAll("|", ";"));
    for (const value of [f.tuning.physics.gravity, f.tuning.physics.terminalSpeed, f.tuning.tech.ceilingImpulseFrame, f.character, f.facing, f.motion.x, f.motion.z, f.motion.deltaX, f.motion.deltaZ,
      f.motion.vx, f.motion.vz, f.motion.grounded ? 1 : 0, f.motion.surface ?? -1,
      f.attack.style ?? -1, f.attack.frame, f.attack.duration, f.attack.serial, f.attack.cooldown,
      f.special.action, f.special.frame, f.special.duration, f.special.lockFrames, f.special.form, f.special.grabFrame,
      f.shield.raised ? 1 : 0, f.shield.stun, f.shield.releaseLag, f.launch.hitstun, f.launch.hitlag,
      f.hits.lastAttacker ?? -1, f.status.out ? 1 : 0, f.status.stocks, f.status.damage, f.status.invincible,
      f.status.frozenFrames, f.status.condition, f.status.conditionFrames, f.status.poisonFrames,
      f.passive.stacks, f.passive.window, f.passive.serial, f.passive.spent, f.passive.used ? 1 : 0,
      f.landing.lag, f.down.state, f.down.frame, f.down.direction, f.down.faceUp ? 1 : 0,
      f.grab.owner ?? -1, f.grab.target ?? -1, f.grab.action, f.ledge.state, f.ledge.side, f.ledge.intangible,
      f.dodge.groundFrame, f.dodge.groundDirection, f.dodge.airDodging ? 1 : 0, f.dodge.airFrame,
      f.surfaceRecovery.state, f.surfaceRecovery.frame, f.cannon.held ?? -1,
      f.bear.life, f.bear.x, f.bear.z, f.bear.hitSerial]) fold(value);
    for (const p of f.projectiles) for (const value of [p.life, p.x, p.z, p.direction, p.velocityX, p.velocityZ, p.serial]) fold(value);
  }
  return parts.join(",");
}

/** Captures once per input frame even when several computer slots make decisions. */
export function observeOpponents(memory: BotMemory, world: Roster, frame: number): void {
  const previous = memory.history.length > 0 ? at(memory.history, memory.history.length - 1) : undefined;
  if (previous?.frame === frame) return;
  const opponents: Slots<Readonly<Fighter> | undefined> = [undefined, undefined, undefined, undefined];
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) opponents[slot] = observe(fighterAt(world, slot));
  const canonical = observationsCanonical(opponents);
  let checksumFirst = 0;
  let checksumSecond = 0;
  // Periodic replay checks fold these immutable samples without re-reading their text.
  for (let index = 0; index < canonical.length; index++) {
    const code = canonical.charCodeAt(index) + 1;
    checksumFirst = floorMod(checksumFirst * 31 + code, 46337);
    checksumSecond = floorMod(checksumSecond * 37 + code, 46337);
  }
  const sample: BotObservationFrame = { frame, opponents, canonical, checksumFirst, checksumSecond };
  const history = previous !== undefined && previous.frame < frame ? memory.history.slice(-HISTORY_FRAMES + 1) : [];
  history.push(sample);
  memory.history = history;
}

function perceivedFrame(memory: Readonly<BotMemory>, frame: number, delay: number): BotObservationFrame | undefined {
  for (let index = memory.history.length - 1; index >= 0; index--) {
    const candidate = at(memory.history, index);
    if (candidate.frame <= frame - delay) return candidate;
  }
  return undefined;
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
