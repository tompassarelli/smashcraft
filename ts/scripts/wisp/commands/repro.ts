




import { join } from "node:path";
import { makeRepro } from "wisp/scripts/wisp/commands/repro";
import { SMASHCRAFT_HEADLESS } from "../headless";

const game = join(import.meta.dir, "../../../src/game/replay");

export const repro = makeRepro(async () => ({ map: SMASHCRAFT_HEADLESS, replay: join(game, "moment.ts"), tests: join(game, "repros"), soak: { project: join(import.meta.dir, "../soak.ts"), tests: join(import.meta.dir, "../../../test/repros") }, viewerSources: { project: join(game, "../../../tsconfig.game.json"), file: join(game, "snapshot.ts"), type: "ReplayState" } }));
