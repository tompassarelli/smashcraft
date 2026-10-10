import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { MatchPresentation } from "../src/game/render/matchPresentation";
import { Character } from "../src/game/sim/codes";
import { createRoster } from "../src/game/sim/roster";
import { createFighter } from "../src/game/sim/fighter";

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(runtime.restore);

test("[repro wisp#87] results pose the winner's match-start effect with different local cameras and create none", () => {
  const clients = runtime.clients({ install: () => {}, start: () => {
    SetCameraPosition(GetPlayerId(GetLocalPlayer()) === 0 ? 120 : 640, 0);
    const presentation = new MatchPresentation({ x: 0, y: 0, z: 0 });
    presentation.preparePoses(createRoster(1, [createFighter(Character.jaina, 0.0, 1)]));
    presentation.beginResults({ rows: [], winner: Character.jaina, winnerSlot: 0, x: 0, z: 0 }, 0);
    presentation.tick();
  } });
  clients.start();
  expect(clients.firstDivergence()).toBeUndefined();
  for (const client of clients.clients) {
    expect(client.errors).toEqual([]);
    expect(client.missingNatives).toEqual([]);
    expect(client.log.filter(call => call.name === "AddSpecialEffect").map(call => call.args.slice(1))).toEqual([[0, 0]]);
    expect(client.effectPoses().at(-1)?.x).toBe((client.slot === 0 ? 120 : 640) - 240);
  }
});
