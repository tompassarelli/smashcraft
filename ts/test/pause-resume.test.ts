import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { PLAYABLE_BUILD } from "../src/game/shell/currentBuild";
import { install, startBuild } from "../src/platform/main";
import { shell } from "../src/platform/shell/state";
import { Key } from "../src/platform/shell/keyEvents";
import { exportProbe, exportProbePage, startProbe } from "../src/platform/shell/responseProbe";
import { PREDICTED_HEADLESS } from "../scripts/wisp/headless";
import { value } from "./rematch/playableMatch";
import { ResponsePage } from "../scripts/wisp/boundary";
import { Effect } from "effect";
import { responsePageFile, replayFile, replayPartFile } from "../src/runtime/gameFiles";
import { Phase } from "../src/game/match/rules";
import { joinReplay, parseReplayHeader, parseReplayPart, replayMatch } from "../src/game/replay/matchReplay";

const headless = installHeadless(PREDICTED_HEADLESS);
afterAll(headless.restore);

test("resume keeps frozen fighter and camera positions through batched callbacks while simulation advances [repro #206]", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "os");
  let clock = 10;
  Object.defineProperty(globalThis, "os", { configurable: true, value: { clock: () => clock } });
  try {
    const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true }), install }, [0]);
    const client = clients.client(0);
    clients.start();
    clients.frames(30);
    clients.chat(0, "-dev quick cpu wren intermediate hero dreadlord");
    clients.frames(60);
    clients.press(0, Key.y);
    clients.frames(30);
    const pausedFrame = value(client, () => shell().rollback?.speculative.runtime.simulationFrame ?? -1);
    const picture = () => ({ camera: client.cameraPose(), effects: client.effectPoses({ visibleOnly: true }).map(pose => ({ model: pose.model, x: pose.x, y: pose.y, z: pose.z })), bars: client.frames.snapshot({ visibleOnly: true }).filter(frame => frame.name.includes("Mana")) });
    const frozen = picture();
    clients.press(0, Key.y);
    clients.frames(30);
    expect(value(client, () => shell().rollback?.speculative.runtime.simulationFrame ?? -1)).toBeGreaterThan(pausedFrame);
    expect(picture()).toEqual(frozen);
    clock += 0.0625;
    clients.frames(1);
    expect(picture()).not.toEqual(frozen);
    expect(client.errors).toEqual([]);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "os");
    else Object.defineProperty(globalThis, "os", previous);
  }
});

test("pause with a computer keeps its replay continuous and advances one frame per headless draw after resuming [repro #206] [invariant]", async () => {
  const clients = headless.clients({ start: () => startBuild({ ...PLAYABLE_BUILD, devConsole: true, responseProbe: true }), install }, [0]);
  const client = clients.client(0);
  const read = <T>(body: () => T) => value(client, body);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick cpu wren intermediate hero dreadlord");
  clients.frames(150);
  expect(read(() => shell().runtime.botMemory.history.length)).toBe(43);
  expect(read(() => shell().replay.recorder.text)).toBeUndefined();
  client.run(() => { const probe = shell().probe; if (probe !== undefined) startProbe(probe, false); });
  clients.frames(120);
  const pauseFrame = read(() => shell().rollback?.speculative.runtime.simulationFrame ?? -1);
  clients.press(0, Key.y);
  clients.frames(180);
  expect(read(() => shell().rollback?.speculative.runtime.simulationFrame)).toBe(pauseFrame);
  expect(read(() => shell().moment.recorder.ended)).toBe(false);
  expect(read(() => shell().replay.recorder.ended)).toBe(false);
  clients.press(0, Key.y);
  clients.frames(120);
  expect(read(() => shell().replay.recorder.segmentStart)).toBe(0);
  expect(read(() => shell().replay.recorder.text)).toBeUndefined();
  const rows = read(() => shell().probe?.service.slice(0, shell().probe?.rows) ?? []);
  const windows = [rows.slice(0, 120), rows.slice(300, 420)];
  for (const window of windows) {
    expect(window).toHaveLength(120);
    expect(window.every(row => row.speculativeAfter === row.speculativeBefore + 1)).toBe(true);
    expect(window.every(row => row.correction === 0)).toBe(true);
    expect(window.every(row => row.positionMask === 3)).toBe(true);
  }
  client.run(() => {
    const probe = shell().probe;
    if (probe === undefined) throw Error("missing response probe");
    exportProbe(probe);
    while (probe.exporting) exportProbePage(probe);
  });
  const page = client.files.get(responsePageFile(0, read(() => shell().probe?.run ?? 0), 0)) ?? [];
  const text = ["function PreloadFiles takes nothing returns nothing", ...page.map(line => `call Preload( "${line}" )`), "endfunction"].join("\n");
  await Effect.runPromise(ResponsePage.decode("pause-page.txt", text));
  expect(page.some(line => /^P 0 1 \d+ \S+ \S+$/.test(line))).toBe(true);
  client.key(0, Key.w, 0, true);
  for (let frame = 0; frame < 6000 && read(() => shell().game.phase) === Phase.match; frame++) clients.frames(1);
  expect(read(() => shell().game.phase)).toBe(Phase.result);
  clients.frames(30);
  const manifest = [...client.files.keys()].find(name => /^smashcraft-replay-\d+\.txt$/.test(name)) ?? "";
  const serial = Number(/(\d+)/.exec(manifest)?.[1]);
  const header = parseReplayHeader(client.files.get(replayFile(serial)) ?? []);
  if (typeof header === "string") throw Error(header);
  const parts = Array.from({ length: header.parts ?? 0 }, (_, index) => {
    const part = parseReplayPart(client.files.get(replayPartFile(serial, index + 1)) ?? [], serial, index + 1);
    if (typeof part === "string") throw Error(part);
    return part;
  });
  const replay = replayMatch(joinReplay(header, parts));
  expect(replay.problems).toEqual([]);
  expect(replay.reached).toBe(replay.recorded);
  expect(replay.recorded).toBeGreaterThan(5);
  expect(client.errors).toEqual([]);
  console.log("headless draw windows: normal 120/120 and resumed 120/120 at one simulation frame each; 0 corrections, replay stayed in one segment");
}, 30_000);
