import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { captureEpochs, parseCaptureArguments, parseSweep } from "../scripts/integrity/capture";
import { IntegrityFailure, kernelLine, producerLine, readEvidence, readMetadata } from "../scripts/integrity/evidence";
import { type GameFile, type JourneyOptions, type JourneyRecord, type PublicationRecord, Rig, type RigShape, journey, nextMatchEpoch } from "../scripts/integrity/journey";
import { ABS_X, EV_ABS, PAD_BUTTONS, decodeEvents, edgePacket, padCapabilities, padSetup } from "../scripts/integrity/linuxInput";
import { type Slot, capturePair, integrityResult, integrityTable, summaryJson } from "../scripts/integrity/reconcile";
import { integritySchedule } from "../scripts/integrity/schedule";
import { frameCostOverlay } from "../scripts/integrity/botFiles";
import { createMatchState, setParticipants } from "../src/game/match/rules";
import { type DevSettings, applyDevCommand } from "../src/game/shell/devSettings";
import { devReceiptFile, stageDrawnFile } from "../src/game/shell/journalFiles";
import { applySetupCommand } from "../src/game/shell/sessionSetup";


const evidence = (run: string) => join(import.meta.dir, "../../evidence", `input-integrity-0042-${run}-20261005`);

/** Captures before #60's held rows report no press captured while prediction was held. */
const NOTHING_HELD = { local_start_while_prediction_held_frames: { n: 0, p50: null, p95: null, max: null, distribution: {} }, held_missing_first_prediction: 0 };

const reconcileRun = async (run: string) => {
  const root = evidence(run);
  const metadata = await Effect.runPromise(readMetadata(root));
  return integrityResult(await Effect.runPromise(readEvidence(root, metadata)), capturePair(metadata));
};

// The retired Python reconciler's output on the same files; r8 is #26's measured result.
test("the r8 capture reconciles to #26's measured table", async () => {
  const result = await reconcileRun("r8");
  expect(integrityTable(result)).toEqual([
    "| Metric | Result |",
    "|---|---|",
    "| Edges injected per player | 648 / 648 |",
    "| Lost / duplicated / reordered / stuck edges | 0 / 0 / 0 / 0 |",
    "| Edges applied at expected frame, both clients | 1296/1296 (100.0%) |",
    "| Local start − capture, frames | 8 / 88 / 97 (n=203); missing first prediction 0 |",
    "| Local start while a remote row held prediction back (not gated) | None / None / None (n=0); missing first prediction 0 |",
    "| Opponent input lateness, frames: p50 / p95 / max | 9 / 21 / 23 (n=1391) |",
    "| Rollback depth, frames: p50 / p95 / max | 13 / 24 / 24 (n=198) |",
    "| Prediction stalls at 24-frame limit | 169; longest 52 callbacks |",
    "| Injected input → screen, ms | Not captured in this session |",
    "| Final checksums match | Yes |",
  ]);
  expect(result.gates).toEqual({ edges: true, expectedFrame: true, localStart: false, checksums: true });
  expect(result.failures).toEqual([]);
  // The retained summary predates the rollback-limit, four-fighter, player-view and held-prediction fields.
  const retained = await Bun.file(join(evidence("r8"), "summary.json")).json();
  expect(summaryJson(result)).toEqual({ ...retained, rollback_limit_frames: 24, four_fighters: false, player_view_failures: [], ...NOTHING_HELD });
});

test("the r7 capture reconciles to its retained failing summary", async () => {
  const result = await reconcileRun("r7");
  expect(integrityTable(result).slice(2, 5)).toEqual([
    "| Edges injected per player | 648 / 648 |",
    "| Lost / duplicated / reordered / stuck edges | 10 / 10 / 0 / 2 |",
    "| Edges applied at expected frame, both clients | 1291/1296 (99.6141975308642%) |",
  ]);
  const retained = await Bun.file(join(evidence("r7"), "summary.json")).json();
  expect(summaryJson(result)).toEqual({ ...retained, rollback_limit_frames: 24, four_fighters: false, player_view_failures: [], ...NOTHING_HELD });
});

const NOW = 10 ** 15;
const CLIENTS = "ab";

/**
 * A Rig that records what the journey does, in the retired Python driver's
 * trace format, and finds every wait satisfied. Chat commands typed into A
 * reach a model of the map's menus (sessionSetup.ts, devSettings.ts), which
 * writes both clients' developer receipts and the stage receipt as the map does.
 */
function recordingRig(file: (client: Slot, name: string) => string, screenText = "1 Stock", lobby: { readonly humans: number; readonly computers: number } = { humans: 3, computers: 0 }) {
  const trace: string[] = [];
  const events: JourneyRecord[] = [];
  const game = createMatchState();
  setParticipants(game, 3, 0);
  game.humanFighterMask = lobby.humans;
  game.computerMask = lobby.computers;
  const dev: DevSettings = { rollback: 24, delay: 0, batch: 6, rematchSeconds: 5 };
  let receipts = 0;
  let typed = "";
  const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n${lines.map((line) => `call Preload( "${line}" )`).join("\n")}\nendfunction\n`;
  const modeled = (client: Slot, name: string): GameFile | undefined => {
    if (name.startsWith("smashcraft-dev-")) return receipts === 0 ? undefined : { text: preload(devReceiptFile({ build: "b", epoch: 0, slot: client }, receipts, dev, game).lines), mtimeNs: BigInt(receipts + 1) };
    if (name.startsWith("smashcraft-stage-")) return { text: preload(stageDrawnFile({ build: "b", epoch: 1, slot: client }, game.stageChoice, 1).lines), mtimeNs: 1n };
    return undefined;
  };
  const log = (line: string) => Effect.sync(() => void trace.push(line));
  const publication = (path: string): PublicationRecord => ({
    path,
    contents: file(0, path),
    mtime_realtime_ns: 0n,
    sample_monotonic_before_ns: NOW,
    sample_realtime_ns: 0n,
    sample_monotonic_after_ns: NOW,
    publication_monotonic_estimate_ns: NOW,
  });
  const rig: RigShape = {
    send: ({ slot, edge, phase }) => log(`send ${slot} ${edge.type} ${edge.code} ${edge.value} ${phase}`),
    sleep: (millis) => log(`sleep ${Math.round(millis)}`),
    monotonicNs: Effect.succeed(NOW),
    realtimeNs: Effect.succeed(1n),
    startedNs: 0n,
    until: (what) => log(`until ${what}`),
    healthy: Effect.void,
    file: (client, name) => Effect.succeed(modeled(client, name) ?? { text: file(client, name), mtimeNs: 1n }),
    files: (_client, pattern) => Effect.succeed([pattern.replaceAll("*", "1")]),
    helperLog: () => Effect.succeed(""),
    boundary: (_client, name) => Effect.succeed(publication(name)),
    stop: (target) => log(`stop ${target.kind}-${target.slot}`).pipe(Effect.as({ target, pid: 1 })),
    resume: ({ target }) => log(`continue ${target.kind}-${target.slot}`),
    waitText: (client, pattern) => log(`ui ${CLIENTS[client]} wait ${pattern.source}`).pipe(Effect.as(screenText)),
    readText: (client, { x, y, width, height }) => log(`ui ${CLIENTS[client]} read ${x},${y} ${width}x${height}`).pipe(Effect.as(screenText)),
    click: (client, x, y) => log(`ui ${CLIENTS[client]} click ${x} ${y}`),
    key: (client, key) => log(`key ${CLIENTS[client]} ${key}`).pipe(Effect.tap(() => Effect.sync(() => {
      if (client !== 0 || key !== "Return" || typed === "") return;
      if ((applySetupCommand(game, 0, typed) ?? applyDevCommand(dev, typed)) !== undefined) receipts++;
      typed = "";
    }))),
    type: (client, text) => log(`type ${CLIENTS[client]} ${text}`).pipe(Effect.tap(() => Effect.sync(() => {
      typed = text;
    }))),
    archive: (label) => log(`archive ${label}`),
    playerView: (epoch, { frame, scene }) => log(`view ${epoch} frame=${frame} scene=${scene}`),
    record: (event) => Effect.sync(() => {
      events.push(event);
      trace.push(`event ${event.event}${event.event === "integrity-stall" ? ` ${event.kind}` : ""}`);
    }),
    progress: () => Effect.void,
  };
  return { rig, trace, events, game };
}

const gameFiles = (_client: Slot, name: string) =>
  name.includes("-menu-") ? "connected=3 human-fighters=3 computers=0 fighters=3\nendfunction\n" : " state=PAUSE_COMMIT  state=RESUME \nendfunction\n";
// r8 predates #49, so its pads follow the earlier layout.
const R8: JourneyOptions = { build: "playable-0042", epochs: [1, 2], fourFighters: false, sweep: [], padLayout: "compass-tap-jump" };

// Traces of the retired Python driver's integrity(epoch), run under recording stubs.
const PYTHON_INTEGRITY = {
  1: { lines: 1039, sends: 692, sha256: "258b46bd97da1a54fb20d6ed5f3084657bd1b267ef26abc7e82e40c06c450bb7" },
  2: { lines: 894, sends: 608, sha256: "f96af9e2fc2291822c560504647fef978d0bdbe1b216808730c0e07945b520df" },
  3: { lines: 1039, sends: 692, sha256: "02210d7edb40b68c61e9dfaa190197fddd468826df726bb7e8fbe5372dc1ffa7" },
} as const;

test("each match's integrity workload sends, waits, stalls and pauses as the Python driver did", async () => {
  for (const epoch of [1, 2, 3] as const) {
    const { rig, trace } = recordingRig(gameFiles);
    await Effect.runPromise(journey(rig, R8).integrity(epoch));
    expect({ lines: trace.length, sends: trace.filter((line) => line.startsWith("send ")).length, sha256: new Bun.CryptoHasher("sha256").update(trace.join("\n")).digest("hex") })
      .toEqual(PYTHON_INTEGRITY[epoch]);
  }
});


/** Pointer and screen-reading steps, which only a playable build's journey (no dev console) still takes. */
const pointerOrOcr = (trace: readonly string[]) => trace.filter((line) => / click | wait /.test(line) && !/ wait (?:PAUSED|wins\|rematch)/.test(line));

test("the integrity workload raises one stock to three before its first match and changes it no more", async () => {
  const { rig, trace, game } = recordingRig(gameFiles, "1 Stock");
  await Effect.runPromise(journey(rig, R8).run);
  expect(trace.filter((line) => line.startsWith("type a -dev stocks"))).toEqual(["type a -dev stocks 3"]);
  expect(trace.indexOf("type a -dev stocks 3")).toBeLessThan(trace.findIndex((line) => line.includes("menu-match-1-start")));
  expect(game.stockCount).toBe(3);
  expect(pointerOrOcr(trace)).toEqual([]);
});

test("the journey sends r8's pad edges in r8's order, then returns to fighter selection", async () => {
  const { rig, trace, events } = recordingRig(gameFiles);
  await Effect.runPromise(journey(rig, R8).run);
  const root = evidence("r8");
  const producer = (await Bun.file(join(root, "producer.jsonl")).text()).trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  const sent = producer.map((edge) => `send ${String(edge.event).replace("slot-", "")} ${edge.type} ${edge.code} ${edge.value} ${edge.phase}`);
  // r8's driver stopped at the rematch result; the journey now also leaves it for fighter selection.
  expect(trace.filter((line) => line.startsWith("send "))).toEqual([
    ...sent,
    "send 0 1 304 1 results-only",
    "send 0 1 304 0 results-only",
    "send 1 1 315 1 menu-results-confirm",
    "send 1 1 315 0 menu-results-confirm",
  ]);
  const capture = await Bun.file(join(root, "capture.json")).json() as { events: { event: string; phase?: string }[] };
  const name = (event: { event: string; phase?: string }) => event.event + (event.phase === undefined ? "" : ` ${event.phase}`);
  // r8 predates the player-view records.
  expect(events.filter((event) => event.event !== "player-view").map((event) => name(event))).toEqual([...capture.events.map(name), "menu RESULT", "menu CHARACTER"]);
  expect(events.flatMap((event) => (event.event === "player-view" ? [[event.epoch, event.at, event.failure]] : []))).toEqual([
    [1, "start", undefined], [1, "result", undefined], [2, "start", undefined], [2, "result", undefined],
  ]);
});

const SCENE_FAILURE = "check player view in match 2 failed for DIR: a, b: a player would see\n  - a: a hit spark stayed in view for 4.00 s";

/** The recording rig, with every player view of the rematch failing, as the clean-folders capture's result check did. */
function failingViewRig(screenText?: string) {
  const recording = recordingRig(gameFiles, screenText);
  const rig: RigShape = {
    ...recording.rig,
    playerView: (epoch, checks) => epoch === 2
      ? Effect.fail(new IntegrityFailure({ operation: "check player view in match 2", path: "DIR", cause: "a, b: a player would see\n  - a: a hit spark stayed in view for 4.00 s" }))
      : recording.rig.playerView(epoch, checks),
  };
  return { ...recording, rig };
}

test("an input-integrity capture records a failed player view and does everything else a passing one does", async () => {
  const passing = recordingRig(gameFiles);
  await Effect.runPromise(journey(passing.rig, R8).run);
  const failing = failingViewRig();
  await Effect.runPromise(journey(failing.rig, R8).run);
  // Both matches' pages are exported and archived, and the journey returns to fighter selection.
  const steps = (trace: readonly string[]) => trace.filter((line) => !line.startsWith("view "));
  expect(steps(failing.trace)).toEqual(steps(passing.trace));
  expect(failing.trace.filter((line) => line === "key a ctrl+h")).toHaveLength(2);
  const views = (events: readonly JourneyRecord[]) => events.flatMap((event) => (event.event === "player-view" ? [[event.epoch, event.at, event.failure]] : []));
  expect(views(failing.events)).toEqual([[1, "start", undefined], [1, "result", undefined], [2, "start", SCENE_FAILURE], [2, "result", SCENE_FAILURE]]);
  expect(failing.events.filter((event) => event.event !== "player-view")).toEqual(passing.events.filter((event) => event.event !== "player-view"));
});

test("#17 and playable journeys still stop at a failed player view", async () => {
  for (const [workload, screen] of [["match", "3 Stock · 7:00"], ["playable", "3 Stock Player 2 wins!"]] as const) {
    const { rig, events } = failingViewRig(screen);
    const exit = await Effect.runPromiseExit(journey(rig, { ...R8, fourFighters: workload === "match", workload }).run);
    expect(exit._tag).toBe("Failure");
    expect(events.some((event) => event.event === "player-view" || (event.event === "end" && event.epoch === 2))).toBe(false);
  }
});

test("the result reports player-view failures without gating them", async () => {
  const root = evidence("r8");
  const capture = await Bun.file(join(root, "capture.json")).json() as { events: unknown[] };
  const directory = mkdtempSync(join(tmpdir(), "integrity-view-"));
  try {
    await Bun.write(join(directory, "capture.json"), JSON.stringify({
      ...capture,
      events: [...capture.events, { event: "player-view", epoch: 2, at: "start" }, { event: "player-view", epoch: 2, at: "result", failure: SCENE_FAILURE }],
    }));
    const metadata = await Effect.runPromise(readMetadata(directory));
    const result = integrityResult(await Effect.runPromise(readEvidence(root, metadata)), capturePair(metadata));
    const retained = await Bun.file(join(root, "summary.json")).json();
    // r8's table, gates and verdict, with the failure beside them.
    expect(summaryJson(result)).toEqual({ ...retained, rollback_limit_frames: 24, four_fighters: false, player_view_failures: [`match 2 at result: ${SCENE_FAILURE}`], ...NOTHING_HELD });
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("sweep and four-fighter journeys command and record what the reconciler expects", async () => {
  const sweep = recordingRig(gameFiles);
  await Effect.runPromise(journey(sweep.rig, { ...R8, epochs: [3, 4, 5, 6], sweep: [[24, 2], [24, 1]] }).run);
  expect(sweep.trace.filter((line) => /^type a -dev (?:batch|rb) /.test(line))).toEqual(["type a -dev batch 2", "type a -dev rb 24", "type a -dev batch 1", "type a -dev rb 24"]);
  // Each rematch's slot change is commanded, and the next match restores two humans.
  expect(sweep.trace.filter((line) => line.startsWith("type a -dev slots"))).toEqual([
    "type a -dev slots 3 0", "type a -dev slots 7 0", "type a -dev slots 3 4", "type a -dev slots 3 0", "type a -dev slots 7 0", "type a -dev slots 3 4", "type a -dev slots 3 0",
  ]);
  expect(sweep.events.filter((event) => event.event === "integrity-slot-change").map((event) => event.epoch)).toEqual([4, 6]);
  expect(sweep.trace).toContain("until slot C was not restored to EMPTY");
  expect(sweep.trace.filter((line) => /^until dev command not confirmed: -dev (?:batch|rb) /.test(line))).toHaveLength(4);
  expect(sweep.events.filter((event) => event.event === "dev-config").map((event) => event.event === "dev-config" && event.command)).toEqual(["-dev batch 2", "-dev rb 24", "-dev batch 1", "-dev rb 24"]);
  expect(sweep.trace.some((line) => line.includes("All|Allies"))).toBe(false);

  const four = recordingRig(gameFiles);
  await Effect.runPromise(journey(four.rig, { ...R8, fourFighters: true }).run);
  const modes = (event: JourneyRecord) => ("changes" in event ? event.changes.map((change) => [change.human_fighters, change.computers]) : []);
  expect(four.events.filter((event) => event.event === "four-fighter-setup").map(modes)).toEqual([[[7, 0], [3, 4], [11, 4], [3, 12]]]);
  expect(four.events.filter((event) => event.event === "integrity-slot-change").map(modes)).toEqual([[[3, 8], [7, 8], [3, 12]]]);
  expect(four.trace.some((line) => line.includes("Stock"))).toBe(false);
});

test("#17's normal timed journey reaches both results without integrity stalls or forced stock loss", async () => {
  const four = recordingRig(gameFiles, "3 Stock · 7:00");
  await Effect.runPromise(journey(four.rig, { ...R8, fourFighters: true, workload: "match" }).run);
  expect(four.trace.some((line) => line.startsWith("stop "))).toBe(false);
  expect(four.trace.some((line) => line.includes("stock-loss") || line.includes("-integrity-"))).toBe(false);
  expect(four.trace.filter((line) => line.startsWith("type a -dev time"))).toEqual(["type a -dev time 1"]);
  expect(four.trace.filter((line) => line.startsWith("type a -dev stocks"))).toEqual(["type a -dev stocks 1", "type a -dev stocks 1"]);
  expect([four.game.stockCount, four.game.timeLimitMinutes]).toEqual([1, 1]);
  expect(pointerOrOcr(four.trace)).toEqual([]);
  expect(four.events.filter((event) => event.event === "start" || event.event === "end").map((event) => [event.event, event.epoch])).toEqual([["start", 1], ["end", 1], ["start", 2], ["end", 2]]);
  expect(four.events.filter((event) => event.event === "integrity-slot-change")).toHaveLength(1);
});

test("a playable journey plays one-stock matches that end when Player 1, then Player 2, walks off", async () => {
  const playable = recordingRig(gameFiles, "3 Stock Player 2 wins!");
  await Effect.runPromise(journey(playable.rig, { ...R8, workload: "playable" }).run);
  const sends = playable.trace.filter((line) => line.startsWith("send "));
  expect(sends.filter((line) => line.includes("stock-loss"))).toEqual([
    `send 0 ${EV_ABS} ${ABS_X} -32768 match-1-stock-loss`, `send 0 ${EV_ABS} ${ABS_X} 0 match-1-stock-loss`,
    `send 1 ${EV_ABS} ${ABS_X} 32767 match-2-stock-loss`, `send 1 ${EV_ABS} ${ABS_X} 0 match-2-stock-loss`,
  ]);
  expect(sends.filter((line) => line.includes("-combat"))).toHaveLength(32);
  expect(playable.trace.filter((line) => line === "ui b click 428 445")).toHaveLength(4);
  expect(playable.trace.filter((line) => line.startsWith("key "))).toEqual(["key a ctrl+t", "key a ctrl+t"]);
  expect(playable.trace.some((line) => line.startsWith("stop ") || line.includes("-integrity-") || line.includes("ui a click"))).toBe(false);
  expect(playable.events.filter((event) => event.event !== "menu").map((event) => [event.event, "epoch" in event ? event.epoch : undefined]))
    .toEqual([["start", 1], ["end", 1], ["results", 1], ["start", 2], ["end", 2], ["results", 2]]);
  // Each result screen is read whole, then its announcement alone.
  expect(playable.trace.filter((line) => line.startsWith("ui ") && / (?:wait wins|read )/.test(line))).toEqual([
    "ui a wait wins|rematch", "ui b wait wins|rematch", "ui a read 944,312 1008x168", "ui b read 944,312 1008x168",
    "ui a wait wins|rematch", "ui b wait wins|rematch", "ui a read 944,312 1008x168", "ui b read 944,312 1008x168",
  ]);
  for (const event of playable.events) if (event.event === "results") expect(event.notices).toEqual(["3 Stock Player 2 wins!", "3 Stock Player 2 wins!"]);
});

test("capture arguments select the matches the Python driver numbered", () => {
  expect(parseSweep("24:2,24:1,16")).toEqual([[24, 2], [24, 1], [16, 6]]);
  expect(captureEpochs(0, 1)).toEqual([1, 2]);
  expect(captureEpochs(2, 3)).toEqual([3, 4, 5, 6]);
  const base = ["--helper", "h", "--build", "b", "--out", "o", "--app-id", "a=x", "--app-id", "b=y"];
  expect(parseCaptureArguments([...base, "--sweep", "24", "--first-epoch", "5"])).toMatchObject({ epochs: [5, 6], sweep: [[24, 6]], appIds: new Map([["a", "x"], ["b", "y"]]) });
  expect(() => parseCaptureArguments([...base, "--first-epoch", "2"])).toThrow();
  expect(() => parseCaptureArguments([...base, "--sweep", "24", "--four-fighters"])).toThrow();
  expect(() => parseCaptureArguments([...base, "--controller-chat"])).toThrow();
});

// Bytes and calls the retired Python VirtualGamepad made, recorded with stubbed os and fcntl.
test("virtual pads are declared and fed exactly as the Python driver did", () => {
  const ioctls = [...padCapabilities(PAD_BUTTONS)].map(([request, argument]) => `ioctl 0x${request.toString(16)} ${argument}`);
  expect(ioctls).toEqual([
    "ioctl 0x40045564 1", "ioctl 0x40045564 3",
    "ioctl 0x40045565 304", "ioctl 0x40045565 305", "ioctl 0x40045565 307", "ioctl 0x40045565 308", "ioctl 0x40045565 310", "ioctl 0x40045565 311", "ioctl 0x40045565 315",
    "ioctl 0x40045567 0", "ioctl 0x40045567 1", "ioctl 0x40045567 2", "ioctl 0x40045567 3", "ioctl 0x40045567 4", "ioctl 0x40045567 5",
  ]);
  const setup = padSetup();
  expect(setup.length).toBe(1116);
  expect(new Bun.CryptoHasher("sha256").update(setup).digest("hex")).toBe("393cab08bbfc4f943ec2905cdc252cd5a84e12f180c3bd92322c572c137c9498");
  const edge = { type: EV_ABS, code: ABS_X, value: -32768 };
  const packet = edgePacket(580467607853000, edge);
  expect(Buffer.from(packet).toString("hex")).toBe("73db0800000000006d46090000000000030000000080ffff73db0800000000006d460900000000000000000000000000");
  expect(decodeEvents(packet)).toEqual([{ kernelNs: 580467607853000, ...edge }, { kernelNs: 580467607853000, type: 0, code: 0, value: 0 }]);
  expect(producerLine("match-1-integrity-isolated:move-left", 0, edge, { injectedNs: 580467607853000, beforeNs: 580467607853635, afterNs: 580467607876628 }))
    .toBe('{"phase":"match-1-integrity-isolated:move-left","event":"slot-0","type":3,"code":0,"value":-32768,"producer_injected_monotonic_ns":580467607853000,"producer_before_write_monotonic_ns":580467607853635,"producer_after_write_monotonic_ns":580467607876628}\n');
});

test("kernel observations are logged in r8's format", async () => {
  const [first] = (await Bun.file(join(evidence("r8"), "kernel-0.jsonl")).text()).split("\n");
  expect(kernelLine({ kernelNs: 580467607853000, type: 1, code: 304, value: 1 })).toBe(`${first}\n`);
});

test("xpad pads press X for special, Y for jump, and stick-up only as up", () => {
  const isolated = (layout: "xpad" | "compass-tap-jump") =>
    Object.fromEntries(integritySchedule(1, layout).flatMap((step) => (step.kind === "pulse" && step.label === "isolated" ? step.group : [])).map(({ name, code }) => [name, code]));
  expect(isolated("xpad")).toMatchObject({ special: 0x133, "jump-y": 0x134, "move-up": 1 });
  expect(isolated("xpad")).not.toHaveProperty("jump-stick");
  expect(isolated("compass-tap-jump")).toMatchObject({ special: 0x134, "jump-y": 0x133, "jump-stick": 1 });
});

 test("bot sessions enable automatic rematch and wait for the second game without selection or a Start press", async () => {
  const bot = recordingRig(gameFiles, "3 Stock 7:00 Automatic rematch: Off Player 2 wins!");
  await Effect.runPromise(journey(bot.rig, { ...R8, build: "typescript-integrity", workload: "bot", botPerf: true }).run);
  expect(bot.trace).toContain("type a -dev rematch 20");
  expect(bot.trace).toContain("type a -dev auto-rematch on");
  expect(bot.game.automaticRematch).toBe(true);
  // Setup and stage choice are commands; the screen is read only for evidence (results, the overlay).
  expect(pointerOrOcr(bot.trace)).toEqual([]);
  expect(bot.trace).toContain("type a -dev stage 0");
  expect(bot.game.stageChoice).toBe(0);
  expect(bot.trace.indexOf("until epoch 1: stage drawn receipts absent")).toBeLessThan(bot.trace.indexOf("view 1 frame=true scene=true"));
  expect(bot.trace.some(line => line.includes("menu-match-2-start") || line.includes("menu-match-2-stage"))).toBe(false);
  const firstEnd = bot.trace.indexOf("event end");
  const secondStart = bot.trace.indexOf("event start", bot.trace.indexOf("event start") + 1);
  expect(bot.trace.indexOf("type a -dev perf")).toBeGreaterThan(secondStart);
  const perfTyped = bot.trace.indexOf("type a -dev perf");
  const captureTyped = bot.trace.indexOf("type a -dev capture 1800");
  const resumed = bot.trace.findIndex(line => line.includes("match-2-chat-resume"));
  expect(bot.trace.indexOf("until epoch 2: -dev perf chat entry not open")).toBeLessThan(perfTyped);
  expect(bot.trace.indexOf("until epoch 2: -dev perf chat has not returned keyboard focus")).toBeLessThan(captureTyped);
  expect(resumed).toBeGreaterThan(captureTyped);
  expect(bot.trace.indexOf("until epoch 2: chat resume not acknowledged by both helpers")).toBeGreaterThan(resumed);
  expect(bot.trace.slice(firstEnd, secondStart).some(line => line.includes("menu-results-confirm") || line.includes("menu-character"))).toBe(false);
  expect(bot.events.filter(event => event.event === "start" || event.event === "end").map(event => [event.event, event.epoch])).toEqual([["start", 1], ["end", 1], ["start", 2], ["end", 2]]);
  // The overlay is read from A's screen during the rematch that shows it, and only then.
  const overlay = bot.events.flatMap(event => (event.event === "perf-overlay" ? [event.epoch] : []));
  expect(overlay.length).toBeGreaterThan(0);
  expect(new Set(overlay)).toEqual(new Set([2]));
  expect(bot.trace).toContain("ui a read 1700,90 530x210");
});

/** The recording rig over a lobby whose slots C/D the journey's commands change, noting the slot modes at bot setup. */
function lobbyRig(humans: number, computers: number) {
  const recording = recordingRig(gameFiles, "3 Stock 7:00 Automatic rematch: Off Player 2 wins!", { humans, computers });
  const atSetup: (readonly [number, number])[] = [];
  const rig: RigShape = {
    ...recording.rig,
    record: (event) => recording.rig.record(event).pipe(Effect.tap(() => Effect.sync(() => {
      if (event.event === "bot-setup") atSetup.push([recording.game.humanFighterMask, recording.game.computerMask]);
    }))),
  };
  return { ...recording, rig, atSetup };
}

test("bot sessions set slots C/D, the computers' fighters and the stage by command from whatever the lobby gave them", async () => {
  const slots = (trace: readonly string[]) => trace.filter((line) => line.startsWith("type a -dev slots") || line.startsWith("type a -dev fighter"));
  // The lobby's computer players: C and D come up CPU.
  for (const botFour of [false, true]) {
    const bot = lobbyRig(3, 12);
    await Effect.runPromise(journey(bot.rig, { ...R8, build: "typescript-integrity", workload: "bot", botFour }).run);
    expect(bot.atSetup).toEqual([botFour ? [3, 12] : [3, 4]]);
    expect(slots(bot.trace)).toEqual([
      "type a -dev slots 3 0", "type a -dev slots 7 0", "type a -dev slots 3 4",
      ...(botFour ? ["type a -dev slots 11 4", "type a -dev slots 3 12"] : []),
      "type a -dev fighter 3 Illidan", ...(botFour ? ["type a -dev fighter 4 Archer"] : []),
      "type a -dev slots 3 0",
    ]);
    // The run ends with two humans again.
    expect([bot.game.humanFighterMask, bot.game.computerMask]).toEqual([3, 0]);
    expect(pointerOrOcr(bot.trace)).toEqual([]);
  }
  // #26's integrity run also starts its rematch slot change from two humans.
  const integrity = lobbyRig(3, 12);
  await Effect.runPromise(journey(integrity.rig, R8).run);
  expect(slots(integrity.trace)[0]).toBe("type a -dev slots 3 0");
  expect([integrity.game.humanFighterMask, integrity.game.computerMask]).toEqual([3, 0]);
});

test("a refused developer command stops the journey with its receipt's state", async () => {
  // A command the map refuses leaves the state it reported: the capture names the field instead of waiting.
  const refused = lobbyRig(3, 12);
  const rig: RigShape = { ...refused.rig, type: (client, text) => refused.rig.type(client, text === "-dev slots 3 0" ? "-dev slots 3 3" : text) };
  const exit = await Effect.runPromiseExit(journey(rig, R8).run);
  expect(exit._tag).toBe("Failure");
  expect(String(exit._tag === "Failure" ? exit.cause : "")).toContain("client 0 receipt has computers=12, wanted computers=0");
});

test("a capture starts at the game's next match, read from both menu receipts", async () => {
  const next = (epochs: readonly [number, number]) => {
    const { rig } = recordingRig((client) => `SMASHCRAFT JOURNAL MENU v=1 build=b epoch=${epochs[client]} slot=${client} phase=CHARACTER\nendfunction\n`);
    return Effect.runPromiseExit(nextMatchEpoch("b").pipe(Effect.provideService(Rig, rig)));
  };
  expect(await next([0, 0])).toMatchObject({ _tag: "Success", value: 1 });
  expect(await next([2, 2])).toMatchObject({ _tag: "Success", value: 3 });
  // A rematch can't start a capture, and the clients must agree.
  expect((await next([1, 1]))._tag).toBe("Failure");
  expect((await next([2, 4]))._tag).toBe("Failure");
  const base = ["--helper", "h", "--build", "b", "--out", "o", "--app-id", "a=x", "--app-id", "b=y"];
  expect(parseCaptureArguments([...base, "--bot"]).epochs).toBeUndefined();
});

test("overlay readings reduce to the rematch's frame cost, unreadable ones counted apart", () => {
  const reading = (text: string) => ({ event: "perf-overlay", epoch: 2, observed_monotonic_ns: NOW, text });
  const result = frameCostOverlay([
    { event: "start", epoch: 2 },
    reading("frame cost, last 120 frames, median / p95 / max\nLua ms: 5 / 12.5 / 30 (clock step 1 ms)\nnatives: 165 / 400 / 2257\ncatch-up frames: 0 / 0 / 6"),
    reading("frame cost, last 120 frames, median / p95 / max\nLua ms: 4 / 9 / 15 (clock step 1 ms)\nnatives: 150 / 380 / 900"),
    reading("frame cost, last 120 frames, median /{npgx|Lua ms: 6 / 35.02 (clock step 1 msl)'"),
    reading("unread: the window did not answer"),
  ]);
  expect(result).toMatchObject({
    readings: 4,
    unread: 2,
    lua_ms: { median_of_medians: 4, median_p95: 9, max_p95: 12.5, max: 30 },
    windows_with_a_frame_over_16_7_ms: 1,
    natives_median: 150,
  });
});
