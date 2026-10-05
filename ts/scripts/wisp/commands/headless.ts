// `wisp headless [quick-match|desync] [--clients N]`: plays a journey in
// simulated clients of the development build, whose entry starts the scene
// recorder, and prints a desync, error reports, a hot reload that didn't run
// and what a player would see wrong (wisp:docs/headless.md).
import { join } from "node:path";
import { makeHeadless } from "wisp/scripts/wisp/commands/headless";
import type { Journey } from "wisp/src/headless/journey";
import { DESYNC_COMMAND, QUICK_MATCH_COMMAND } from "../../../src/game/shell/devSettings";
import { SMASHCRAFT_HEADLESS } from "../headless";
import { SMASHCRAFT_SCENE } from "../playerView";
import { tsDirectory } from "../project";

/** Ctrl+T, the input trace key. */
const TRACE_KEY = { key: 0x54, meta: 2 };

/**
 * Start, `-dev quick`, a traced match, a hot reload mid-match and more match:
 * the desync guard's 600 frames, with the reload sent through the map's reloader.
 */
const QUICK_MATCH: Journey = {
  frames: 600,
  events: [
    { frame: 30, player: 0, chat: QUICK_MATCH_COMMAND },
    { frame: 150, player: 0, ...TRACE_KEY },
    { frame: 480, reload: true },
  ],
};

/** The quick match with `-dev desync` typed by the second player: the desync it must report. */
const DESYNC: Journey = {
  frames: QUICK_MATCH.frames,
  events: [...QUICK_MATCH.events, { frame: 540, player: 1, chat: DESYNC_COMMAND }],
};

export const headless = makeHeadless(async () => ({
  map: SMASHCRAFT_HEADLESS,
  entry: join(tsDirectory, "src/platform/devMain.ts"),
  journeys: { "quick-match": QUICK_MATCH, desync: DESYNC },
  scene: SMASHCRAFT_SCENE,
}));
