// `bun scripts/integrity/botResult.ts CAPTURE_DIR [CUSTOM_MAP_DATA ...]`: a bot
// session capture (`parity capture --bot`) reduced to numbers. Input delay is
// how many frames a helper has journaled by its own clock beyond the last
// frame its client admitted, read at each of the helper's edit-box receipts;
// a stall has recovered at the first receipt after the game continued from
// which the delay stays within the most it was in the 4 s before the stall
// for a second (recovery_ms: the first receipt back within it). Confirmed checksums
// come from both clients' input traces; moments saved during the capture are
// copied from the given CustomMapData folders into CAPTURE_DIR/moments, and
// every moment there replays headlessly in two simulated clients of this
// source, as `bun wisp repro` does, to the checksum Warcraft recorded
// (moment_replays). A --bot-four or --bot-perf rematch's overlay readings are
// reduced to frame_cost_overlay. Run it from the source the captured build was made from.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { describeCause } from "wisp/scripts/wisp/command";
import { readRepro, replayInClients, reproReport } from "wisp/scripts/wisp/commands/repro";
import { SMASHCRAFT_HEADLESS } from "../wisp/headless";
import { frameCostOverlay, readEvents, readGamePids } from "./botFiles";

interface Receipt {
  readonly ns: number;
  readonly lag: number;
}

const BASELINE_NS = 4e9;
const RECOVERY_LIMIT_MS = 1000;

const [given, ...dataFolders] = process.argv.slice(2);
if (given === undefined) throw new Error("usage: bun scripts/integrity/botResult.ts CAPTURE_DIR [CUSTOM_MAP_DATA ...]");
const directory: string = given;
const events = readEvents(directory);

/** Each epoch's receipts on one helper: time and input delay in frames. */
function receipts(slot: number): Map<number, Receipt[]> {
  const byEpoch = new Map<number, Receipt[]>();
  let epoch = 0;
  let epochNs = 0;
  let published = 0;
  let frameOf = new Map<number, number>();
  for (const line of readFileSync(join(directory, `helper-${slot}.log`), "utf8").split("\n")) {
    const start = /^match_start epoch=(\d+) epoch_ns=(\d+)/.exec(line);
    if (start !== null) {
      epoch = Number(start[1]);
      epochNs = Number(start[2]);
      published = 0;
      frameOf = new Map([[1, 0]]);
      byEpoch.set(epoch, []);
      continue;
    }
    const frame = /^published_frame=(\d+)/.exec(line);
    if (frame !== null) {
      published = Number(frame[1]);
      continue;
    }
    const emit = /^editbox_emit sequence=(\d+)/.exec(line);
    if (emit !== null) {
      frameOf.set(Number(emit[1]), published);
      continue;
    }
    const receipt = /^editbox_receipt monotonic_ns=(\d+) received=\d+ consumed=(\d+)/.exec(line);
    if (receipt === null || epoch === 0) continue;
    const ns = Number(receipt[1]);
    const admitted = frameOf.get(Number(receipt[2]));
    if (admitted === undefined || ns < epochNs) continue;
    const journaled = 1 + Math.floor(((ns - epochNs) * 60) / 1e9);
    byEpoch.get(epoch)?.push({ ns, lag: journaled - admitted });
  }
  return byEpoch;
}

/** Confirmed frame → state, from one client's archived input trace of an epoch. */
function confirmed(epochLabel: string, client: number): Map<number, string> {
  const path = join(directory, `epoch-${epochLabel}`, `${client}-wc3-melee-input-trace.txt`);
  if (!existsSync(path)) return new Map();
  return new Map([...readFileSync(path, "utf8").matchAll(/confirmed frame (\d+) state ([^\s"]+)/g)].map((row) => [Number(row[1]), row[2] ?? ""] as const));
}

const helperReceipts = [receipts(0), receipts(1)] as const;
const stalls = events.flatMap(({ event, epoch, trial, pid, stopped_monotonic_ns, continued_monotonic_ns }) =>
  event === "bot-stall" && epoch !== undefined && stopped_monotonic_ns !== undefined && continued_monotonic_ns !== undefined
    ? [{ epoch, trial, pid, stopped_monotonic_ns, continued_monotonic_ns }]
    : []);
const trials = stalls.map((stall) => {
  const clients = helperReceipts.map((byEpoch, slot) => {
    const list = byEpoch.get(stall.epoch) ?? [];
    const before = list.filter((receipt) => receipt.ns >= stall.stopped_monotonic_ns - BASELINE_NS && receipt.ns < stall.stopped_monotonic_ns);
    const baseline = Math.max(...before.map((receipt) => receipt.lag));
    const after = list.filter((receipt) => receipt.ns >= stall.continued_monotonic_ns);
    const peak = Math.max(...list.filter((receipt) => receipt.ns >= stall.stopped_monotonic_ns && receipt.ns < stall.continued_monotonic_ns + 2e9).map((receipt) => receipt.lag));
    const back = after.find((receipt) => receipt.lag <= baseline);
    const recoveryMs = back === undefined ? undefined : Math.round((back.ns - stall.continued_monotonic_ns) / 1e6);
    const following = back === undefined ? [] : after.filter((receipt) => receipt.ns > back.ns && receipt.ns <= back.ns + 1e9);
    // Settled: back within the pre-stall range and staying there for the next second.
    const settled = after.find((receipt) => after.every((later) => later.ns < receipt.ns || later.ns > receipt.ns + 1e9 || later.lag <= baseline));
    return {
      slot,
      receipts_before: before.length,
      baseline_lag_frames: baseline,
      peak_lag_frames: peak,
      recovery_ms: recoveryMs,
      settled_ms: settled === undefined ? undefined : Math.round((settled.ns - stall.continued_monotonic_ns) / 1e6),
      max_lag_in_next_second: following.length === 0 ? undefined : Math.max(...following.map((receipt) => receipt.lag)),
    };
  });
  const stalled = clients[1];
  return {
    epoch: stall.epoch,
    trial: stall.trial,
    pid: stall.pid,
    stopped_ms: Math.round((stall.continued_monotonic_ns - stall.stopped_monotonic_ns) / 1e6),
    clients,
    passed: stalled?.settled_ms !== undefined && stalled.settled_ms <= RECOVERY_LIMIT_MS,
  };
});

const epochs = [...new Set(events.flatMap((event) => (event.event === "start" && event.epoch !== undefined ? [event.epoch] : [])))];
const matches = epochs.map((epoch) => {
  const end = events.find((event) => event.event === "end" && event.epoch === epoch);
  const receiptsText = (end?.publications ?? []).map((publication) => publication.contents);
  const ends = receiptsText.map((text) => ({ frame: Number(/ frame=(\d+)/.exec(text)?.[1] ?? 0), winner: / winner=(\S+?)(?:\s|"|$)/.exec(text)?.[1] }));
  const traces = [0, 1].map((client) => {
    const merged = new Map<number, string>();
    for (const label of [String(epoch), `${epoch}-result`]) for (const [frame, state] of confirmed(label, client)) merged.set(frame, state);
    return merged;
  });
  const [a = new Map<number, string>(), b = new Map<number, string>()] = traces;
  const common = [...a.keys()].filter((frame) => b.has(frame)).sort((x, y) => x - y);
  const differing = common.filter((frame) => a.get(frame) !== b.get(frame));
  const last = common.at(-1);
  return {
    epoch,
    ends,
    confirmed_frames_compared: common.length,
    confirmed_frames_differing: differing,
    last_common_confirmed: last === undefined ? undefined : { frame: last, state: a.get(last) },
  };
});

const starts = events.filter((event) => event.event === "start");
const startedNs = Math.min(...starts.flatMap((event) => (event.publications ?? []).map((publication) => publication.publication_monotonic_estimate_ns)));
const momentsDirectory = join(directory, "moments");
const moments: string[] = [];
// Moments saved after the first match started belong to this capture.
const firstWrite = Math.min(...starts.flatMap((event) => (event.publications ?? []).map((publication) => publication.mtime_realtime_ns / 1e6)));
for (const folder of dataFolders) {
  for (const name of readdirSync(folder).filter((entry) => /^smashcraft-repro-p\d+-f\d+-\d+\.txt$/.test(entry))) {
    const source = join(folder, name);
    if (statSync(source).mtimeMs < firstWrite) continue;
    mkdirSync(momentsDirectory, { recursive: true });
    copyFileSync(source, join(momentsDirectory, name));
    moments.push(join(momentsDirectory, name));
  }
}

// Map code loads only now, after the capture's own numbers are read.
const { replayRepro } = await import("../../src/game/replay/moment");
const momentFiles = existsSync(momentsDirectory) ? readdirSync(momentsDirectory).filter((entry) => /^smashcraft-repro-p\d+-f\d+-\d+\.txt$/.test(entry)).sort() : [];
const momentReplays = momentFiles.map((name) => {
  const file = join(momentsDirectory, name);
  try {
    const { repro } = Effect.runSync(readRepro(file));
    const report = reproReport(file, repro, replayInClients(SMASHCRAFT_HEADLESS, replayRepro, repro));
    return { moment: name, build: repro.build, frame: repro.frame, recorded_checksum: repro.checksum, passed: report.landed, replay: report.lines.slice(1) };
  } catch (cause) {
    return { moment: name, passed: false, replay: [`the replay stopped: ${describeCause(cause)}`] };
  }
});
for (const { passed, moment, replay } of momentReplays) console.error(`${passed ? "PASS" : "FAIL"} ${moment}: ${replay.at(-1) ?? ""}`);

const summary = {
  game_pids: readGamePids(directory).map((client) => ({ client: client.name, pid: client.pid })),
  input_delay: "frames a helper journaled by its clock beyond the last frame its client admitted, at each edit-box receipt",
  trials,
  trials_passed: `${trials.filter((trial) => trial.passed).length}/${trials.length}`,
  matches,
  moments,
  // A --bot-four or --bot-perf rematch: client A's frame-cost overlay, read every 2 s.
  frame_cost_overlay: frameCostOverlay(events),
  moment_replays_passed: `${momentReplays.filter(({ passed }) => passed).length}/${momentReplays.length}`,
  moment_replays: momentReplays,
  moment_requests: events.filter((event) => event.event === "bot-moment").map((event) => ({
    epoch: event.epoch,
    after_start_ms: event.pressed_monotonic_ns === undefined ? undefined : Math.round((event.pressed_monotonic_ns - startedNs) / 1e6),
  })),
};
writeFileSync(join(directory, "bot-result.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
