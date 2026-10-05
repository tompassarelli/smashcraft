// Natives of keyboard journal ingress (game/netcode/journal/keyboard.ts): the
// carrier keys are polled on the local client, and receipts are written for
// the helper.
import { CARRIER_KEYS, COMMIT_KEY, type KeyboardMailbox, decodeChunk } from "../game/netcode/journal/keyboard";
import { writeLine } from "./fileio";

const isDown = (key: number) => BlzIsKeyPressed(ConvertOsKeyType(key));

function acknowledge(mailbox: KeyboardMailbox): void {
  const { name, line } = mailbox.receipt();
  writeLine(name, line);
}

/** Takes a newly published chunk off the keys; true when one was taken. */
export function pollMailbox(mailbox: KeyboardMailbox): boolean {
  if (!BlzIsLocalClientActive()) return false;
  const commit = isDown(COMMIT_KEY);
  if (!mailbox.pending(commit)) return false;
  const chunk = decodeChunk(CARRIER_KEYS.map((key) => isDown(key)));
  if (chunk === undefined) return false;
  if (mailbox.take(commit, chunk)) acknowledge(mailbox);
  return true;
}

/** Forgets the used message and acknowledges its final chunk, so the helper sends the next. */
export function releaseMessage(mailbox: KeyboardMailbox): void {
  if (mailbox.release()) acknowledge(mailbox);
}
