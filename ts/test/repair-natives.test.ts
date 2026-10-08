// Rollback repair replays corrected frames numerically: presentation, audio,
// effects and every other Warcraft native stay with the completed state
// (src/platform/shell/rollback.ts), so a deep correction costs only Lua.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { botBeatKeys } from "../scripts/wisp/botMatch";
import { ReplayHistory } from "../src/game/replay/history";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("rollback repair re-simulates corrected frames without a single native call [spec #168]", () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0, 1], {
    delivery: syncDelivery(MEASURED_BATTLE_NET, 7),
  });
  let repairing = 0;
  let steps = 0;
  const calls = new Map<string, number>();
  const history = ReplayHistory.prototype as unknown as { repair: (this: ReplayHistory, ...args: unknown[]) => number | "rejected" };
  const repair = history.repair;
  history.repair = function (...args) {
    repairing++;
    try {
      const replayed = repair.apply(this, args);
      if (typeof replayed === "number") steps += replayed;
      return replayed;
    } finally {
      repairing--;
    }
  };
  try {
    for (const client of clients.clients) {
      for (const [name, native] of Object.entries(client.natives)) {
        if (typeof native !== "function") continue;
        client.natives[name] = (...args: unknown[]) => {
          if (repairing > 0) calls.set(name, (calls.get(name) ?? 0) + 1);
          return (native as (...args: unknown[]) => unknown)(...args);
        };
      }
    }
    clients.start();
    clients.frames(30);
    clients.chat(0, "-dev quick");
    clients.frames(30);
    // The bot session's beat on both players: taps, shields and dashes the other client predicts wrong.
    let held = 0;
    for (let frame = 1; frame <= 90; frame++) {
      const [tap, hold] = botBeatKeys(frame);
      for (const player of clients.clients) for (const client of clients.clients) {
        if (hold !== held && held !== 0) client.key(player.slot, held, 0, false);
        if (hold !== held && hold !== 0) client.key(player.slot, hold, 0, true);
        if (tap !== 0) client.key(player.slot, tap, 0, true);
      }
      held = hold;
      clients.frames(1);
      if (tap !== 0) for (const player of clients.clients) for (const client of clients.clients) client.key(player.slot, tap, 0, false);
    }
  } finally {
    history.repair = repair;
  }
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(clients.firstDivergence()).toBeUndefined();
  expect(steps).toBeGreaterThan(20);
  expect(Object.fromEntries(calls)).toEqual({});
});
