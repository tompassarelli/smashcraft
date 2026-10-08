import { expect } from "bun:test";
import { sweep } from "./sweep";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { makeRepro } from "wisp/scripts/wisp/commands/repro";
import { writtenPreloadFile } from "wisp/scripts/wisp/headlessInput";
import { reproLines } from "wisp/src/runtime/repro";
import { inspectRepro } from "../src/game/replay/moment";
import { savedInspectionFixture } from "../src/game/replay/moment.tests";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { createReproViewer, serveReproViewer } from "wisp/scripts/wisp/reproViewer";
import { readRepro } from "wisp/scripts/wisp/commands/repro";

sweep("the local viewer's frame endpoint scrubs a saved Smashcraft moment", async () => {
  const repro = savedInspectionFixture();
  const directory = join(import.meta.dir, "../build/repro-viewer");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, "saved-game.txt");
  const saved = writtenPreloadFile(reproLines(repro, repro.lines));
  writeFileSync(file, saved);
  const parsed = await Effect.runPromise(readRepro(file));
  const viewer = createReproViewer(SMASHCRAFT_HEADLESS, inspectRepro, parsed.repro, { project: join(import.meta.dir, "../tsconfig.game.json"), file: join(import.meta.dir, "../src/game/replay/snapshot.ts"), type: "ReplayState" });
  const server = serveReproViewer(viewer);
  try {
    const address = `http://127.0.0.1:${server.port}`;
    const frame = await (await fetch(`${address}/frame?frame=${repro.frame}`)).json();
    const inspection = inspectRepro(repro, repro.frame);
    if (typeof inspection === "string") throw new Error(inspection);
    expect(frame.clients[0].state).toBe(inspection.state);
    expect(frame.clients[1].checksum).toBe(repro.checksum);
    expect(frame.clients[0].changes.length).toBeGreaterThan(0);
    expect(frame.clients[0].fields.filter((field: { source?: unknown }) => field.source !== undefined).length).toBeGreaterThan(3);
    expect(frame.differences).toEqual([]);
    const previous = await (await fetch(`${address}/frame?frame=${repro.frame - 1}`)).json();
    expect(previous.frame).toBe(repro.frame - 1);
    expect(readFileSync(file, "utf8")).toBe(saved);
    expect(viewer.metadata.firstDivergentFrame).toBeNull();
  } finally { await server.stop(true); }
}, 60_000);

sweep("the repro command inspects a saved gameplay fixture and diffs its previous frame", async () => {
  const repro = savedInspectionFixture();
  const directory = join(import.meta.dir, "../build/repro-inspection");
  mkdirSync(directory, { recursive: true });
  const file = join(directory, "saved-game.txt");
  const out = join(directory, "state.json");
  const saved = writtenPreloadFile(reproLines(repro, repro.lines));
  writeFileSync(file, saved);
  await Effect.runPromise(makeRepro(async () => ({ map: SMASHCRAFT_HEADLESS, replay: join(import.meta.dir, "../src/game/replay/moment.ts"), tests: directory }))([file, "--frame", String(repro.frame), "--diff-frame", "previous", "--out", out]));
  const inspection = inspectRepro(repro, repro.frame);
  if (typeof inspection === "string") throw new Error(inspection);
  const output = JSON.parse(readFileSync(out, "utf8"));
  expect(output.state).toBe(inspection.state);
  expect(output.checksum).toBe(repro.checksum);
  expect(output.diff.from).toBe(repro.frame - 1);
  expect(output.diff.to).toBe(repro.frame);
  expect(output.diff.fields.length).toBeGreaterThan(0);
  expect(readFileSync(file, "utf8")).toBe(saved);
});
