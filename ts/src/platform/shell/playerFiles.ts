// Player files for saved bindings: a player's file is read on that player's
// client and its text synchronized to every client before anyone uses it;
// saving writes the owner's file. The file format is FileIO's (fileio.ts), so
// files the Wurst map saved still load.
import type { BindingLoadResult, BindingPersistence } from "../../game/ui/bindingSettings";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { trampoline } from "../dispatch";
import { readChunks, writeChunks } from "../fileio";

export const PLAYER_FILE_RECEIVED = "shell.playerFileReceived";
const MORE_PREFIX = "SC_FL";
const LAST_PREFIX = "SC_FE";
/** Characters per synchronized message and per stored chunk. */
const CHUNK = 200;
const BINDINGS_FILE = "MeleePrototypeBindings.pld";

interface PendingLoad {
  readonly owner: number;
  readonly complete: (result: BindingLoadResult) => void;
  received: string;
}

interface PlayerFiles {
  /** Every client requests the same loads in the same order; one synchronizes at a time. */
  readonly queue: PendingLoad[];
}

declare global {
  var __smashcraftPlayerFiles: PlayerFiles | undefined;
}

function files(): PlayerFiles {
  return (globalThis.__smashcraftPlayerFiles ??= { queue: [] });
}

/** The owner's client sends the first queued file. */
function sendNext(): void {
  const next = files().queue[0];
  if (next === undefined || GetLocalPlayer() !== Player(next.owner)) return;
  const text = readChunks(BINDINGS_FILE).join("");
  let offset = 0;
  while (text.length - offset > CHUNK) {
    BlzSendSyncData(MORE_PREFIX, text.substring(offset, offset + CHUNK));
    offset += CHUNK;
  }
  BlzSendSyncData(LAST_PREFIX, text.substring(offset));
}

/** A chunk of the first queued file arrived on this client. */
export function playerFileReceived(): void {
  const { queue } = files();
  const pending = queue[0];
  if (pending === undefined || GetPlayerId(GetTriggerPlayer()) !== pending.owner) return;
  pending.received += BlzGetTriggerSyncData();
  if (BlzGetTriggerSyncPrefix() !== LAST_PREFIX) return;
  queue.shift();
  pending.complete(pending.received === "" ? { kind: "empty" } : { kind: "loaded", encoded: pending.received });
  sendNext();
}

/** Registers the synchronized receipt once; its handler is registered by name at every install. */
export function startPlayerFiles(): void {
  const trigger = CreateTrigger();
  for (const slot of PARTICIPANT_SLOTS) {
    BlzTriggerRegisterPlayerSyncEvent(trigger, Player(slot), MORE_PREFIX, false);
    BlzTriggerRegisterPlayerSyncEvent(trigger, Player(slot), LAST_PREFIX, false);
  }
  TriggerAddAction(trigger, trampoline(PLAYER_FILE_RECEIVED));
}

function chunks(text: string): string[] {
  const parts: string[] = [];
  for (let offset = 0; offset < text.length; offset += CHUNK) parts.push(text.substring(offset, offset + CHUNK));
  return parts;
}

export const bindingFiles: BindingPersistence = {
  load(owner, complete) {
    if (GetPlayerSlotState(Player(owner)) !== PLAYER_SLOT_STATE_PLAYING) {
      complete({ kind: "unavailable" });
      return;
    }
    const { queue } = files();
    queue.push({ owner, complete, received: "" });
    if (queue.length === 1) sendNext();
  },
  save(owner, encoded) {
    if (GetLocalPlayer() === Player(owner)) writeChunks(BINDINGS_FILE, chunks(encoded));
  },
};
