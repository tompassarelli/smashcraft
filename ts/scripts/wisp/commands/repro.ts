// `wisp repro FILE [--test NAME]`: replays a moment a player saved with K,
// or a controller's View held for a second, in two simulated clients, which
// must land on the checksum the game recorded; --test NAME writes
// src/game/replay/repros/NAME.tests.ts, which replays it in Bun and 32-bit Lua
// (wisp:docs/repro.md, smashcraft:ts/src/game/replay/moment.ts).
import { join } from "node:path";
import { makeRepro } from "wisp/scripts/wisp/commands/repro";
import { SMASHCRAFT_HEADLESS } from "../headless";

const game = join(import.meta.dir, "../../../src/game/replay");

export const repro = makeRepro(async () => ({
  map: SMASHCRAFT_HEADLESS, replay: join(game, "moment.ts"), tests: join(game, "repros"),
  soak: { project: join(import.meta.dir, "../soak.ts"), tests: join(import.meta.dir, "../../../test/repros") },
}));
