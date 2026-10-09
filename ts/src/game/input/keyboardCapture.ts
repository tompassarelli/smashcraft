import { Capture } from "../netcode/capture";
import { ALL_ACTIONS, Action, has } from "./actions";
import { type DirectionalInput, clearPulse, directionOf, neutralDirections, pulsePending, updateDirections } from "./directionalInput";
import { type InputRow, THROW_CONTRIBUTION_LIMIT, emptyInput, predictInto } from "./inputRow";







export interface KeyboardCapture {

  readonly row: InputRow;
  readonly directions: DirectionalInput;
}


interface LocalSchedule {
  captureLocal(epoch: number, sample: Readonly<InputRow>): Capture;
}

export function keyboardCapture(): KeyboardCapture {

  return { row: emptyInput(), directions: neutralDirections() };
}

const isMask = (held: number) => held >= 0 && held <= ALL_ACTIONS;
const horizontal = (mask: number) => directionOf(mask, Action.moveRight, Action.moveLeft);
const vertical = (mask: number) => directionOf(mask, Action.moveUp, Action.moveDown);
const clampThrow = (count: number) => Math.max(-THROW_CONTRIBUTION_LIMIT, Math.min(THROW_CONTRIBUTION_LIMIT, count));


function hold({ row }: KeyboardCapture, held: number): void {
  row.held = held;
  row.axisX = 127 * horizontal(held);
  row.axisZ = 127 * vertical(held);
  row.triggerLeft = has(held, Action.leftTrigger) ? 255 : has(held, Action.lightShield) ? 77 : 0;
  row.triggerRight = has(held, Action.rightTrigger) ? 255 : 0;
}


export function sampleKeys(capture: KeyboardCapture, held: number): boolean {
  if (!isMask(held)) return false;
  const { row, directions } = capture;
  const rose = held & (ALL_ACTIONS ^ row.held);
  const fell = row.held & (ALL_ACTIONS ^ held);
  const x = horizontal(held);
  const z = vertical(held);


  if (has(rose, Action.special) && !has(row.pressed, Action.special)) {
    row.specialX = x;
    row.specialZ = z;
  }

  if (has(rose, Action.leftTrigger) || has(rose, Action.rightTrigger) || has(rose, Action.lightShield)) {
    row.dodgeX = x;
    row.dodgeZ = z;
  }

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





export function commitEdges(capture: KeyboardCapture): void {

  predictInto(capture.row, capture.row);
  clearPulse(capture.directions);
}


export function captureKeys(capture: KeyboardCapture, schedule: LocalSchedule, epoch: number): Capture {
  const result = schedule.captureLocal(epoch, capture.row);
  if (result === Capture.captured) commitEdges(capture);
  return result;
}






export function resetKeys(capture: KeyboardCapture, held: number): boolean {
  if (!isMask(held)) return false;
  commitEdges(capture);
  hold(capture, held);
  updateDirections(capture.directions, horizontal(held), vertical(held));
  clearPulse(capture.directions);
  return true;
}
