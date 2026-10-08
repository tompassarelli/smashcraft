// Smashcraft's clean-room check (wisp:docs/clean-room.md, wisp:scripts/cleanRoom.ts).
// Smashcraft is a Warcraft map: its code may name stock assets by in-game path,
// but a committed copy still needs a row in smashcraft:clean-room-allowlist.tsv.
// Usage: bun scripts/cleanRoom.ts
import { join } from "node:path";
import { Effect } from "effect";
import { type Policy, runCleanRoom } from "wisp/scripts/cleanRoom";

export const SMASHCRAFT_POLICY: Policy = { origins: ["original", "generated", "stock-path"] };

if (import.meta.main) await Effect.runPromise(runCleanRoom(join(import.meta.dir, "../.."), SMASHCRAFT_POLICY));
