// Smashcraft's headless journeys (wisp:docs/headless.md), played by
// `bun wisp headless` and after every save by `bun wisp dev`: simulated
// clients of the development build, whose entry starts the scene recorder.
// It imports no host services, so a journey process loads only the map.
import { join } from "node:path";
import type { HeadlessProject } from "wisp/scripts/wisp/headless";
import type { Journey } from "wisp/src/headless/journey";
import { DESYNC_COMMAND, QUICK_MATCH_COMMAND } from "../../src/game/shell/devSettings";
import { SMASHCRAFT_HEADLESS } from "./headless";
import { SMASHCRAFT_SCENE } from "./playerView";

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

export const SMASHCRAFT_JOURNEYS: HeadlessProject = {
  map: SMASHCRAFT_HEADLESS,
  entry: join(import.meta.dir, "../../src/platform/devMain.ts"),
  journeys: { "quick-match": QUICK_MATCH, desync: DESYNC },
  scene: SMASHCRAFT_SCENE,
};
