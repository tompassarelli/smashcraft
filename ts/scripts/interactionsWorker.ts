// One fighter's interaction rows on a worker thread, so `bun wisp
// interactions` plays the fighters at once (smashcraft:ts/scripts/interactions.ts).
import { fighterNamed, interactionRows } from "./interactions";
import { comboRows } from "./comboTrees";

declare const self: Worker;

interface InteractionRequest { readonly fighter: string; readonly combos: boolean }

self.onmessage = (event: MessageEvent<InteractionRequest>) => {
  const entry = fighterNamed(event.data.fighter);
  if (entry === undefined) throw new Error(`no fighter named ${event.data.fighter}`);
  const interactions = interactionRows(entry);
  const started = performance.now();
  const combos = event.data.combos ? comboRows(entry, (opening, rows) => console.info(`${entry.name} combos: ${opening}; ${rows} opening/percent rows; ${((performance.now() - started) / 1000).toFixed(1)} s`)) : [];
  self.postMessage({ interactions, combos });
};
