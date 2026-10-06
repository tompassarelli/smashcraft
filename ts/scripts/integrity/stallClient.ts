// `bun scripts/integrity/stallClient.ts DATA_DIR START_FILE DISPLAY DELAY_MS OUT_JSON [EPOCH]`:
// beside a running capture, stops one client's Warcraft for 2 s, DELAY_MS after
// that client writes START_FILE (its journal start receipt for the match),
// and records the stop in OUT_JSON as a bot-stall event botResult.ts reads.
// The process is the Warcraft III.exe whose environment names DISPLAY, the
// client's private display, found once and recorded before any signal.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { monotonicNs } from "./linux";

const STALL_MILLIS = 2000;

const [dataDir, startFile, display, delayText, out, epochText = "0"] = process.argv.slice(2);
if (dataDir === undefined || startFile === undefined || display === undefined || delayText === undefined || out === undefined) {
  throw new Error("usage: bun scripts/integrity/stallClient.ts DATA_DIR START_FILE DISPLAY DELAY_MS OUT_JSON [EPOCH]");
}
// The helpers stamp with CLOCK_MONOTONIC, as the capture does.
const monotonic = monotonicNs;

const candidates = readdirSync("/proc").filter((entry) => /^\d+$/.test(entry)).filter((pid) => {
  try {
    if (!readFileSync(`/proc/${pid}/cmdline`, "utf8").includes("Warcraft III.exe")) return false;
    return readFileSync(`/proc/${pid}/environ`, "utf8").split("\0").includes(`DISPLAY=${display}`);
  } catch {
    return false;
  }
}).filter((pid) => readFileSync(`/proc/${pid}/comm`, "utf8").startsWith("Warcraft"));
if (candidates.length !== 1) throw new Error(`expected one Warcraft III.exe on DISPLAY ${display}, found ${candidates.join(", ") || "none"}`);
const pid = Number(candidates[0]);
console.log(`Warcraft III pid ${pid} on DISPLAY ${display}`);

const startPath = join(dataDir, startFile);
const since = Date.now();
while (!existsSync(startPath) || statSync(startPath).mtimeMs < since) await Bun.sleep(50);
console.log(`${startFile} written; stopping in ${delayText} ms`);
await Bun.sleep(Number(delayText));

const state = () => readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(1)?.charAt(0);
process.kill(pid, "SIGSTOP");
const stoppedNs = monotonic();
let continuedNs = 0;
try {
  while (state() !== "T") {
    if (monotonic() - stoppedNs > 2e9) throw new Error(`pid ${pid} not stopped after 2 s`);
    await Bun.sleep(1);
  }
  console.log(`pid ${pid} stopped`);
  await Bun.sleep(Math.max(0, STALL_MILLIS - (monotonic() - stoppedNs) / 1e6));
} finally {
  continuedNs = monotonic();
  process.kill(pid, "SIGCONT");
}
console.log(`pid ${pid} continued after ${Math.round((continuedNs - stoppedNs) / 1e6)} ms`);
writeFileSync(out, `${JSON.stringify([{ event: "bot-stall", epoch: Number(epochText), trial: 1, slot: 1, pid, stopped_monotonic_ns: stoppedNs, continued_monotonic_ns: continuedNs }], null, 2)}\n`);
