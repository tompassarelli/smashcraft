


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
