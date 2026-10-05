// Scratch driver: N native hot reloads, as smashcraft:evidence/reload-speed-native-20261006/.
// Per sample: Ctrl+T on A (trace on both clients), save a new marker in the
// confirmed-frame trace line, wait for the watcher's `vN running in 2 client(s)`,
// read both hot acks, wait for both traces, pair confirmed checksums by frame.
// Usage: bun reload-driver.ts LANE_TS_DIR WATCHER_LOG A_DATA B_DATA OUT_JSON [N]
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [ts, log, aData, bData, out, count = "10"] = process.argv.slice(2) as [string, string, string, string, string, string?];
const source = join(ts, "src/platform/shell/diagnostics.ts");
const LINE = /(`confirmed frame \$\{s\.runtime\.simulationFrame\} state \$\{state\})( module-reload-\d+)?`/;
const bun = process.execPath;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const preload = (text: string) => [...text.matchAll(/Preload\( "([^"]*)"/g)].map((m) => m[1]!);
const read = (path: string) => { try { return { text: readFileSync(path, "utf8"), mtime: statSync(path).mtimeMs }; } catch { return undefined; } };

async function until<T>(what: string, seconds: number, probe: () => T | undefined): Promise<T> {
  const end = performance.now() + seconds * 1000;
  for (;;) { const v = probe(); if (v !== undefined) return v; if (performance.now() > end) throw new Error(`${what}: not within ${seconds} s`); await sleep(10); }
}

const samples: unknown[] = [];
for (let n = 1; n <= Number(count); n++) {
  const marker = `module-reload-${n}`;
  const keys = Bun.spawnSync([bun, "wisp", "client", "keys", "a", "ctrl+t"], { cwd: ts });
  if (keys.exitCode !== 0) throw new Error(`ctrl+t failed: ${keys.stderr}`);
  const traceAfter = Date.now() - 50;
  await sleep(400);
  const logBefore = readFileSync(log, "utf8").length;
  const text = readFileSync(source, "utf8");
  if (!LINE.test(text)) throw new Error("confirmed-frame line not found");
  const saveWall = Date.now();
  const t0 = performance.now();
  writeFileSync(source, text.replace(LINE, `$1 ${marker}\``));
  const report = await until("watcher result", 30, () => {
    const added = readFileSync(log, "utf8").slice(logBefore);
    if (/rror|esync|fail/i.test(added)) throw new Error(`watcher: ${added}`);
    return /running in 2 client\(s\)/.test(added) ? added : undefined;
  });
  const saveToReportMs = performance.now() - t0;
  const runningLine = report.split("\n").find((l) => /running in 2 client/.test(l))!.trim();
  const publishLine = report.split("\n").find((l) => /publish v\d+/.test(l))?.trim();
  const version = Number(/v(\d+) running/.exec(runningLine)![1]);
  const acks = [0, 1].map((slot) => {
    const file = read(join([aData, bData][slot]!, `smashcraft-hot-ack-p${slot}.txt`));
    const m = /applied (\d+) at ([\d.]+)/.exec(preload(file?.text ?? "").join(" "));
    return m ? { applied: Number(m[1]), clock: m[2]! } : undefined;
  });
  const traces = await until("both traces", 20, () => {
    const t = [aData, bData].map((d) => read(join(d, "wc3-melee-input-trace.txt")));
    return t.every((x) => x !== undefined && x.mtime > traceAfter && / end$/m.test(preload(x.text).join("\n"))) ? t.map((x) => preload(x!.text)) : undefined;
  });
  const confirmed = traces.map((lines) => new Map(lines.flatMap((l) => { const m = /confirmed frame (\d+) state (\S+)( module-reload-\d+)?/.exec(l); return m ? [[Number(m[1]), { checksum: m[2]!, marker: m[3]?.trim() }] as const] : []; })));
  const frames = [...confirmed[0]!.keys()].filter((f) => confirmed[1]!.has(f)).map((frame) => ({ frame, a: confirmed[0]!.get(frame)!, b: confirmed[1]!.get(frame)! }));
  const equal = frames.filter((f) => f.a.checksum === f.b.checksum).length;
  const markerSeen = frames.some((f) => f.a.marker === marker && f.b.marker === marker);
  const wispStep = Number(/^\s*([\d.]+) s/.exec(runningLine)![1]);
  const sample = { sample: n, version, marker, saveWall, wispStepS: wispStep, saveToReportMs: Math.round(saveToReportMs), runningLine, publishLine, acks, equalPairs: `${equal}/${frames.length}`, markerSeen, frames: frames.map((f) => ({ frame: f.frame, checksumA: f.a.checksum, checksumB: f.b.checksum, marker: f.a.marker ?? null })) };
  samples.push(sample);
  console.log(`sample ${n} v${version}: wisp ${wispStep.toFixed(3)} s, save->report ${Math.round(saveToReportMs)} ms, acks ${acks.map((a) => a && `${a.applied}@${a.clock}`).join(" ")}, pairs ${equal}/${frames.length}, marker ${markerSeen}, frames ${frames[0]?.frame}-${frames.at(-1)?.frame} | ${publishLine}`);
  writeFileSync(out, `${JSON.stringify(samples, undefined, 2)}\n`);
  await sleep(1000);
}
