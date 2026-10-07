// Native stage-art acceptance: one hosted game per artifact, reset between stages.
import { homedir } from "node:os";
import { join } from "node:path";
import type { NativeCheck } from "wisp/scripts/wisp/accept";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";

const ARTIFACTS = [{ phase: "before", file: "before.w3x" }, { phase: "after", file: "composition.w3x" }] as const;
export const STAGE_COMPOSITION_MAPS = Object.fromEntries(ARTIFACTS.map(({ phase, file }) => [`composition-${phase}`, {
  describe: `stage composition ${phase} artifact; all nine stages in one hosted game`,
  path: join(homedir(), ".local/share/smashcraft-stage-design-178", file),
  quick: "-dev quick",
}]));

export const STAGE_COMPOSITION_CHECKS: readonly NativeCheck[] = ARTIFACTS.flatMap(({ phase }) => STAGE_CATALOG.flatMap(({ id, name }): NativeCheck[] => [
  {
    id: `178-${phase}-${id}-scene`, closes: "smashcraft#178 box 3", map: `composition-${phase}`,
    setup: [{ chat: "-dev reset" }, { chat: `-dev quick stage ${id}` }, { chat: "-dev backdrop on" }, { waitMs: 5000 }, { keys: ["y"] }],
    capture: [{ kind: "frames", name: "composition", client: "a" }, { kind: "frames", name: "composition", client: "b" }],
    pass: [
      { kind: "log", pattern: "^model creation failed - war3mapImported", since: "session", max: 0 },
      { kind: "receipt", pattern: "^error \\d+ in ", max: 0 },
    ],
    look: phase === "before" ? `${name}: retained pre-change sky and scenery; same paused fighters and camera as the after sample.`
      : `${name}: original sky drawn (Nordrassil aurora preserved), distant landmark and low framing silhouettes visible behind the arena, no oversized foreground prop. Compare the matching before capture; fighters and deck edges remain distinguishable.`,
  },
  {
    id: `178-${phase}-${id}-mask`, closes: "smashcraft#178 box 3", map: `composition-${phase}`,
    setup: [{ chat: "-dev backdrop off" }, { waitMs: 13000 }],
    capture: [{ kind: "frames", name: "mask", client: "a" }, { kind: "frames", name: "mask", client: "b" }],
    pass: [{ kind: "receipt", pattern: "^error \\d+ in ", max: 0 }],
    look: `${name}: paused fighters alone, same pose and camera as ${phase} composition capture; measure contrast with smashcraft:tools/stage/contrast.ts and run existing player-view/frame checks.`,
  },
]));
