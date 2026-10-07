// A bot session capture's files (`integrity capture --bot`, journey.ts), decoded
// for its analysis scripts: botResult.ts, botInputs.ts, pad49Result.ts and
// stallSeries.ts. Fields they don't read are ignored.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const Publication = Schema.Struct({ contents: Schema.String, mtime_realtime_ns: Schema.Number, publication_monotonic_estimate_ns: Schema.Number });
const Event = Schema.Struct({
  event: Schema.String,
  epoch: Schema.optional(Schema.Number),
  trial: Schema.optional(Schema.Number),
  pid: Schema.optional(Schema.Number),
  stopped_monotonic_ns: Schema.optional(Schema.Number),
  continued_monotonic_ns: Schema.optional(Schema.Number),
  pressed_monotonic_ns: Schema.optional(Schema.Number),
  observed_monotonic_ns: Schema.optional(Schema.Number),
  text: Schema.optional(Schema.String),
  publications: Schema.optional(Schema.Array(Publication)),
});
const Settings = Schema.Struct({ clients: Schema.Array(Schema.Struct({ name: Schema.String, pid: Schema.Number })) });
const Edge = Schema.Struct({
  phase: Schema.String,
  event: Schema.String,
  type: Schema.Number,
  code: Schema.Number,
  value: Schema.Number,
  producer_injected_monotonic_ns: Schema.Number,
});

const parse = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

/** The journey's events; a failed capture writes events.json without capture.json. */
export const readEvents = (directory: string) => Schema.decodeUnknownSync(Schema.Array(Event))(parse(join(directory, "events.json")));

/** Each client's name and the game process the capture recorded, when it finished. */
export function readGamePids(directory: string) {
  try {
    const capture = parse(join(directory, "capture.json"));
    return typeof capture === "object" && capture !== null && "settings" in capture ? Schema.decodeUnknownSync(Settings)(capture.settings).clients : [];
  } catch {
    return [];
  }
}

/** Every pad edge the capture wrote, in order. */
export const readEdges = (directory: string) =>
  readFileSync(join(directory, "producer.jsonl"), "utf8").split("\n").filter((line) => line !== "").map((line) => Schema.decodeUnknownSync(Edge)(JSON.parse(line)));

/** A frame at 60 frames a second, in ms. */
const FRAME_MS = 1000 / 60;
const middle = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? undefined : sorted[Math.floor((sorted.length - 1) / 2)];
};
const triple = (label: string, text: string) => {
  const match = new RegExp(`${label}:\\s*([\\d.]+)\\s*/\\s*([\\d.]+)\\s*/\\s*([\\d.]+)`).exec(text);
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])] as const;
};

/**
 * Client A's frame-cost overlay readings (journey.ts's `perf-overlay`
 * events), each the median / p95 / max of the 120 frames before it. A
 * reading whose Lua line is not three numbers is counted as unread.
 */
export function frameCostOverlay(events: readonly (typeof Event.Type)[]) {
  const readings = events.filter((event) => event.event === "perf-overlay");
  const windows = readings.flatMap(({ epoch, text = "" }) => {
    const lua = triple("Lua ms", text);
    const natives = triple("natives", text);
    return lua === undefined ? [] : [{ epoch, lua_ms: { median: lua[0], p95: lua[1], max: lua[2] }, natives: natives === undefined ? undefined : { median: natives[0], p95: natives[1], max: natives[2] } }];
  });
  const of = (pick: (window: typeof windows[number]) => number) => windows.map(pick);
  return {
    readings: readings.length,
    unread: readings.length - windows.length,
    lua_ms: {
      median_of_medians: middle(of((window) => window.lua_ms.median)),
      median_p95: middle(of((window) => window.lua_ms.p95)),
      max_p95: windows.length === 0 ? undefined : Math.max(...of((window) => window.lua_ms.p95)),
      max: windows.length === 0 ? undefined : Math.max(...of((window) => window.lua_ms.max)),
    },
    windows_with_a_frame_over_16_7_ms: windows.filter((window) => window.lua_ms.max > FRAME_MS).length,
    natives_median: middle(windows.flatMap((window) => (window.natives === undefined ? [] : [window.natives.median]))),
    windows,
  };
}
