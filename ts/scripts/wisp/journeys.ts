



import { join } from "node:path";
import type { HeadlessProject } from "wisp/scripts/wisp/headless";
import type { Journey } from "wisp/src/headless/journey";
import { DESYNC_COMMAND, FROZEN_THRONE_QUICK_COMMAND } from "../../src/game/shell/devSettings";
import { SMASHCRAFT_HEADLESS } from "./headless";
import { SMASHCRAFT_SCENE } from "./playerView";
import { QUICK_MATCH } from "./quickMatch";


const DESYNC: Journey = {
  frames: QUICK_MATCH.frames,
  events: [...QUICK_MATCH.events, { frame: 540, player: 1, chat: DESYNC_COMMAND }],
};

export const SMASHCRAFT_JOURNEYS: HeadlessProject = {
  map: SMASHCRAFT_HEADLESS,
  entry: join(import.meta.dir, "../../src/platform/devMain.ts"),
  journeys: { "quick-match": QUICK_MATCH, desync: DESYNC, "frozen-throne": { ...QUICK_MATCH, events: QUICK_MATCH.events.map((event) => "chat" in event && event.frame === 30 ? { ...event, chat: FROZEN_THRONE_QUICK_COMMAND } : event) } },
  scene: SMASHCRAFT_SCENE,
};
