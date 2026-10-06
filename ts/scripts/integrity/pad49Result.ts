// `bun scripts/integrity/pad49Result.ts CAPTURE_DIR [EPOCH]`: checks #49's pad
// script (`parity capture --bot --pad49`) against the rows slot 0's helper
// typed into its client, which the client's receipts show it consumed. Each
// scripted step's frames come from the edges' injection times on the helper's
// frame rule (frame = 1 + floor((t - match start) * 60 / 1e9)); a step's first
// two frames and its last are left to the transition.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Action, bit } from "../../src/game/input/actions";
import type { InputRow } from "../../src/game/input/inputRow";
import { decodePacket } from "../../src/game/input/wire";

const [directory, epochText = "1"] = process.argv.slice(2);
if (directory === undefined) throw new Error("usage: bun scripts/integrity/pad49Result.ts CAPTURE_DIR [EPOCH]");
const epoch = Number(epochText);

const MOVES = bit(Action.moveLeft) | bit(Action.moveRight) | bit(Action.moveDown) | bit(Action.moveUp)
  | bit(Action.smashLeft) | bit(Action.smashRight) | bit(Action.smashUp) | bit(Action.smashDown) | bit(Action.walk);

let epochNs: number | undefined;
let inEpoch = false;
const rows = new Map<number, InputRow>();
let emitted = 0;
let consumed = 0;
const focus: string[] = [];
for (const line of readFileSync(join(directory, "helper-0.log"), "utf8").split("\n")) {
  const start = /^match_start epoch=(\d+) epoch_ns=(\d+)/.exec(line);
  if (start !== null) {
    inEpoch = Number(start[1]) === epoch;
    if (inEpoch) epochNs = Number(start[2]);
    continue;
  }
  if (!inEpoch) continue;
  if (line.startsWith("match_end")) inEpoch = false;
  if (line.startsWith("focus_")) focus.push(line);
  const emit = /^editbox_emit sequence=(\d+) .*envelope=@J\d+\|([^;]+);/.exec(line);
  if (emit !== null) {
    emitted = Math.max(emitted, Number(emit[1]));
    const packet = emit[2]?.startsWith("I4") === true ? decodePacket(emit[2]) : undefined;
    packet?.rows.forEach((row, index) => rows.set(packet.firstFrame + index, row));
    continue;
  }
  const receipt = /^editbox_receipt .* consumed=(\d+)/.exec(line);
  if (receipt !== null) consumed = Math.max(consumed, Number(receipt[1]));
}
if (epochNs === undefined) throw new Error(`no match_start for epoch ${epoch} in helper-0.log`);
const startNs = epochNs;
const frameAt = (ns: number) => 1 + Math.floor(((ns - startNs) * 60) / 1e9);

/** Each pad49 phase's first edge, in order. */
const phases: { readonly phase: string; readonly frame: number }[] = [];
for (const line of readFileSync(join(directory, "producer.jsonl"), "utf8").split("\n")) {
  if (line === "") continue;
  const edge = JSON.parse(line) as { readonly phase: string; readonly event: string; readonly producer_injected_monotonic_ns: number };
  if (!edge.phase.startsWith("pad49-") || edge.event !== "slot-0") continue;
  const phase = edge.phase.slice("pad49-".length);
  if (phases.at(-1)?.phase !== phase) phases.push({ phase, frame: frameAt(edge.producer_injected_monotonic_ns) });
}

type Check = (row: InputRow) => string | undefined;
const neutral: Check = (row) => (row.axisX !== 0 || row.axisZ !== 0 || (row.held & MOVES) !== 0 ? `stick ${row.axisX},${row.axisZ} held ${row.held}` : undefined);
const noDown: Check = (row) => ((row.held & (bit(Action.moveDown) | bit(Action.smashDown))) !== 0 ? `down held (${row.held}, axis ${row.axisZ})` : undefined);
const down: Check = (row) => ((row.held & bit(Action.moveDown)) === 0 ? `no down (${row.held}, axis ${row.axisZ})` : undefined);
const right: Check = (row) => ((row.held & bit(Action.moveRight)) === 0 || (row.released & bit(Action.moveRight)) !== 0 ? `right not held (${row.held}/${row.released})` : undefined);
const HOLDS: Readonly<Record<string, Check>> = {
  rest: neutral, "drift-a": neutral, "drift-b": neutral, "rest-b": neutral, "rest-c": neutral, "rest-d": neutral, "rest-e": neutral,
  "down-below": noDown, "down-past": down, "right-hold": right,
};
/** A tap's press must reach the rows within this many frames, as its action and not the other. */
const TAP_FRAMES = 10;
const TAPS: Readonly<Record<string, { readonly want: number; readonly not: number }>> = {
  x: { want: bit(Action.special), not: bit(Action.jump) },
  y: { want: bit(Action.jump), not: bit(Action.special) },
};

const steps = phases.map(({ phase, frame }, index) => {
  const next = phases[index + 1]?.frame ?? frame + 60;
  const tap = TAPS[phase];
  if (tap !== undefined) {
    const window = Array.from({ length: TAP_FRAMES }, (_, offset) => rows.get(frame + offset));
    const pressed = window.filter((row) => row !== undefined && (row.pressed & tap.want) !== 0).length;
    const wrong = window.filter((row) => row !== undefined && (row.pressed & tap.not) !== 0).length;
    return { phase, frames: `${frame}-${frame + TAP_FRAMES - 1}`, checked: TAP_FRAMES, mismatches: (pressed === 1 ? 0 : 1) + wrong, detail: `pressed ${pressed}, other action ${wrong}` };
  }
  const check = HOLDS[phase];
  if (check === undefined) return { phase, frames: `${frame}`, checked: 0, mismatches: 0, detail: "unchecked" };
  const problems: string[] = [];
  let checked = 0;
  for (let at = frame + 2; at < next - 1; at++) {
    const row = rows.get(at);
    checked++;
    const problem = row === undefined ? "no row" : check(row);
    if (problem !== undefined) problems.push(`frame ${at}: ${problem}`);
  }
  return { phase, frames: `${frame + 2}-${next - 2}`, checked, mismatches: problems.length, detail: problems.slice(0, 5).join("; ") };
});

const summary = {
  epoch,
  rows_typed: rows.size,
  records_emitted: emitted,
  records_consumed_by_map: consumed,
  steps,
  mismatches: steps.reduce((sum, step) => sum + step.mismatches, 0),
  focus,
};
console.log(JSON.stringify(summary, null, 2));
