// `bun scripts/integrity/stallSeries.ts CAPTURE_DIR SLOT EPOCH TRIAL`: one helper's input delay, in frames, at
// each edit-box receipt from 4 s before a bot-stall to 6 s after it continued (botResult.ts's measure).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [directory, slotText, epochText, trialText] = process.argv.slice(2);
if (directory === undefined || slotText === undefined || epochText === undefined || trialText === undefined) throw new Error("usage: CAPTURE_DIR SLOT EPOCH TRIAL");
const events = JSON.parse(readFileSync(join(directory, "events.json"), "utf8")) as readonly { readonly event: string; readonly epoch?: number; readonly trial?: number; readonly stopped_monotonic_ns?: number; readonly continued_monotonic_ns?: number }[];
const stall = events.find((event) => event.event === "bot-stall" && event.epoch === Number(epochText) && event.trial === Number(trialText));
if (stall?.stopped_monotonic_ns === undefined || stall.continued_monotonic_ns === undefined) throw new Error("no such stall");
const { stopped_monotonic_ns: stopped, continued_monotonic_ns: continued } = stall;
let epochNs = 0;
let inEpoch = false;
let published = 0;
const frameOf = new Map<number, number>([[1, 0]]);
const rows: string[] = [];
for (const line of readFileSync(join(directory, `helper-${slotText}.log`), "utf8").split("\n")) {
  const start = /^match_start epoch=(\d+) epoch_ns=(\d+)/.exec(line);
  if (start !== null) { inEpoch = Number(start[1]) === Number(epochText); if (inEpoch) epochNs = Number(start[2]); continue; }
  if (!inEpoch) continue;
  const frame = /^published_frame=(\d+)/.exec(line);
  if (frame !== null) { published = Number(frame[1]); continue; }
  const emit = /^editbox_emit sequence=(\d+)/.exec(line);
  if (emit !== null) { frameOf.set(Number(emit[1]), published); continue; }
  const receipt = /^editbox_receipt monotonic_ns=(\d+) received=\d+ consumed=(\d+)/.exec(line);
  if (receipt === null) continue;
  const ns = Number(receipt[1]);
  if (ns < stopped - 4e9 || ns > continued + 6e9) continue;
  const admitted = frameOf.get(Number(receipt[2]));
  if (admitted === undefined) continue;
  rows.push(`${Math.round((ns - continued) / 1e6)} ms: delay ${1 + Math.floor(((ns - epochNs) * 60) / 1e9) - admitted}`);
}
console.log(`stopped ${Math.round((continued - stopped) / 1e6)} ms; times from SIGCONT`);
console.log(rows.join("\n"));
