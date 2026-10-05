import { type InputRow, emptyInput } from "./inputRow";

/**
 * One input row per Warcraft player slot. Readers fill active slots only, so
 * an inactive slot never stands for neutral input.
 *
 * Preallocated: rollback replays refill these rows every frame; reuse them, never replace them.
 */
export type ParticipantInputs = readonly [InputRow, InputRow, InputRow, InputRow];

export const PARTICIPANT_CAPACITY: ParticipantInputs["length"] = 4;

export function participantInputs(): ParticipantInputs {
  return [emptyInput(), emptyInput(), emptyInput(), emptyInput()];
}

/**
 * Participant masks name player slots by bit and are fixed per epoch. They are
 * not packet records, which are consecutive frames from one sender.
 */
export function isParticipantMask(mask: number): boolean {
  return mask > 0 && mask < (1 << PARTICIPANT_CAPACITY);
}

export function participantActive(mask: number, slot: number): boolean {
  return isParticipantMask(mask) && slot >= 0 && slot < PARTICIPANT_CAPACITY && (mask & (1 << slot)) !== 0;
}
