// Temporary until ParticipantInputs lands: the two facts the simulation needs
// from it. Replace these exports with imports from that module.

export const INPUT_PARTICIPANT_CAPACITY = 4;

/** Masks name Warcraft player slots; only masks below 16 with a set bit are valid. */
export function participantIsActive(mask: number, slot: number): boolean {
  return mask > 0 && mask < 16 && slot >= 0 && slot < INPUT_PARTICIPANT_CAPACITY && (mask & (1 << slot)) !== 0;
}
