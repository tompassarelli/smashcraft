


import type { Journey } from "wisp/src/headless/journey";
import { QUICK_MATCH_COMMAND } from "../../src/game/shell/devSettings";


const TRACE_KEY = { key: 0x54, meta: 2 };





export const QUICK_MATCH: Journey = {
  frames: 600,
  events: [
    { frame: 30, player: 0, chat: QUICK_MATCH_COMMAND },
    { frame: 150, player: 0, ...TRACE_KEY },
    { frame: 480, reload: true },
  ],
};
