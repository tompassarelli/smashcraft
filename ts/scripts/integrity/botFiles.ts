// A bot session capture's files (`parity capture --bot`, journey.ts), decoded
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
