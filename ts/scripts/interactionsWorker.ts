


import { fighterNamed, interactionRows } from "./interactions";
import { comboRows } from "./comboTrees";
import { throwFighterNamed, throwRoleRows } from "./throwRoles";

declare const self: Worker;

type InteractionRequest = { readonly fighter: string; readonly combos: boolean } | { readonly throwRoles: string };

self.onmessage = (event: MessageEvent<InteractionRequest>) => {
  const request = event.data;
  if ("throwRoles" in request) {
    const entry = throwFighterNamed(request.throwRoles);
    if (entry === undefined) throw new Error(`no fighter named ${request.throwRoles}`);
    self.postMessage(throwRoleRows(entry, (line) => console.info(line)));
    return;
  }
  const entry = fighterNamed(request.fighter);
  if (entry === undefined) throw new Error(`no fighter named ${request.fighter}`);
  const interactions = interactionRows(entry);
  const started = performance.now();
  const combos = request.combos ? comboRows(entry, (opening, rows) => console.info(`${entry.name} combos: ${opening}; ${rows} opening/percent rows; ${((performance.now() - started) / 1000).toFixed(1)} s`)) : [];
  self.postMessage({ interactions, combos });
};
