import { afterAll, expect } from "bun:test";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import type { HeadlessClient } from "wisp/src/headless/client";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import type { MatchState } from "../src/game/match/rules";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { measureHandleBaseline } from "../scripts/wisp/handleBaseline";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { sweep } from "./sweep";

const declarations = readNativeDeclarations();
const headless = installHeadless(PREDICTED_HEADLESS, declarations);
afterAll(headless.restore);

const gameOf = (client: HeadlessClient): MatchState => {
  let game: MatchState | undefined;
  client.run(() => {
    game = shell().game;
  });
  if (game === undefined) throw new Error(`p${client.slot} has no game`);
  return game;
};

// Two one-minute four-computer matches and a rematch cost about 20 s of CPU; `bun wisp soak memory --handles` plays the same in 32-bit Lua.
sweep("a match, its automatic rematch and the way back to fighter selection leave every Warcraft handle kind at its menu baseline [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild(PLAYABLE_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
  const result = measureHandleBaseline(clients, declarations.functions, gameOf);
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  expect(result.problems).toEqual([]);
}, 60_000);
