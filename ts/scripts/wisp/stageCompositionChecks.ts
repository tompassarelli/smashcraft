// Native stage-art acceptance: the native lane owns all clients and captures.
import { homedir } from "node:os";
import { join } from "node:path";
import type { NativeCheck } from "wisp/scripts/wisp/accept";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";

export const STAGE_COMPOSITION_MAPS = Object.fromEntries(STAGE_CATALOG.map(({ id, name }) => [`composition-${id}`, {
  describe: `stage composition candidate on ${name}; compare with the retained pre-change native capture`,
  path: join(homedir(), ".local/share/smashcraft-stage-design-178/composition.w3x"),
  quick: `-dev quick stage ${id}`,
}]));

export const STAGE_COMPOSITION_CHECKS: readonly NativeCheck[] = STAGE_CATALOG.flatMap(({ id, name }): NativeCheck[] => [
  {
    id: `178-${id}-scene`, closes: "smashcraft#178 box 3", map: `composition-${id}`,
    setup: [{ waitMs: 5000 }, { keys: ["y"] }],
    capture: [{ kind: "frames", name: "composition", client: "a" }, { kind: "frames", name: "composition", client: "b" }],
    pass: [
      { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 },
      { kind: "receipt", pattern: "^error \\d+ in ", max: 0 },
    ],
    look: `${name}: original sky drawn (Nordrassil aurora preserved), distant landmark and low framing silhouettes visible behind the arena, no oversized foreground prop. Compare the retained before capture; fighters and deck edges must remain distinguishable.`,
  },
  {
    id: `178-${id}-mask`, closes: "smashcraft#178 box 3", map: `composition-${id}`,
    setup: [{ chat: "-dev backdrop off" }, { waitMs: 13000 }],
    capture: [{ kind: "frames", name: "mask", client: "a" }, { kind: "frames", name: "mask", client: "b" }],
    pass: [{ kind: "receipt", pattern: "^error \\d+ in ", max: 0 }],
    look: `${name}: paused fighters alone, same pose and camera as composition capture; measure contrast with smashcraft:tools/stage/contrast.ts and run existing player-view/frame checks.`,
  },
]);
