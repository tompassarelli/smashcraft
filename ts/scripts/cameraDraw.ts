// Joins actual compositor frames to the existing response marker. Camera Q
// rows remain callback samples; they are never presented as per-draw cameras.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { ResponsePage } from "./wisp/boundary";

const VideoMetadata = Schema.Struct({
  streams: Schema.Array(Schema.Struct({ width: Schema.Finite, height: Schema.Finite })),
  frames: Schema.Array(Schema.Struct({ best_effort_timestamp_time: Schema.String })),
});

interface Marker { readonly x: number; readonly y: number; readonly pixels: number }
interface CapturedFrame { readonly index: number; readonly seconds: number; readonly marker: Marker | undefined }
interface Callback {
  readonly row: number;
  entryMs?: number;
  confirmedBefore?: number;
  confirmedAfter?: number;
  predictedBefore?: number;
  predictedAfter?: number;
  correction?: number;
  frame?: number;
  positions?: Record<number, { readonly x: number; readonly z: number }>;
  camera?: readonly number[];
}

/** The probe is a magenta glyph in the game's top-left 128-cell grid. */
export function cameraMarker(rgb: Uint8Array, width: number, height: number): Marker | undefined {
  const scale = height / 0.6;
  let count = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < Math.min(height, Math.ceil(0.065 * scale)); y++) {
    for (let x = Math.max(0, Math.floor(0.035 * scale)); x < Math.min(width, Math.ceil(0.16 * scale)); x++) {
      const offset = (y * width + x) * 3;
      const red = rgb[offset] ?? 0, green = rgb[offset + 1] ?? 0, blue = rgb[offset + 2] ?? 0;
      if (red >= 220 && blue >= 220 && green <= 60) { count++; sumX += x; sumY += y; }
    }
  }
  return count < 2 ? undefined : { x: sumX / count, y: sumY / count, pixels: count };
}

function distribution(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
  return { samples: values.length, p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: percentile(1) };
}

async function callbacks(directory: string, slot: number, run: number): Promise<Map<number, Callback>> {
  const rows = new Map<number, Callback>();
  const glob = new Bun.Glob(`**/*smashcraft-response-p${slot}-run${run}-page*.txt`);
  let pages = 0;
  for (const file of glob.scanSync({ cwd: directory, onlyFiles: true })) {
    const path = join(directory, file);
    const page = await Effect.runPromise(ResponsePage.decode(path, readFileSync(path, "utf8")));
    pages++;
    for (const line of page.lines) {
      const [kind, rowText, ...words] = line.split(" ");
      if (kind !== "A" && kind !== "B" && kind !== "P" && kind !== "Q") continue;
      const number = Number(rowText);
      if (!Number.isInteger(number) || number < 0) continue;
      const row = rows.get(number) ?? { row: number };
      rows.set(number, row);
      const values = words.map(Number);
      const numberAt = (index: number): number => {
        const value = values[index];
        if (value === undefined || !Number.isFinite(value)) throw Error(`Invalid ${kind} row ${number} at field ${index}`);
        return value;
      };
      if (kind === "A") {
        row.entryMs = numberAt(0); row.confirmedBefore = numberAt(5); row.confirmedAfter = numberAt(6);
        row.predictedBefore = numberAt(7); row.predictedAfter = numberAt(8);
      } else if (kind === "B") row.correction = numberAt(8);
      else if (kind === "P") {
        row.frame = numberAt(1);
        (row.positions ??= {})[numberAt(0)] = { x: numberAt(2), z: numberAt(3) };
      }
      else row.camera = values;
    }
  }
  if (pages === 0 || rows.size === 0) throw Error(`No decoded response pages for slot ${slot}, run ${run} in ${directory}`);
  return rows;
}

async function videoFrames(video: string, viewport: readonly number[]): Promise<{ width: number; height: number; frames: CapturedFrame[] }> {
  const probe = Bun.spawnSync(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_frames", "-show_streams",
    "-show_entries", "stream=width,height:frame=best_effort_timestamp_time", "-of", "json", video]);
  if (probe.exitCode !== 0) throw Error(probe.stderr.toString());
  const metadata = Schema.decodeUnknownSync(VideoMetadata)(JSON.parse(probe.stdout.toString()));
  const stream = metadata.streams[0];
  if (stream === undefined) throw Error("Video has no video stream");
  const [x = 0, y = 0, width = stream.width, height = stream.height] = viewport;
  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1
    || x + width > stream.width || y + height > stream.height) throw Error("Viewport must fit inside the recorded output");
  const decoder = Bun.spawn(["ffmpeg", "-v", "error", "-i", video, "-map", "0:v:0", "-vf", `crop=${width}:${height}:${x}:${y}`,
    "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { stdout: "pipe", stderr: "pipe" });
  const errors = new Response(decoder.stderr).text();
  const reader = decoder.stdout.getReader();
  const bytes = new Uint8Array(width * height * 3);
  const frames: CapturedFrame[] = [];
  let filled = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      for (let offset = 0; offset < next.value.length;) {
        const count = Math.min(bytes.length - filled, next.value.length - offset);
        bytes.set(next.value.subarray(offset, offset + count), filled);
        filled += count; offset += count;
        if (filled !== bytes.length) continue;
        const timestamp = metadata.frames[frames.length]?.best_effort_timestamp_time;
        const seconds = Number(timestamp);
        if (timestamp === undefined || !Number.isFinite(seconds)) throw Error(`Missing timestamp for decoded frame ${frames.length}`);
        frames.push({ index: frames.length, seconds, marker: cameraMarker(bytes, width, height) });
        filled = 0;
      }
    }
    const code = await decoder.exited;
    if (code !== 0) throw Error(await errors);
    if (filled !== 0 || frames.length !== metadata.frames.length) throw Error("Raw frames and retained video timestamps differ");
  } catch (error) {
    decoder.kill();
    await decoder.exited;
    throw error;
  } finally { reader.releaseLock(); }
  return { width, height, frames };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: {
    video: { type: "string" }, pages: { type: "string" }, out: { type: "string" },
    slot: { type: "string", default: "0" }, run: { type: "string", default: "1" }, viewport: { type: "string" },
  } });
  if (values.video === undefined || values.pages === undefined || values.out === undefined || !isAbsolute(values.out)) {
    throw Error("cameraDraw requires --video PRIVATE.mkv --pages DATA_DIR --out PRIVATE_DIR [--slot 0 --run 1 --viewport X,Y,W,H]");
  }
  const rows = await callbacks(values.pages, Number(values.slot), Number(values.run));
  const video = await videoFrames(values.video, values.viewport?.split(",").map(Number) ?? []);
  const marked = video.frames.filter(frame => frame.marker !== undefined);
  const first = marked[0];
  if (first === undefined) throw Error("No response marker in the retained video viewport");
  const originX = Math.min(...marked.map(frame => frame.marker?.x ?? Infinity));
  const originY = Math.min(...marked.map(frame => frame.marker?.y ?? Infinity));
  const scale = video.height / 0.6;
  let lastRow: number | undefined;
  let previousFrame: number | undefined;
  const matched = marked.map(frame => {
    const column = Math.round(((frame.marker?.x ?? originX) - originX) / (0.0032 * scale));
    const line = Math.round(((frame.marker?.y ?? originY) - originY) / (0.01 * scale));
    if (column < 0 || column > 31 || line < 0 || line > 3) throw Error(`Marker outside grid on video frame ${frame.index}`);
    const cell = column + line * 32;
    const row = lastRow === undefined ? cell : lastRow + ((cell - lastRow % 128 + 128) % 128);
    if (lastRow === undefined && row > 1) throw Error("Video started too late to identify the first response row");
    lastRow = row;
    const callback = rows.get(row);
    if (callback === undefined) throw Error(`Video marker row ${row} has no exported response row`);
    const matchFrame = callback.frame ?? callback.predictedAfter ?? callback.confirmedAfter;
    const advance = previousFrame === undefined || matchFrame === undefined ? undefined : matchFrame - previousFrame;
    previousFrame = matchFrame;
    return { ...frame, seconds: frame.seconds - first.seconds, row, matchFrame, advance, callback };
  }).filter(frame => frame.seconds <= 60);
  const intervals = matched.slice(1).map((frame, index) => (frame.seconds - (matched[index]?.seconds ?? frame.seconds)) * 1000);
  const duration = matched.at(-1)?.seconds ?? 0;
  const report = {
    video: values.video, pages: values.pages, slot: Number(values.slot), run: Number(values.run), viewport: values.viewport,
    capturedFrames: matched.length, durationSeconds: duration, observedCapturedFps: duration > 0 ? (matched.length - 1) / duration : null,
    capturedIntervalMs: distribution(intervals), heldMatchFrames: matched.filter(frame => frame.advance === 0).length,
    multipleMatchAdvances: matched.filter(frame => (frame.advance ?? 0) > 1), reversedMatchFrames: matched.filter(frame => (frame.advance ?? 0) < 0),
    callbackCameraSamplesOnly: true, drawnCameraMeasured: false,
    scope: "Original compositor video timestamps and decoded callback marker. Q camera fields are callback samples; drawn camera pan/zoom still require pixel measurement.",
  };
  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, "drawn-frames.jsonl"), matched.map(frame => JSON.stringify(frame)).join("\n") + "\n");
  writeFileSync(join(values.out, "drawn-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ capturedFrames: report.capturedFrames, durationSeconds: duration, observedCapturedFps: report.observedCapturedFps,
    capturedIntervalMs: report.capturedIntervalMs, multipleMatchAdvances: report.multipleMatchAdvances.length, drawnCameraMeasured: false }));
}
