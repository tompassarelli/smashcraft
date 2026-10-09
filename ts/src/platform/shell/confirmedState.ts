import { copyReplayState } from "../../game/replay/snapshot";
import type { ShellState } from "./state";


export function ownConfirmedState(s: ShellState): void {
  const owned = s.ownedConfirmed;
  if (owned === undefined) return;
  copyReplayState(owned, { world: s.world, match: s.game, controls: s.controls, runtime: s.runtime });
  const scratch = owned.runtime.frameImpacts;
  owned.runtime.frameImpacts = s.runtime.frameImpacts;
  s.runtime.frameImpacts = scratch;
  s.world = owned.world;
  s.game = owned.match;
  s.controls = owned.controls;
  s.runtime = owned.runtime;
  s.ownedConfirmed = undefined;
}
