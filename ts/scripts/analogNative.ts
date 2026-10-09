import { mkdirSync, readFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { ChildProcess } from "effect/process";
import { runProcess, stopBunProcess, startInputProcess } from "./hostProcess";
import { pollUntil } from "./hostPoll";
import { loadClients, windowPid } from "wisp/scripts/warcraft/desktop";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { padScriptPreset } from "./integrity/padScript";

export const calibrateCursor = (options: { args: readonly string[]; env: Record<string, string | undefined>; path: string; log: string; corner: string }) => Effect.scoped(Effect.gen(function*() {
    const { path, corner } = options;
    const before = Date.now();
    const { child: calibration } = yield* startInputProcess([...options.args, "--cursor-calibrate", corner], {
      env: options.env, stderr: options.log,
    });
    return yield* pollUntil(Effect.gen(function*() {
        try {
          const stat = statSync(path);
          const line = preloadLines(readFileSync(path, "utf8"))?.find(line => line.startsWith(`corner ${corner} `));
          const clock = line?.match(/native-seconds ([\d.]+)/)?.[1];
          if (stat.mtimeMs >= before && clock !== undefined) {
            const count = (field: string) => Number(line?.match(new RegExp(`${field} ([\\d.]+)`))?.[1]);
            return { nativeSeconds: Number(clock), hostPublicationMs: stat.mtimeMs, mouseEvents: count("mouse-events"), syncEvents: count("sync-events") };
          }
        } catch {}
        if (calibration.exitCode !== null) return yield* analogFailure(`Cursor calibration helper exited ${calibration.exitCode} before publishing ${corner}`);
        return undefined;
      }), { every: "20 millis", within: "15 seconds", orElse: () => Effect.fail(analogFailure(`Cursor did not observe the ${corner} cursor calibration`)) });
}));

export const analogNative = Effect.gen(function*() {
const { values } = parseArgs({ options: {
  pair: { type: "string" }, "clients-file": { type: "string" }, helper: { type: "string" }, map: { type: "string" },
  route: { type: "string" }, out: { type: "string" }, grid: { type: "string", default: "100,100,508,508,1280,720" },
  "app-id": { type: "string", multiple: true }, matches: { type: "string", default: "20" }, plan: { type: "boolean" },
} });
const { pair, helper, map, route, out, grid } = values;
const clientsFile = values["clients-file"];
const matches = Number(values.matches);
if (pair === undefined || helper === undefined || map === undefined || clientsFile === undefined || out === undefined
  || (route !== "keys" && route !== "cursor") || !Number.isInteger(matches) || matches < 1) {
  return yield* analogFailure("Use --pair N --clients-file FILE --helper WC3_CONTROLLER --map MAP --route keys|cursor --out DIR --app-id NAME=ID twice [--matches 20] [--plan]");
}
const appIds = yield* Effect.try({ try: () => new Map(values["app-id"]?.map(entry => {
  const [name, id] = entry.split("=");
  if (name === undefined || id === undefined) throw new Error("--app-id takes NAME=ID");
  return [name, id];
})), catch: analogFailure });
const plan = { pair, clientsFile, helper, map, route, grid, matches, out, calibration: ["start", "end"], startsClients: false };
if (values.plan) {
  console.log(JSON.stringify(plan, null, 2));
  return;
}
mkdirSync(out, { recursive: true });
const command = (args: readonly string[]) => runProcess(ChildProcess.make(process.execPath, ["scripts/wisp.ts", ...args], { cwd: join(import.meta.dir, "..") }));
const write = (file: string, value: unknown) => Effect.tryPromise({ try: () => Bun.write(join(plan.out, file), JSON.stringify(value, null, 2)), catch: analogFailure });

yield* write("plan.json", plan);


yield* command(["client", "watch", "--once", "--clients-file", clientsFile]);
yield* command(["lan", "fresh", map, "--pair", pair]);
const clients = yield* (loadClients(clientsFile));
if (clients.length !== 2) return yield* analogFailure("The assigned clients file must contain exactly two clients");
const data = clients.map(client => join(client.documents, "CustomMapData"));
const targets = yield* Effect.forEach(clients, client => Effect.gen(function*() {
  const appId = appIds.get(client.name);
  if (appId === undefined) return yield* analogFailure(`Missing --app-id ${client.name}=ID`);
  const pid = yield* (windowPid(client));
  return { client, args: [helper, "--emit", "--display", client.x11.DISPLAY ?? "", "--x11-window", client.window,
    "--pid", `${pid}`, "--private-wlr-app-id", appId, "--watch-seconds", "900", "--cursor-grid", grid ?? ""] };
}));


const anchors: { match: number; slot: number; nativeSeconds: number; hostPublicationMs: number; mouseEvents: number; syncEvents: number }[] = [];
const calibrate = (match: number) => Effect.scoped(Effect.gen(function*() {
 for (const [slot, target] of targets.entries()) {
  for (const corner of ["start", "end"]) {
    const anchor = yield* calibrateCursor({ args: target.args, env: { ...Bun.env, ...target.client.x11, ...target.client.wayland },
      path: join(data[slot] ?? "", `smashcraft-pad-calibration-p${slot}.txt`), log: join(plan.out, `calibration-${slot}-${corner}.log`), corner });
    anchors.push({ match, slot, ...anchor });
  }
 }
 yield* write("clock-anchors.json", anchors);
}));

const startHelpers = (match: number) => Effect.forEach(targets, (target, slot) => Effect.gen(function*() {
  return yield* startInputProcess([...target.args, "--virtual-pad", ...padScriptPreset(), "--pad-ingress", route], {
    env: { ...Bun.env, ...target.client.x11, ...target.client.wayland },
    stdout: join(plan.out, `helper-match-${match}-p${slot}.tsv`), stderr: join(plan.out, `helper-match-${match}-p${slot}.log`),
  });
}));
const commands: { match: number; beat: number; slot: number; hostMs: number; lines: string[] }[] = [];
const records: { match: number; slot: number; file: string; seconds: number; networkEvents: number; anchorNativeSeconds: number; anchorHostMs: number }[] = [];
yield* Effect.gen(function*() {
  for (let match = 1; match <= matches; match++) {
    yield* command(["client", "watch", "--once", "--clients-file", clientsFile]);
    if (match > 1) yield* command(["client", "chat", clients[0]?.name ?? "", "-dev reset", "--clients-file", clientsFile]);
    const started = Date.now();
    yield* command(["client", "chat", clients[0]?.name ?? "", "-dev quick", "--clients-file", clientsFile]);
    yield* calibrate(match);
    const helpers = yield* startHelpers(match);
    yield* Effect.sleep(500);
    const found = new Map<number, string>();
    for (let beat = 0; Date.now() - started < 240000 && found.size < 2; beat++) {
      for (const [slot, producer] of helpers.entries()) {
        if (producer.child.exitCode !== null) return yield* analogFailure(`Helper ${slot} exited before match ${match} finished`);
        const facing = slot === 0 ? 1 : -1;
        const toward = beat % 20 < 14 ? facing : -facing;
        const lines = [
          `axis leftx ${toward * (beat % 3 === 0 ? 16384 : 32767)}`,
          `axis lefty ${beat % 20 === 5 ? -16384 : beat % 20 === 6 ? 16384 : 0}`,
          `axis lefttrigger ${beat % 16 === 2 ? -7068 : beat % 16 === 3 ? 10000 : beat % 16 === 4 ? 32767 : -32768}`,
          `axis righttrigger ${beat % 16 === 6 ? 10000 : beat % 16 === 7 ? 32767 : -32768}`,
          `button a ${beat % 2}`, `button b ${beat % 7 === 0 ? 1 : 0}`, `button x ${beat % 5 === 0 ? 1 : 0}`,
        ];
        commands.push({ match, beat, slot, hostMs: Date.now(), lines });
        for (const line of lines) yield* producer.write(line);
      }
      for (const [slot, directory] of data.entries()) {
        const file = readdirSync(directory).find(file => file.startsWith(`smashcraft-pad-${route}-e`) && file.endsWith(`-p${slot}.txt`) && statSync(join(directory, file)).mtimeMs >= started);
        if (file !== undefined) found.set(slot, file);
      }
      yield* Effect.sleep(100);
    }
    if (found.size !== 2) return yield* analogFailure(`Match ${match} did not finish normally on both clients in four minutes`);
    for (const [slot, file] of found) {
      const source = join(data[slot] ?? "", file);
      const lines = preloadLines(readFileSync(source, "utf8")) ?? [];
      const header = lines[0] ?? "";
      const number = (field: string) => Number(header.match(new RegExp(`${field} ([\\d.]+)`))?.[1]);
      const anchor = anchors.filter(anchor => anchor.match === match && anchor.slot === slot).at(-1);
      if (anchor === undefined) return yield* analogFailure(`No clock anchor for match ${match}, client ${slot}`);

      const finalCalibration = anchors.filter(anchor => anchor.match === match).at(-1);
      if (finalCalibration === undefined) return yield* analogFailure(`No completed calibration for match ${match}`);
      const baseline = lines.find(line => line.startsWith(`mouse ${finalCalibration.mouseEvents} `))?.split(" ");
      if (baseline === undefined) return yield* analogFailure(`No final calibration event in match ${match}, client ${slot}`);
      const seconds = number("finished") - Number(baseline[2]);
      copyFileSync(source, join(plan.out, `match-${match}-p${slot}.txt`));
      records.push({ match, slot, file, seconds, networkEvents: number("mouse-events") + number("sync-events") - finalCalibration.mouseEvents - Number(baseline[3]), anchorNativeSeconds: anchor.nativeSeconds, anchorHostMs: anchor.hostPublicationMs });
    }
    yield* write("commands.json", commands);
    yield* write("matches.json", records);
    yield* Effect.forEach(helpers, producer => stopBunProcess(producer.child));
    console.log(`Completed ${match}/${matches} ordinary one-stock matches (${route})`);
  }
}).pipe(Effect.ensuring(Effect.promise(() => Bun.write(join(plan.out, "commands.json"), JSON.stringify(commands)))));
yield* command(["client", "watch", "--once", "--clients-file", clientsFile]);
console.log(`Raw comparison records: ${out}. Reconcile helper submissions, captured rows and native desync reports before choosing a route.`);

});
class AnalogFailure extends Schema.TaggedError<AnalogFailure>()("AnalogFailure", { problem: Schema.String }) {
  override get message() { return this.problem; }
}
const analogFailure = (cause: unknown) => new AnalogFailure({ problem: cause instanceof Error ? cause.message : String(cause) });
if (import.meta.main) BunRuntime.runMain(Effect.scoped(analogNative).pipe(Effect.catchDefect(cause => Effect.fail(analogFailure(cause))), Effect.provide(BunServices.layer)));
