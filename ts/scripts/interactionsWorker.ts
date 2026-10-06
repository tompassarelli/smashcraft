// One fighter's interaction rows on a worker thread, so `bun wisp
// interactions` plays the fighters at once (smashcraft:ts/scripts/interactions.ts).
import { fighterNamed, interactionRows } from "./interactions";

declare const self: Worker;

self.onmessage = (event: MessageEvent<string>) => {
  const entry = fighterNamed(event.data);
  if (entry === undefined) throw new Error(`no fighter named ${event.data}`);
  self.postMessage(interactionRows(entry));
};
