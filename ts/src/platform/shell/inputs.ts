// Who is playing, and the keys each player holds.
import { ACTION_ORDER, bit } from "../../game/input/actions";
import { clearAttackBuffer } from "../../game/input/attackBuffer";
import { resetKeys } from "../../game/input/keyboardCapture";
import { keyFor } from "../../game/input/keyBindings";
import { PARTICIPANT_SLOTS, type ParticipantSlot, isParticipantSlot, participantActive } from "../../game/input/participants";
import { clearKeys } from "../../game/input/playerKeys";
import { keepMomentEnd } from "../../game/replay/moment";
import { endReplaySegment } from "./replays";
import { humanFighterActive, humanPresent } from "../../game/match/rules";
import { type ShellState, localSlot } from "./state";
import { settingsOpen } from "./ui";
import { ownConfirmedState } from "./confirmedState";

/** Slots of users in the game, less those who left a match. */
export function currentHumanMask(departed: number): number {
  let mask = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const player = Player(slot);
    if (GetPlayerController(player) === MAP_CONTROL_USER && GetPlayerSlotState(player) === PLAYER_SLOT_STATE_PLAYING && !participantActive(departed, slot)) mask |= 1 << slot;
  }
  return mask;
}

export function currentComputerMask(): number {
  let mask = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    const player = Player(slot);
    if (GetPlayerController(player) === MAP_CONTROL_COMPUTER && GetPlayerSlotState(player) === PLAYER_SLOT_STATE_PLAYING) mask |= 1 << slot;
  }
  return mask;
}

function clearCapturedParticipantInputs(s: ShellState, slot: ParticipantSlot): void {
  const participant = s.participants[slot];
  clearKeys(participant.keys);
  resetKeys(participant.capture, 0);
  clearAttackBuffer(s.produced.commands[slot]);
}

/** Pausing changes transient input only; the frozen match remains one continuous replay. */
export function clearCapturedInputs(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) clearCapturedParticipantInputs(s, slot);
}

export function clearParticipantInputs(s: ShellState, slot: ParticipantSlot): void {
  ownConfirmedState(s);
  clearCapturedParticipantInputs(s, slot);
  keepMomentEnd(s.moment.recorder, s.world, s.game, s.controls, s.runtime);
  endReplaySegment(s);
  clearAttackBuffer(s.controls.commands[slot]);
}

export function clearAllInputs(s: ShellState): void {
  for (const slot of PARTICIPANT_SLOTS) clearParticipantInputs(s, slot);
}

/** A present human whose bindings have loaded and whose settings panel is closed. */
export function controlsAvailable(s: Readonly<ShellState>, slot: ParticipantSlot): boolean {
  return humanPresent(s.game, slot) && s.participants[slot].bindings.ready && !settingsOpen(s, slot);
}

/**
 * The local player's bound keys held now. Neutral while the client is in the
 * background or the local player has no fighter. Local only: it reaches other
 * clients only inside a synchronized row.
 */
export function pollLocalKeys(s: Readonly<ShellState>): number {
  const slot = localSlot();
  if (!isParticipantSlot(slot) || !BlzIsLocalClientActive() || !humanFighterActive(s.game, slot)) return 0;
  const { bindings } = s.participants[slot].bindings;
  const menuHeld = s.pauseKeysHeld;
  if (menuHeld !== undefined) {
    for (let index = menuHeld.length - 1; index >= 0; index--) {
      const key = menuHeld[index];
      if (key !== undefined && !BlzIsKeyPressed(ConvertOsKeyType(key))) menuHeld.splice(index, 1);
    }
  }
  const pressed = (key: number | undefined) => key !== undefined && !menuHeld?.includes(key) && BlzIsKeyPressed(ConvertOsKeyType(key));
  let held = 0;
  for (const action of ACTION_ORDER) {
    if (pressed(keyFor(bindings, action, 0)) || pressed(keyFor(bindings, action, 1))) held |= bit(action);
  }
  return held;
}
