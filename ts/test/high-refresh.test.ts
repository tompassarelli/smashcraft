// Drawing between simulation frames (#169) is presentation only: a quick
// match whose clients draw several frames between every simulation frame,
// with smoothing on, reaches the same confirmed checksums on every frame as
// the same match drawn once a frame, and both clients still make the same
// synchronized native calls.
import { afterAll, expect } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { install, start } from "../src/platform/main";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { shellState } from "../src/platform/shell/state";
import { drawBetweenFrames } from "../src/platform/shell/betweenFrames";
import { effectMotion } from "../src/game/render/effects";
import { expectNoDivergence } from "./desync/journeys";
import { sweep } from "./sweep";

const headless = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(headless.restore);

const MATCH_FRAMES = 300;

/** Each client's confirmed checksum on every frame of a quick match, drawing `extraDraws` more frames between simulation frames. */
function quickMatch(extraDraws: number, cameraTween = false): { checksums: string[][]; smoothed: number; drawnPositions: number } {
  const clients = headless.clients({ start, install });
  clients.start();
  clients.frames(30);
  if (cameraTween) clients.chat(0, "-dev camera-smooth on");
  clients.chat(0, "-dev quick cpu wren expert");
  clients.everywhere(() => {
    effectMotion().tracking = extraDraws > 0;
  });
  const checksums: string[][] = [[], []];
  let smoothed = 0;
  for (let frame = 0; frame < MATCH_FRAMES; frame++) {
    clients.everywhere(() => {
      for (let draw = 0; draw < extraDraws; draw++) drawBetweenFrames();
    });
    clients.frames(1);
    clients.everywhere(() => {
      const s = shellState();
      if (s === undefined) throw new Error("no shell");
      checksums[GetPlayerId(GetLocalPlayer())]?.push(confirmedChecksum(s));
      if (effectMotion().smoothing) smoothed++;
    });
  }
  expectNoDivergence(clients);
  const drawnPositions = clients.clients[0]?.log.filter(({ name }) => name === "BlzSetSpecialEffectPosition").length ?? 0;
  return { checksums, smoothed, drawnPositions };
}

sweep("drawing between simulation frames leaves every confirmed checksum unchanged", () => {
  const plain = quickMatch(0);
  const smooth = quickMatch(2);
  expect(plain.smoothed).toBe(0);
  // Three drawn frames a simulation frame turn smoothing on once the average passes 1.5.
  expect(smooth.smoothed).toBeGreaterThan(MATCH_FRAMES);
  expect(smooth.drawnPositions).toBeGreaterThan(plain.drawnPositions);
  expect(smooth.checksums[0]?.length).toBe(MATCH_FRAMES);
  expect(smooth.checksums).toEqual(plain.checksums);
}, 30000);

sweep("native camera transitions leave every confirmed checksum unchanged", () => {
  const plain = quickMatch(0);
  const smooth = quickMatch(0, true);
  expect(smooth.checksums[0]?.length).toBe(MATCH_FRAMES);
  expect(smooth.checksums).toEqual(plain.checksums);
}, 30000);
