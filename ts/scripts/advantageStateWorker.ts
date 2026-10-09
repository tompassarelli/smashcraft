import type { Character } from "../src/game/sim/codes";
import { TARGETS, advantageRow } from "./advantageState";

declare const self: Worker;

self.onmessage = (event: MessageEvent<{ readonly attacker: Character; readonly target: number }>) => {
  const { attacker, target } = event.data;
  const weight = TARGETS[target];
  if (weight === undefined) throw new Error(`no target ${target}`);
  self.postMessage(advantageRow(attacker, weight));
};
