import type { Direction } from "./inputRow";


export const ATTACK_BUFFER_FRAMES = 6;





export interface AttackCommand {

  readonly style: number;

  readonly facing: Direction;

  readonly frame: number;

  readonly mayCharge: boolean;
}

type StoredAttackCommand = { -readonly [Field in keyof AttackCommand]: AttackCommand[Field] };


export interface AttackBuffer {
  readonly queued: StoredAttackCommand;
  readonly previous: StoredAttackCommand;
  graceFrames: number;
  pending: AttackCommand | undefined;

  previousRequest: AttackCommand | undefined;

  consumedFacing: Direction;
  consumedMayCharge: boolean;
}


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
  const request = (): StoredAttackCommand => ({ style: 0, facing: 0, frame: 0, mayCharge: false });
  return { queued: request(), previous: request(), graceFrames: Math.max(0, graceFrames), pending: undefined, previousRequest: undefined, consumedFacing: 0, consumedMayCharge: false };
}

function copyCommand(target: StoredAttackCommand, source: Readonly<AttackCommand>): void {
  target.style = source.style;
  target.facing = source.facing;
  target.frame = source.frame;
  target.mayCharge = source.mayCharge;
}

function storeCommand(buffer: AttackBuffer, command: Readonly<AttackCommand>): void {
  copyCommand(buffer.queued, command);
  copyCommand(buffer.previous, command);
  buffer.pending = buffer.queued;
  buffer.previousRequest = buffer.previous;
}


export function clearAttackBuffer(buffer: AttackBuffer): void {
  for (const command of [buffer.queued, buffer.previous]) {
    command.style = 0;
    command.facing = 0;
    command.frame = 0;
    command.mayCharge = false;
  }
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

// Lua Object.assign skips undefined requests.
export function copyAttackBuffer(target: AttackBuffer, source: Readonly<AttackBuffer>): void {
  target.graceFrames = source.graceFrames;
  if (source.pending !== undefined) copyCommand(target.queued, source.pending);
  if (source.previousRequest !== undefined) copyCommand(target.previous, source.previousRequest);
  target.pending = source.pending === undefined ? undefined : target.queued;
  target.previousRequest = source.previousRequest === undefined ? undefined : target.previous;
  target.consumedFacing = source.consumedFacing;
  target.consumedMayCharge = source.consumedMayCharge;
}

const GRAB = 5;
const isSmash = (style: number) => style >= 2 && style <= 4;
const isTilt = (style: number) => style >= 6;


function precedence({ style, mayCharge }: AttackCommand): number {
  if (style === GRAB) return 5;
  if (isSmash(style)) return mayCharge ? 3 : 4;
  return isTilt(style) ? 2 : style;
}

// Resolve equal-frame requests by precedence and style so callback order cannot decide.





export function queueAttack(buffer: AttackBuffer, command: AttackCommand): void {
  if (command.style < 0 || command.style > 10) return;
  const queued = buffer.pending;
  if (queued !== undefined && queued.frame === command.frame) {
    const order = precedence(queued) - precedence(command);
    if (order > 0 || (order === 0 && queued.style > command.style)) return;
    if (queued.style === command.style && queued.mayCharge === command.mayCharge && queued.facing !== command.facing) {
      buffer.queued.facing = 0;
      buffer.previous.facing = 0;
      return;
    }
  }
  storeCommand(buffer, command);
}


export function hasPendingAttack({ graceFrames, pending }: Readonly<AttackBuffer>, frame: number): boolean {
  return pending !== undefined && frame >= pending.frame && frame - pending.frame <= graceFrames;
}





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

  return { ...command };
}





export function holdAttack(buffer: AttackBuffer, frame: number): void {
  const command = buffer.pending;
  if (command === undefined || command.frame >= frame || frame - command.frame > buffer.graceFrames) return;
  buffer.queued.frame = frame;
  buffer.previous.frame = frame;
}
