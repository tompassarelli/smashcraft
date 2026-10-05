// Player files for saved bindings: a player's file is read on that player's
// client and its text synchronized to every client before anyone uses it;
// saving writes the owner's file. The file format is FileIO's (fileio.ts), so
// files the Wurst map saved still load.
import type { BindingPersistence } from "../../game/ui/bindingSettings";
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { trampoline } from "wisp/src/platform/dispatch";
import { readChunks, writeChunks } from "wisp/src/platform/fileio";
import { departPlayerFiles, enqueuePlayerFile, receivePlayerFileChunk, type PlayerFileQueue } from "./playerFileQueue";

export const PLAYER_FILE_RECEIVED = "shell.playerFileReceived";
const MORE_PREFIX = "SC_FL";
const LAST_PREFIX = "SC_FE";
/** Characters per synchronized message and per stored chunk. */
const CHUNK = 200;
const BINDINGS_FILE = "MeleePrototypeBindings.pld";

declare global {
  var __smashcraftPlayerFiles: PlayerFileQueue | undefined;
}

function files(): PlayerFileQueue {
  return (globalThis.__smashcraftPlayerFiles ??= { queue: [] });
}

/** The owner's client sends the first queued file. */
function sendFile(owner: number): void {
  if (GetLocalPlayer() !== Player(owner)) return;
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
  receivePlayerFileChunk(files(), GetPlayerId(GetTriggerPlayer()), BlzGetTriggerSyncData(), BlzGetTriggerSyncPrefix() === LAST_PREFIX, sendFile);
}

export function playerFilesOwnerLeft(owner: number): void {
  departPlayerFiles(files(), owner, sendFile);
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
    enqueuePlayerFile(files(), owner, complete, sendFile);
  },
  save(owner, encoded) {
    if (GetLocalPlayer() === Player(owner)) writeChunks(BINDINGS_FILE, chunks(encoded));
  },
};
