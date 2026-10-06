import type { Direction } from "./inputRow";

/** Grace frames for human attack commands. */
export const ATTACK_BUFFER_FRAMES = 6;

/**
 * One attack request. Immutable, so buffer copies share it: only queueing a
 * press creates one, and rollback replays copy buffers every frame.
 */
export interface AttackCommand {
  /** A Simulation attack style; 0 through 10 can be queued. */
  readonly style: number;
  /** The facing the attack asks for; 0 when same-frame requests disagreed. */
  readonly facing: Direction;
  /** The logical simulation frame it is for, never a wall-clock time. */
  readonly frame: number;
  /** Holding attack may charge it, as for a smash entered with the attack button. */
  readonly mayCharge: boolean;
}

/** One participant's queued attack, waiting up to graceFrames past its frame for the fighter to be able to start it. */
export interface AttackBuffer {
  graceFrames: number;
  pending: AttackCommand | undefined;
  /** Last queued request, retained because replay snapshots hash Wurst's last facing and target frame. */
  previousRequest: AttackCommand | undefined;
  /** Result of the most recent consume attempt. */
  consumedFacing: Direction;
  consumedMayCharge: boolean;
}

/** The Wurst Replay2 fields for one command buffer, including its consumed observation. */
interface AttackBufferCanonicalState {
  graceFrames: number;
  style: number;
  facing: Direction;
  targetFrame: number;
  consumedFacing: Direction;
  mayCharge: boolean;
  consumedMayCharge: boolean;
}

export function attackBuffer(graceFrames: number): AttackBuffer {
  return { graceFrames: Math.max(0, graceFrames), pending: undefined, previousRequest: undefined, consumedFacing: 0, consumedMayCharge: false };
}

/** Explicitly reset both the queued request and its last-consume observation. */
export function clearAttackBuffer(buffer: AttackBuffer): void {
  buffer.pending = undefined;
  buffer.previousRequest = undefined;
  buffer.consumedFacing = 0;
  buffer.consumedMayCharge = false;
}

export function attackBufferCanonicalState(buffer: Readonly<AttackBuffer>): AttackBufferCanonicalState {
  const previous = buffer.previousRequest;
  return {
    graceFrames: buffer.graceFrames,
    style: buffer.pending?.style ?? -1,
    facing: previous?.facing ?? 0,
    targetFrame: previous?.frame ?? -1,
    consumedFacing: buffer.consumedFacing,
    mayCharge: previous?.mayCharge ?? false,
    consumedMayCharge: buffer.consumedMayCharge,
  };
}

export function sameAttackBuffer(first: Readonly<AttackBuffer>, second: Readonly<AttackBuffer>): boolean {
  const a = attackBufferCanonicalState(first);
  const b = attackBufferCanonicalState(second);
  return a.graceFrames === b.graceFrames && a.style === b.style && a.facing === b.facing
    && a.targetFrame === b.targetFrame && a.consumedFacing === b.consumedFacing
    && a.mayCharge === b.mayCharge && a.consumedMayCharge === b.consumedMayCharge;
}

/** A field-by-field copy: Lua's Object.assign skips undefined requests. */
export function copyAttackBuffer(target: AttackBuffer, source: Readonly<AttackBuffer>): void {
  target.graceFrames = source.graceFrames;
  target.pending = source.pending;
  target.previousRequest = source.previousRequest;
  target.consumedFacing = source.consumedFacing;
  target.consumedMayCharge = source.consumedMayCharge;
}

const GRAB = 5;
const isSmash = (style: number) => style >= 2 && style <= 4;
const isTilt = (style: number) => style >= 6;

/** Same-frame precedence: grab, C-stick smashes, smashes that may charge, tilts, then by style. */
function precedence({ style, mayCharge }: AttackCommand): number {
  if (style === GRAB) return 5;
  if (isSmash(style)) return mayCharge ? 3 : 4;
  return isTilt(style) ? 2 : style;
}

/**
 * Queues an attack in place of one for another frame. Requests for the same
 * frame keep the one with precedence, the higher style on a tie, so callback
 * order never decides; equal requests that disagree on facing leave the
 * facing neutral.
 */
export function queueAttack(buffer: AttackBuffer, command: AttackCommand): void {
  if (command.style < 0 || command.style > 10) return;
  const queued = buffer.pending;
  if (queued !== undefined && queued.frame === command.frame) {
    const order = precedence(queued) - precedence(command);
    if (order > 0 || (order === 0 && queued.style > command.style)) return;
    if (queued.style === command.style && queued.mayCharge === command.mayCharge && queued.facing !== command.facing) {
      const neutral: AttackCommand = { ...queued, facing: 0 };
      buffer.pending = neutral;
      buffer.previousRequest = neutral;
      return;
    }
  }
  buffer.pending = command;
  buffer.previousRequest = command;
}

/** Whether the queued attack's frame has come and its grace has not run out. */
export function hasPendingAttack({ graceFrames, pending }: Readonly<AttackBuffer>, frame: number): boolean {
  return pending !== undefined && frame >= pending.frame && frame - pending.frame <= graceFrames;
}

/**
 * Takes the queued attack when it is due and the fighter may start it. An
 * attack that waited past its grace is dropped.
 */
export function takeAttack(buffer: AttackBuffer, frame: number, allowed: boolean): AttackCommand | undefined {
  buffer.consumedFacing = 0;
  buffer.consumedMayCharge = false;
  const command = buffer.pending;
  if (command === undefined || frame < command.frame) return undefined;
  if (!hasPendingAttack(buffer, frame)) {
    clearAttackBuffer(buffer);
    return undefined;
  }
  if (!allowed) return undefined;
  buffer.pending = undefined;
  buffer.consumedFacing = command.facing;
  buffer.consumedMayCharge = command.mayCharge;
  return command;
}

/**
 * Keeps a queued attack due while a freeze holds it, as a parried hit's does:
 * its grace counts from the frame now, so it starts on the first actionable frame.
 */
export function holdAttack(buffer: AttackBuffer, frame: number): void {
  const command = buffer.pending;
  if (command === undefined || command.frame >= frame || frame - command.frame > buffer.graceFrames) return;
  const held: AttackCommand = { ...command, frame };
  buffer.pending = held;
  buffer.previousRequest = held;
}
