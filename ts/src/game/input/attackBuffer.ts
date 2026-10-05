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
}

export function attackBuffer(graceFrames: number): AttackBuffer {
  return { graceFrames: Math.max(0, graceFrames), pending: undefined };
}

/** A field-by-field copy: Lua's Object.assign skips an undefined pending. */
export function copyAttackBuffer(target: AttackBuffer, source: Readonly<AttackBuffer>): void {
  target.graceFrames = source.graceFrames;
  target.pending = source.pending;
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
      buffer.pending = { ...queued, facing: 0 };
      return;
    }
  }
  buffer.pending = command;
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
  const command = buffer.pending;
  if (command === undefined || frame < command.frame) return undefined;
  if (!hasPendingAttack(buffer, frame)) {
    buffer.pending = undefined;
    return undefined;
  }
  if (!allowed) return undefined;
  buffer.pending = undefined;
  return command;
}
