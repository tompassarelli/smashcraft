import { type InputRow, emptyInput } from "./inputRow";







export type ParticipantInputs = readonly [InputRow, InputRow, InputRow, InputRow];

export const PARTICIPANT_CAPACITY: ParticipantInputs["length"] = 4;
export const PARTICIPANT_SLOTS = [0, 1, 2, 3] as const;
export type ParticipantSlot = (typeof PARTICIPANT_SLOTS)[number];
export type Slots<T> = [T, T, T, T];
const MASK_LIMIT = 1 << PARTICIPANT_CAPACITY;

export function isParticipantSlot(slot: number): slot is ParticipantSlot {
  return slot === 0 || slot === 1 || slot === 2 || slot === 3;
}

export function participantInputs(): ParticipantInputs {
  return [emptyInput(), emptyInput(), emptyInput(), emptyInput()];
}





export function isParticipantMask(mask: number): boolean {
  return mask > 0 && mask < MASK_LIMIT;
}


export function participantActive(mask: number, slot: number): boolean {
  return mask > 0 && mask < MASK_LIMIT && slot >= 0 && slot < PARTICIPANT_CAPACITY && (mask & (1 << slot)) !== 0;
}
