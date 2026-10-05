import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import { captureEpochs, parseCaptureArguments, parseSweep } from "../scripts/integrity/capture";
import { kernelLine, producerLine, readEvidence, readMetadata } from "../scripts/integrity/evidence";
import { type JourneyOptions, type JourneyRecord, type PublicationRecord, type RigShape, journey } from "../scripts/integrity/journey";
import { ABS_X, EV_ABS, PAD_BUTTONS, decodeEvents, edgePacket, padCapabilities, padSetup } from "../scripts/integrity/linuxInput";
import { type Slot, capturePair, integrityResult, integrityTable, summaryJson } from "../scripts/integrity/reconcile";

const evidence = (run: string) => join(import.meta.dir, "../../evidence", `input-integrity-0042-${run}-20261005`);

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
    "| Opponent input lateness, frames: p50 / p95 / max | 9 / 21 / 23 (n=1391) |",
    "| Rollback depth, frames: p50 / p95 / max | 13 / 24 / 24 (n=198) |",
    "| Prediction stalls at 24-frame limit | 169; longest 52 callbacks |",
    "| Injected input → screen, ms | Not captured in this session |",
    "| Final checksums match | Yes |",
  ]);
  expect(result.gates).toEqual({ edges: true, expectedFrame: true, localStart: false, checksums: true });
  expect(result.failures).toEqual([]);
  // The retained summary predates the rollback-limit and four-fighter fields.
  const retained = await Bun.file(join(evidence("r8"), "summary.json")).json();
  expect(summaryJson(result)).toEqual({ ...retained, rollback_limit_frames: 24, four_fighters: false });
});

test("the r7 capture reconciles to its retained failing summary", async () => {
  const result = await reconcileRun("r7");
  expect(integrityTable(result).slice(2, 5)).toEqual([
    "| Edges injected per player | 648 / 648 |",
    "| Lost / duplicated / reordered / stuck edges | 10 / 10 / 0 / 2 |",
    "| Edges applied at expected frame, both clients | 1291/1296 (99.6141975308642%) |",
  ]);
  const retained = await Bun.file(join(evidence("r7"), "summary.json")).json();
  expect(summaryJson(result)).toEqual({ ...retained, rollback_limit_frames: 24, four_fighters: false });
});

const NOW = 10 ** 15;
const CLIENTS = "ab";

/** A Rig that records what the journey does, in the retired Python driver's trace format, and finds every wait satisfied. */
function recordingRig(file: (client: Slot, name: string) => string, screenText = "1 Stock") {
  const trace: string[] = [];
  const events: JourneyRecord[] = [];
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
    file: (client, name) => Effect.succeed({ text: file(client, name), mtimeNs: 1n }),
    files: (_client, pattern) => Effect.succeed([pattern.replaceAll("*", "1")]),
    helperLog: () => Effect.succeed(""),
    boundary: (_client, name) => Effect.succeed(publication(name)),
    stop: (target) => log(`stop ${target.kind}-${target.slot}`).pipe(Effect.as({ target, pid: 1 })),
    resume: ({ target }) => log(`continue ${target.kind}-${target.slot}`),
    waitText: (client, pattern) => log(`ui ${CLIENTS[client]} wait ${pattern.source}`).pipe(Effect.as(screenText)),
    click: (client, x, y) => log(`ui ${CLIENTS[client]} click ${x} ${y}`),
    key: (client, key) => log(`key ${CLIENTS[client]} ${key}`),
    type: (client, text) => log(`type ${CLIENTS[client]} ${text}`),
    archive: (label) => log(`archive ${label}`),
    playerView: (epoch, { frame, scene }) => log(`view ${epoch} frame=${frame} scene=${scene}`),
    record: (event) => Effect.sync(() => {
      events.push(event);
      trace.push(`event ${event.event}${event.event === "integrity-stall" ? ` ${event.kind}` : ""}`);
    }),
    progress: () => Effect.void,
  };
  return { rig, trace, events };
}

const gameFiles = (_client: Slot, name: string) =>
  name.includes("-menu-") ? "connected=3 human-fighters=3 computers=0 fighters=3\nendfunction\n" : " state=PAUSE_COMMIT  state=RESUME \nendfunction\n";
const R8: JourneyOptions = { build: "playable-0042", epochs: [1, 2], fourFighters: false, sweep: [] };

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
  expect(events.map((event) => name(event))).toEqual([...capture.events.map(name), "menu RESULT", "menu CHARACTER"]);
});

test("sweep and four-fighter journeys command and record what the reconciler expects", async () => {
  const sweep = recordingRig(gameFiles);
  await Effect.runPromise(journey(sweep.rig, { ...R8, epochs: [3, 4, 5, 6], sweep: [[24, 2], [24, 1]] }).run);
  expect(sweep.trace.filter((line) => line.startsWith("type "))).toEqual(["type a -dev batch 2", "type a -dev rb 24", "type a -dev batch 1", "type a -dev rb 24"]);
  expect(sweep.events.filter((event) => event.event === "integrity-slot-change").map((event) => event.epoch)).toEqual([4, 6]);
  expect(sweep.trace).toContain("until slot C was not restored to EMPTY");

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
  expect(four.trace).toContain("ui b wait 1:00");
  expect(four.trace.filter((line) => line === "ui b click 1380 155")).toHaveLength(4);
  expect(four.trace.filter((line) => line === "ui b wait [1-9] Stock")).toHaveLength(2);
  expect(four.trace).not.toContain("ui b click 1675 155");
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
  expect(playable.trace.filter((line) => line === "ui b click 1380 155")).toHaveLength(4);
  expect(playable.trace.filter((line) => line.startsWith("key "))).toEqual(["key a ctrl+t", "key a ctrl+t"]);
  expect(playable.trace.some((line) => line.startsWith("stop ") || line.includes("-integrity-") || line.includes("ui a click"))).toBe(false);
  expect(playable.events.filter((event) => event.event !== "menu").map((event) => [event.event, "epoch" in event ? event.epoch : undefined]))
    .toEqual([["start", 1], ["end", 1], ["results", 1], ["start", 2], ["end", 2], ["results", 2]]);
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
