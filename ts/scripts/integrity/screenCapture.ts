

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { type Region, captureTimed, loadClients } from "wisp/scripts/warcraft/desktop";
import { encodePpm } from "wisp/scripts/wisp/frameProbe";
import { ClientWatch, describeView } from "wisp/scripts/wisp/watch";
import { IntegrityFailure, tryIntegrity } from "./evidence";
import { monotonicNs } from "./linux";
import { distribution } from "./reconcile";

export interface ScreenCaptureOptions {
  readonly clientsFile: string;
  readonly client: string;
  readonly out: string;
  readonly samples: number;
  readonly region: Region | undefined;
}

export function screenCaptureArguments(args: readonly string[]): ScreenCaptureOptions {
  const { values } = parseArgs({ args: [...args], strict: true, options: {
    screen: { type: "boolean" }, "clients-file": { type: "string" }, client: { type: "string" },
    out: { type: "string" }, count: { type: "string" }, region: { type: "string" },
  } });
  const samples = Number(values.count ?? "30");
  if (values["clients-file"] === undefined || values.client === undefined || values.out === undefined) {
    throw new Error("integrity capture --screen requires --clients-file FILE --client NAME --out PRIVATE_DIR [--count N] [--region X,Y,WIDTH,HEIGHT]");
  }
  if (!Number.isInteger(samples) || samples < 1 || samples > 7200) throw new Error("--count must be from 1 to 7200");
  if (!isAbsolute(values.out) || resolve(values.out).startsWith(resolve(import.meta.dir, "../../../..") + "/")) throw new Error("--out must be an absolute private directory outside the checkout");
  const numbers = values.region?.split(",").map(Number);
  let region: Region | undefined;
  if (numbers !== undefined) {
    const [x, y, width, height] = numbers;
    if (numbers.length !== 4 || x === undefined || y === undefined || width === undefined || height === undefined
      || !numbers.every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1) throw new Error("--region takes X,Y,WIDTH,HEIGHT with nonnegative origin and positive size");
    region = { x, y, width, height };
  }
  return { clientsFile: values["clients-file"], client: values.client, out: values.out, samples, region };
}

export interface ScreenSample {
  readonly file: string;
  readonly beforeNs: number;
  readonly afterNs: number;
  readonly width: number;
  readonly height: number;
}


export const captureScreen = (options: ScreenCaptureOptions) => Effect.gen(function*() {
  const clients = yield* loadClients(options.clientsFile);
  const client = clients.find(client => client.name === options.client);
  if (client === undefined) return yield* new IntegrityFailure({ operation: "select screen client", path: options.clientsFile, cause: `${options.client} is absent` });
  if (/^:0(?:\.0)?$/.test(client.x11.DISPLAY ?? "")) return yield* new IntegrityFailure({ operation: "select private screen client", path: client.name, cause: "the integrity screen recorder requires a private desktop" });
  const view = yield* ClientWatch.use(watch => watch.view(client)).pipe(Effect.provide(ClientWatch.layer({ filePrefix: "smashcraft" })));
  console.log(`${client.name}: ${describeView(view)}`);
  if (view.state.kind !== "in match") return yield* new IntegrityFailure({ operation: "capture match pixels", path: client.name, cause: `expected a running match, observed ${describeView(view)}` });
  yield* tryIntegrity("create private screen capture", options.out, () => mkdirSync(options.out));
  const samples: ScreenSample[] = [];
  for (let index = 0; index < options.samples; index++) {
    const sample = yield* captureTimed(client, monotonicNs, options.region);
    const file = `screen-${String(index).padStart(5, "0")}.ppm`;
    yield* tryIntegrity("save native framebuffer", options.out, () => writeFileSync(join(options.out, file), encodePpm(sample.frame)));
    const recorded = { file, beforeNs: sample.beforeNs, afterNs: sample.afterNs, width: sample.frame.width, height: sample.frame.height };
    yield* tryIntegrity("save native framebuffer interval", options.out, () => appendFileSync(join(options.out, "screen-samples.jsonl"), JSON.stringify(recorded) + "\n"));
    samples.push(recorded);
  }
  const spans = samples.map(sample => (sample.afterNs - sample.beforeNs) / 1_000_000);
  const gaps = samples.slice(1).map((sample, index) => (sample.beforeNs - (samples[index]?.afterNs ?? sample.beforeNs)) / 1_000_000);
  const report = {
    kind: "native-screen-samples", clock: "CLOCK_MONOTONIC", client: options.client,
    clients_file: options.clientsFile, region: options.region, samples,
    acquisition_ms: distribution(spans), between_acquisitions_ms: distribution(gaps),
    latency_result: null,
    scope: "Actual compositor RGB with acquisition brackets. No stimulus or fighter-response classification in this cadence sample.",
  };
  yield* tryIntegrity("save native screen intervals", options.out, () => writeFileSync(join(options.out, "screen-capture.json"), JSON.stringify(report, undefined, 2) + "\n"));
  console.log(JSON.stringify({ samples: samples.length, acquisition_ms: report.acquisition_ms, between_acquisitions_ms: report.between_acquisitions_ms, out: options.out }));
});
