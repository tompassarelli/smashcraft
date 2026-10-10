import { afterAll, expect, test } from "bun:test";
import { installHeadless, readNativeDeclarations } from "wisp/scripts/wisp/headless";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { BASELINE_LINEUP, playHandleBaseline } from "../scripts/wisp/handleBaseline";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import type { Game } from "../scripts/wisp/botMatch";

const declarations = readNativeDeclarations();
const headless = installHeadless(SMASHCRAFT_HEADLESS, declarations);
afterAll(headless.restore);

// The census counts every handle a client creates (effect, unit, timer, sound, trigger, frame, ...) at its
// Create/Add native and uncounts it at its Destroy/Remove/KillSoundWhenDone native (scripts/wisp/memoryCensus.ts).
// The first match creates a few handles the menu keeps from then on: the stage-loading cover's frames and one
// fighter body (unit) per fighter of the last match, so fighter selection after the first match is the baseline.
test("a four-computer match and its rematch leave every client's live handles of each kind at fighter selection where the first match left them, with one fighter body per fighter [invariant]", () => {
  const clients = headless.clients({ start: () => startBuild(INTEGRITY_BUILD), install }, [0, 1], { delivery: syncDelivery(MEASURED_BATTLE_NET, 7) });
  const { cold, afterMatches } = playHandleBaseline(clients, declarations.functions, 2, (client) => {
    let game: Game | undefined;
    client.run(() => {
      game = shell().game;
    });
    if (game === undefined) throw new Error(`p${client.slot} has no shell`);
    return game;
  });
  const [first = [], rematch = []] = afterMatches;
  console.log(`p1 live handles at fighter selection: before ${JSON.stringify(cold[0])}, after the match ${JSON.stringify(first[0])}, after the rematch ${JSON.stringify(rematch[0])}`);

  expect(rematch).toEqual(first);
  for (const counts of first) expect(Object.fromEntries(counts).unit).toBe(BASELINE_LINEUP.length);
  const kept = new Set(["effect", "framehandle", "unit"]);
  rematch.forEach((counts, index) => {
    expect(counts.filter(([kind]) => !kept.has(kind))).toEqual((cold[index] ?? []).filter(([kind]) => !kept.has(kind)));
  });
  for (const client of clients.clients) expect(client.errors).toEqual([]);
}, 60_000);
