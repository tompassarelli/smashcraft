


import { CARRIER_KEYS, COMMIT_KEY, type KeyboardMailbox, decodeChunk } from "../game/netcode/journal/keyboard";
import { writeLine } from "wisp/src/platform/fileio";

const isDown = (key: number) => BlzIsKeyPressed(ConvertOsKeyType(key));

function acknowledge(mailbox: KeyboardMailbox): void {
  const { name, line } = mailbox.receipt();
  writeLine(name, line);
}


export function pollMailbox(mailbox: KeyboardMailbox): boolean {
  if (!BlzIsLocalClientActive()) return false;
  const commit = isDown(COMMIT_KEY);
  if (!mailbox.pending(commit)) return false;
  const chunk = decodeChunk(CARRIER_KEYS.map((key) => isDown(key)));
  if (chunk === undefined) return false;
  if (mailbox.take(commit, chunk)) acknowledge(mailbox);
  return true;
}


export function releaseMessage(mailbox: KeyboardMailbox): void {
  if (mailbox.release()) acknowledge(mailbox);
}
