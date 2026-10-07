import { Capture } from "../netcode/capture";
import { ALL_ACTIONS, Action, has } from "./actions";
import { type DirectionalInput, clearPulse, directionOf, neutralDirections, pulsePending, updateDirections } from "./directionalInput";
import { type InputRow, THROW_CONTRIBUTION_LIMIT, emptyInput, predictInto } from "./inputRow";

/**
 * One client's keyboard sampler. Holds follow the latest sample; press edges,
 * press-time vectors and throw taps latch until a schedule accepts the row, so
 * a tap between two samples, or while the schedule waits, reaches a row.
 * Construct once at common initialization.
 */
export interface KeyboardCapture {
  /** The row the next capture assigns; always one a controller can send. */
  readonly row: InputRow;
  readonly directions: DirectionalInput;
}

/** A schedule that assigns local samples to frames, fixed or shadow. */
interface LocalSchedule {
  captureLocal(epoch: number, sample: Readonly<InputRow>): Capture;
}

export function keyboardCapture(): KeyboardCapture {
  // Preallocated: every input callback samples into this row in place.
  return { row: emptyInput(), directions: neutralDirections() };
}

const isMask = (held: number) => held >= 0 && held <= ALL_ACTIONS;
const horizontal = (mask: number) => directionOf(mask, Action.moveRight, Action.moveLeft);
const vertical = (mask: number) => directionOf(mask, Action.moveUp, Action.moveDown);
const clampThrow = (count: number) => Math.max(-THROW_CONTRIBUTION_LIMIT, Math.min(THROW_CONTRIBUTION_LIMIT, count));

/** Opposite directions cancel, and C-stick actions never move the stick. */
function hold({ row }: KeyboardCapture, held: number): void {
  row.held = held;
  row.axisX = 127 * horizontal(held);
  row.axisZ = 127 * vertical(held);
  row.triggerLeft = has(held, Action.leftTrigger) ? 255 : has(held, Action.lightShield) ? 77 : 0;
  row.triggerRight = has(held, Action.rightTrigger) ? 255 : 0;
}

/** Samples the held action mask; false, changing nothing, for a mask no keyboard holds. */
export function sampleKeys(capture: KeyboardCapture, held: number): boolean {
  if (!isMask(held)) return false;
  const { row, directions } = capture;
  const rose = held & (ALL_ACTIONS ^ row.held);
  const fell = row.held & (ALL_ACTIONS ^ held);
  const x = horizontal(held);
  const z = vertical(held);
  // The first uncommitted Special keeps its direction. A sample sees which
  // directions are held, not the order of keys that changed since the last one.
  if (has(rose, Action.special) && !has(row.pressed, Action.special)) {
    row.specialX = x;
    row.specialZ = z;
  }
  // Every fresh shield press overwrites the dodge direction, as the native callback does.
  if (has(rose, Action.leftTrigger) || has(rose, Action.rightTrigger) || has(rose, Action.lightShield)) {
    row.dodgeX = x;
    row.dodgeZ = z;
  }
  // Up and down pressed in one sample have no order, so they cancel.
  if (has(rose, Action.moveUp) || has(rose, Action.moveDown)) row.ledgeVertical = vertical(rose);
  row.pressed |= rose;
  row.released |= fell;
  row.throwX = clampThrow(row.throwX + horizontal(rose) + directionOf(rose, Action.smashRight, Action.smashLeft));
  row.throwZ = clampThrow(row.throwZ + vertical(rose) + directionOf(rose, Action.smashUp, Action.smashDown));
  updateDirections(directions, x, z);
  row.sdi = pulsePending(directions);
  row.sdiX = directions.pulseX;
  row.sdiZ = directions.pulseZ;
  hold(capture, held);
  return true;
}

/**
 * Clears one-shot input once a schedule has accepted the row. The sampler is
 * the only owner of edges, so they stay latched while the frontier stalls.
 */
export function commitEdges(capture: KeyboardCapture): void {
  // Holds, stick and triggers continue and everything else is one-shot: what prediction keeps.
  predictInto(capture.row, capture.row);
  clearPulse(capture.directions);
}

/** Offers the row to the schedule and commits its edges only if the schedule took it. */
export function captureKeys(capture: KeyboardCapture, schedule: LocalSchedule, epoch: number): Capture {
  const result = schedule.captureLocal(epoch, capture.row);
  if (result === Capture.captured) commitEdges(capture);
  return result;
}

/**
 * Resumes from the keys held now without inventing presses, as at a new epoch.
 * Focus loss during play samples 0 instead, so its releases reach the next
 * row. False, changing nothing, for a mask no keyboard holds.
 */
export function resetKeys(capture: KeyboardCapture, held: number): boolean {
  if (!isMask(held)) return false;
  commitEdges(capture);
  hold(capture, held);
  updateDirections(capture.directions, horizontal(held), vertical(held));
  clearPulse(capture.directions);
  return true;
}
