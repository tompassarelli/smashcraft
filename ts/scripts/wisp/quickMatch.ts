// The development build's quick match as a headless journey
// (wisp:docs/headless.md), played in Bun by journeys.ts and in 32-bit Lua by
// perfLua.ts. Plain data, so a Lua program can import it.
import type { Journey } from "wisp/src/headless/journey";
import { QUICK_MATCH_COMMAND } from "../../src/game/shell/devSettings";

/** Ctrl+T, the input trace key. */
const TRACE_KEY = { key: 0x54, meta: 2 };

/**
 * Start, `-dev quick`, a traced match, a hot reload mid-match and more match:
 * the desync guard's 600 frames, with the reload sent through the map's reloader.
 */
export const QUICK_MATCH: Journey = {
  frames: 600,
  events: [
    { frame: 30, player: 0, chat: QUICK_MATCH_COMMAND },
    { frame: 150, player: 0, ...TRACE_KEY },
    { frame: 480, reload: true },
  ],
};
