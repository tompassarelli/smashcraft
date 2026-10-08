// One fighter against one opponent at one stage position on a worker thread,
// so `bun wisp combos` measures the roster's cells at once
// (smashcraft:ts/scripts/comboExplorer.ts).
import type { Character } from "../src/game/sim/codes";
import { type Position, measureUnit } from "./comboExplorer";

declare const self: Worker;

interface UnitRequest {
  readonly attacker: Character;
  readonly opponent: Character;
  readonly position: Position;
}

self.onmessage = (event: MessageEvent<UnitRequest>) => {
  const { attacker, opponent, position } = event.data;
  self.postMessage(measureUnit(attacker, opponent, position));
};
