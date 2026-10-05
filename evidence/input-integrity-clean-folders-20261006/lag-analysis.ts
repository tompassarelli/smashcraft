// Scratch: #26 clean-folder diagnostics for one capture directory.
// Usage (from this folder): bun lag-analysis.ts CAPTURE_DIR EPOCH1_TRACE_DIR EPOCH2_TRACE_DIR [CPU_FILE]
// - Echo: median (min-max) of each match trace's per-second `local echo native-ms` means.
// - Receipt lag, as smashcraft network-model's sweepwall.ts: each helper receipt whose consumed
//   sequence maps to an I4 row of that match; lag = (receipt wall - first receipt wall)
//   - (game send ms of that frame - game send ms at the first receipt), with send ms from the
//   response pages' D rows (native-game-ms). The frame/60 variant replaces the send ms with frame*1000/60.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { decodePacket } from "../../ts/src/game/input/wire";

const [root, trace1, trace2, cpuFile] = process.argv.slice(2) as [string, string, string, string | undefined];
const preload = (text: string) => [...text.matchAll(/Preload\( "([^"]*)"/g)].map((m) => m[1]!);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n === 0 ? NaN : n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2; };

console.log(`# ${root}`);
console.log("## Local echo: median of per-second means (lowest-highest per-second mean), ms");
for (const [epoch, dir] of [[1, trace1], [2, trace2]] as const) {
  const cells = [0, 1].map((client) => {
    const path = join(root, dir, `${client}-wc3-melee-input-trace.txt`);
    const means = preload(readFileSync(path, "utf8")).flatMap((l) => { const m = /local echo native-ms min-mean-max [\d.]+:([\d.]+):[\d.]+/.exec(l); return m ? [Number(m[1])] : []; });
    return `${"AB"[client]} ${median(means).toFixed(1)} (${Math.min(...means).toFixed(1)}-${Math.max(...means).toFixed(1)}), n=${means.length}`;
  });
  console.log(`match ${epoch} (${dir}): ${cells.join(" | ")}`);
}

interface Segment { epoch: number; frames: Map<number, number>; receipts: { wall: number; consumed: number }[] }
function segments(client: number): Segment[] {
  const out: Segment[] = []; let cur: Segment | undefined;
  for (const l of readFileSync(join(root, `helper-${client}.log`), "utf8").split("\n")) {
    let m = /^match_start epoch=(\d+)/.exec(l);
    if (m) { cur = { epoch: Number(m[1]), frames: new Map(), receipts: [] }; out.push(cur); continue; }
    if (/^match_end /.test(l)) { cur = undefined; continue; }
    if (cur === undefined) continue;
    m = /^editbox_emit sequence=(\d+) .*\|(I4[^;]*);/.exec(l);
    if (m) { const p = decodePacket(m[2]!); if (p && p.epoch === cur.epoch) cur.frames.set(Number(m[1]), p.firstFrame + p.rows.length - 1); continue; }
    m = /^editbox_receipt monotonic_ns=(\d+) received=\d+ consumed=(\d+)/.exec(l);
    if (m) cur.receipts.push({ wall: Number(m[1]) / 1e6, consumed: Number(m[2]) });
  }
  return out;
}
function sendTimes(epoch: number, client: number): Map<number, number> | undefined {
  const dir = join(root, `epoch-${epoch}`);
  if (!existsSync(dir)) return undefined;
  const prefix = `${client}-smashcraft-response-p${client}-run`;
  const names = readdirSync(dir).filter((n) => n.startsWith(prefix));
  if (names.length === 0) return undefined;
  const latest = Math.max(...names.map((n) => Number(/-run(\d+)-/.exec(n)![1])));
  const send = new Map<number, number>();
  for (const n of names.filter((x) => x.includes(`-run${latest}-`))) for (const l of preload(readFileSync(join(dir, n), "utf8"))) {
    const x = l.split(" "); if (x[0] === "D" && Number(x[1]) === epoch) send.set(Number(x[2]), Number(x[3]));
  }
  return send;
}
const cpu = cpuFile && existsSync(cpuFile) ? readFileSync(cpuFile, "utf8").trim().split("\n").slice(1).map((l) => l.split(" ").map(Number)) : [];

console.log("## Journal receipts vs game clock (ms later than at the first receipt; positive = behind real time)");
for (const client of [0, 1]) for (const seg of segments(client)) {
  const pts: { wall: number; frame: number }[] = []; let last = -1;
  for (const r of seg.receipts) { if (r.consumed === last) continue; last = r.consumed; const f = seg.frames.get(r.consumed); if (f !== undefined) pts.push({ wall: r.wall, frame: f }); }
  if (pts.length === 0) continue;
  const t0 = pts[0]!;
  const byFrame = pts.map((p) => (p.wall - t0.wall) - (p.frame - t0.frame) * 1000 / 60);
  const send = sendTimes(seg.epoch, client);
  let bySend: number[] | undefined;
  if (send) { const s0 = pts.find((p) => send.has(p.frame)); if (s0) bySend = pts.filter((p) => send.has(p.frame)).map((p) => (p.wall - s0.wall) - (send.get(p.frame)! - send.get(s0.frame)!)); }
  const fmt = (xs: number[]) => `max ${Math.max(...xs).toFixed(0)}, final ${xs.at(-1)!.toFixed(0)}, quartiles ${[0.25, 0.5, 0.75].map((q) => xs[Math.floor(q * (xs.length - 1))]!.toFixed(0)).join("/")}`;
  const span = ((pts.at(-1)!.wall - t0.wall) / 1000).toFixed(1);
  console.log(`client ${"AB"[client]} match ${seg.epoch}: ${pts.length} receipts over ${span} s, frames ${t0.frame}-${pts.at(-1)!.frame}`);
  console.log(`  vs frame/60: ${fmt(byFrame)}`);
  if (bySend) console.log(`  vs game send ms (sweepwall): ${fmt(bySend)}`);
  if (cpu.length) {
    const lo = t0.wall / 1000, hi = pts.at(-1)!.wall / 1000;
    const rows = cpu.filter((r) => r[1]! >= lo && r[1]! <= hi);
    const col = client + 2;
    if (rows.length) console.log(`  CPU % of this client's Warcraft over the match (1 s samples, n=${rows.length}): median ${median(rows.map((r) => r[col]!)).toFixed(0)}, max ${Math.max(...rows.map((r) => r[col]!))}`);
  }
}
