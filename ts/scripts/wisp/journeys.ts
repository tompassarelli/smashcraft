



import { join } from "node:path";
import type { HeadlessProject } from "wisp/scripts/wisp/headless";
import type { Journey } from "wisp/src/headless/journey";
import { DESYNC_COMMAND, FROZEN_THRONE_QUICK_COMMAND, QUICK_CPU_COMMAND } from "../../src/game/shell/devSettings";
import { SLOTS_COMMAND, STOCKS_COMMAND } from "../../src/game/shell/sessionSetup";
import { SMASHCRAFT_HEADLESS } from "./headless";
import { SMASHCRAFT_SCENE } from "./playerView";
import { QUICK_MATCH } from "./quickMatch";


const DESYNC: Journey = {
  frames: QUICK_MATCH.frames,
  events: [...QUICK_MATCH.events, { frame: 540, player: 1, chat: DESYNC_COMMAND }],
};

const LEFT = 0x25;
const RIGHT = 0x27;

const CPU_EXPERT: Journey = {
  frames: 5400,
  events: [
    { frame: 30, player: 0, chat: `${QUICK_CPU_COMMAND}wren expert` },
    ...Array.from({ length: 25 }, (_, step) => 200 + step * 200).flatMap(frame => [
      { frame, player: 0, key: RIGHT, meta: 0, down: true },
      { frame: frame + 40, player: 0, key: RIGHT, meta: 0, down: false },
      { frame: frame + 90, player: 0, key: LEFT, meta: 0, down: true },
      { frame: frame + 130, player: 0, key: LEFT, meta: 0, down: false },
    ]),
  ],
};

const COMPUTER_MATCH: Journey = {
  frames: 9000,
  events: [
    { frame: 20, player: 0, chat: `${SLOTS_COMMAND}1 2` },
    { frame: 25, player: 0, chat: `${STOCKS_COMMAND}4` },
    { frame: 30, player: 0, chat: `${QUICK_CPU_COMMAND}wren expert` },
  ],
};

export const TEXT_JOURNEYS: readonly string[] = ["text-match"];

export const SMASHCRAFT_JOURNEYS: HeadlessProject = {
  map: SMASHCRAFT_HEADLESS,
  entry: join(import.meta.dir, "../../src/platform/devMain.ts"),
  journeys: { "quick-match": QUICK_MATCH, desync: DESYNC, "cpu-expert": CPU_EXPERT, "computer-match": COMPUTER_MATCH, "frozen-throne": { ...QUICK_MATCH, events: QUICK_MATCH.events.map((event) => "chat" in event && event.frame === 30 ? { ...event, chat: FROZEN_THRONE_QUICK_COMMAND } : event) } },
  scene: SMASHCRAFT_SCENE,
};
