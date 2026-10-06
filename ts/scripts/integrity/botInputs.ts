// `bun scripts/integrity/botInputs.ts CAPTURE_DIR`: a bot session's pad presses
// against the rows each helper typed for its client, per match and slot: the
// presses the script sent (A attack, Y jump, X special, left-trigger shield,
// full-tilt dashes, C-stick flicks), the rows whose pressed bits carry them,
// buttons still held in the match's last row, and the helper's input delay at its edit-box receipts outside the 3 s after
// each stall (frames journaled beyond the last frame its client consumed).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Action, bit } from "../../src/game/input/actions";
import type { InputRow } from "../../src/game/input/inputRow";
import { decodePacket } from "../../src/game/input/wire";
import { readEdges, readEvents } from "./botFiles";
import { ABS_RX, ABS_RY, ABS_X, ABS_Z, BTN_A, BTN_X, BTN_Y, EV_ABS, EV_KEY } from "./linuxInput";

const [directory] = process.argv.slice(2);
if (directory === undefined) throw new Error("usage: bun scripts/integrity/botInputs.ts CAPTURE_DIR");
/** Each scripted press (edge type, code, sign of value) and the action bits whose press carries it. */
const BUTTONS = [
  [EV_KEY, BTN_A, 1, "attack", bit(Action.attack)],
  [EV_KEY, BTN_Y, 1, "jump", bit(Action.jump)],
  [EV_KEY, BTN_X, 1, "special", bit(Action.special)],
  [EV_ABS, ABS_Z, 1, "shield", bit(Action.leftTrigger)],
  [EV_ABS, ABS_X, 1, "dash-right", bit(Action.moveRight)],
  [EV_ABS, ABS_X, -1, "dash-left", bit(Action.moveLeft)],
  [EV_ABS, ABS_RX, 1, "c-right", bit(Action.smashRight)],
  [EV_ABS, ABS_RX, -1, "c-left", bit(Action.smashLeft)],
  [EV_ABS, ABS_RY, -1, "c-up", bit(Action.smashUp)],
  [EV_ABS, ABS_RY, 1, "c-down", bit(Action.smashDown)],
] as const;
const HELD_BUTTONS = bit(Action.attack) | bit(Action.jump) | bit(Action.special) | bit(Action.grab) | bit(Action.leftTrigger) | bit(Action.rightTrigger);

const events = readEvents(directory);
const edges = readEdges(directory);

const percentile = (values: readonly number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? undefined : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const report = [0, 1].flatMap((slot) => {
  const byEpoch = new Map<number, { rows: Map<number, InputRow>; delays: number[]; epochNs: number }>();
  let current: { rows: Map<number, InputRow>; delays: number[]; epochNs: number } | undefined;
  let epoch = 0;
  let published = 0;
  let frameOf = new Map<number, number>();
  for (const line of readFileSync(join(directory, `helper-${slot}.log`), "utf8").split("\n")) {
    const start = /^match_start epoch=(\d+) epoch_ns=(\d+)/.exec(line);
    if (start !== null) {
      epoch = Number(start[1]);
      current = { rows: new Map(), delays: [], epochNs: Number(start[2]) };
      byEpoch.set(epoch, current);
      published = 0;
      frameOf = new Map([[1, 0]]);
      continue;
    }
    if (current === undefined) continue;
    if (line.startsWith("match_end")) { current = undefined; continue; }
    const frame = /^published_frame=(\d+)/.exec(line);
    if (frame !== null) { published = Number(frame[1]); continue; }
    const emit = /^editbox_emit sequence=(\d+) .*envelope=@J\d+\|([^;]+);/.exec(line);
    if (emit !== null) {
      frameOf.set(Number(emit[1]), published);
      const packet = emit[2]?.startsWith("I4") === true ? decodePacket(emit[2]) : undefined;
      const rows = current.rows;
      packet?.rows.forEach((row, index) => rows.set(packet.firstFrame + index, row));
      continue;
    }
    const receipt = /^editbox_receipt monotonic_ns=(\d+) received=\d+ consumed=(\d+)/.exec(line);
    if (receipt === null) continue;
    const ns = Number(receipt[1]);
    const admitted = frameOf.get(Number(receipt[2]));
    const nearStall = events.some((event) => event.event === "bot-stall" && event.epoch === epoch && event.continued_monotonic_ns !== undefined
      && ns >= event.continued_monotonic_ns - 2.5e9 && ns <= event.continued_monotonic_ns + 3e9);
    if (admitted !== undefined && ns >= current.epochNs && !nearStall) current.delays.push(1 + Math.floor(((ns - current.epochNs) * 60) / 1e9) - admitted);
  }
  return [...byEpoch].map(([matchEpoch, { rows, delays }]) => {
    const sent = edges.filter((edge) => edge.event === `slot-${slot}` && edge.value !== 0 && (edge.phase.startsWith(`bot-${matchEpoch}-`) || (edge.phase.startsWith("pad49-") && matchEpoch === 1)));
    const frames = [...rows.keys()].sort((a, b) => a - b);
    const last = rows.get(frames.at(-1) ?? 0);
    const buttons = BUTTONS.map(([type, code, sign, name, mask]) => {
      const pressed = sent.filter((edge) => edge.type === type && edge.code === code && Math.sign(edge.value) === sign && (type === EV_KEY || Math.abs(edge.value) > 30000)).length;
      const received = [...rows.values()].filter((row) => (row.pressed & mask) !== 0).length;
      return { button: name, script_presses: pressed, rows_with_press: received, missed: Math.max(0, pressed - received), extra: Math.max(0, received - pressed) };
    });
    return {
      epoch: matchEpoch,
      slot,
      rows: rows.size,
      buttons,
      held_in_last_row: last === undefined ? undefined : last.held & HELD_BUTTONS,
      input_delay_frames: { n: delays.length, p50: percentile(delays, 50), p95: percentile(delays, 95), max: percentile(delays, 100) },
    };
  });
});
console.log(JSON.stringify(report, null, 2));
