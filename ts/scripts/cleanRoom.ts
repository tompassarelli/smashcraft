



import { join } from "node:path";
import { Effect } from "effect";
import { type Policy, runCleanRoom } from "wisp/scripts/cleanRoom";

const SMASHCRAFT_POLICY: Policy = { origins: ["original", "generated", "stock-path"] };

if (import.meta.main) await Effect.runPromise(runCleanRoom(join(import.meta.dir, "../.."), SMASHCRAFT_POLICY));
