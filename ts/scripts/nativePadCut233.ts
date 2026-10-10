import { mkdirSync, readFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import { Effect, Layer, Schema } from "effect";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { ChildProcess } from "effect/process";
import { runProcess, startInputProcess } from "./hostProcess";
import { pollUntil } from "./hostPoll";
import { loadClients, readClientsFile, windowPid, keys, typeText, type Client, type ClientEntry } from "wisp/scripts/warcraft/desktop";
import { desktopSession } from "wisp/scripts/platform/linux/desktop";
import { preloadLines } from "wisp/scripts/wisp/preloadRecord";
import { Clients } from "wisp/scripts/wisp/clients";
import { ClientWatch } from "wisp/scripts/wisp/watch";
import { freshMatch } from "./wisp/commands/fresh";
import { gameFilesLayer } from "./wisp/project";
import { Phase } from "../src/game/match/rules";
import { padScriptPreset } from "./integrity/padScript";
import { platformLayer } from "wisp/scripts/platform/layer";

export function validatePadCutClients(clients: readonly Pick<Client, "name" | "documents" | "x11" | "wayland">[], entries: readonly ClientEntry[], appIds: ReadonlyMap<string, string>, pair: string) {
  const count = pair === "tom" ? 1 : 2;
  if (clients.length !== count || entries.length !== count || appIds.size !== count || new Set(clients.map(client => client.name)).size !== count) {
    throw new Error(`Assign exactly ${count} selected clients and their app IDs`);
  }
  for (const [slot, client] of clients.entries()) {
    const entry = entries[slot];
    if (pair === "tom") {
      if (entry?.name !== "tom" || client.name !== "tom" || appIds.get("tom") !== "3516115571"
        || entry.documents !== join(homedir(), ".local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III")
        || client.documents !== entry.documents || !/^:0(?:\.0)?$/.test(client.x11.DISPLAY ?? "")
        || client.wayland.XDG_RUNTIME_DIR !== join(entry.run, "runtime")) {
        throw new Error("The authorized one-client run selects only Tom's Steam install on display :0");
      }
      continue;
    }
    if (entry === undefined || entry.name !== client.name || entry.documents !== client.documents
      || !/^:[1-9]\d*(?:\.0)?$/.test(client.x11.DISPLAY ?? "")
      || !/^\/run\/user\/\d+\/private-desktop\.[^/]+$/.test(entry.run)
      || client.wayland.XDG_RUNTIME_DIR !== join(entry.run, "runtime") || !appIds.get(client.name)) {
      throw new Error("Use only the explicitly assigned clients on their private displays");
    }
    if (pair === "online") {
      const owned = [join(homedir(), ".local/share/wc3-melee", `client-${entry.name}`), ...["b", "c"].map(clone => join(homedir(), ".local/share/wisp/online", `clone-${clone}`))]
        .map(prefix => join(prefix, "pfx/drive_c/users/steamuser/Documents/Warcraft III"));
      if ((entry.name !== "a" && entry.name !== "b") || !owned.includes(entry.documents)) {
        throw new Error("Online clients must be registered owned test clients");
      }
    } else if (!entry.documents.includes(`/wisp/lan/clients/lan${pair}${slot === 0 ? "a" : "b"}/`)) {
      throw new Error("Use the assigned offline LAN pair");
    }
  }
}

export const startPadCutProducer = (options: {
  helper: string; client: Pick<Client, "x11" | "wayland" | "window">; pid: number; single: boolean;
  niriWindow?: string | undefined; appId: string; out: string; slot: number;
}) => {
  return startInputProcess([options.helper, "--emit", "--virtual-pad", ...padScriptPreset(), "--display", options.client.x11.DISPLAY ?? "", "--x11-window", options.client.window,
    "--pid", String(options.pid), ...(options.single ? ["--niri-window", options.niriWindow ?? ""] : ["--private-wlr-app-id", options.appId]), "--watch-seconds", "300"], {
    env: { ...Bun.env, ...options.client.x11, ...options.client.wayland },
    stdout: join(options.out, `helper-p${options.slot}.tsv`), stderr: join(options.out, `helper-p${options.slot}.log`),
  });
};

export const padCut = Effect.gen(function*() {
const { values } = parseArgs({ options: {
  pair: { type: "string" }, "clients-file": { type: "string" }, helper: { type: "string" }, map: { type: "string" },
  out: { type: "string" }, "app-id": { type: "string", multiple: true }, plan: { type: "boolean" },
  "niri-window": { type: "string" },
} });
const { pair, helper, map, out } = values;
const clientsFile = values["clients-file"];
const single = pair === "tom";
const niriWindow = values["niri-window"];
if (pair === undefined || helper === undefined || map === undefined || clientsFile === undefined || out === undefined) {
  return yield* padCutFailure("Use --pair N --clients-file FILE --helper WC3_CONTROLLER --map MAP --out DIR --app-id NAME=ID twice [--plan]");
}
if (single && (niriWindow === undefined || !/^[1-9]\d*$/.test(niriWindow))) return yield* padCutFailure("The authorized Tom run needs its exact --niri-window ID");
const script = yield* Schema.decodeUnknownEffect(Schema.Struct({
  setup: Schema.String,
  cut: Schema.Struct({ client: Schema.String, afterMilliseconds: Schema.Finite, milliseconds: Schema.Finite }),
  combat: Schema.Struct({ beatMilliseconds: Schema.Finite, deadlineMilliseconds: Schema.Finite }),
}))(yield* Effect.try({ try: () => JSON.parse(readFileSync(join(import.meta.dir, "../test/native/pads/233/pad-cut.json"), "utf8")), catch: padCutFailure }));
const appIds = yield* Effect.try({ try: () => new Map(values["app-id"]?.map(entry => {
  const split = entry.indexOf("=");
  if (split < 1) throw new Error("--app-id takes NAME=ID");
  return [entry.slice(0, split), entry.slice(split + 1)];
})), catch: padCutFailure });
const plan = { pair, clientsFile, helper, map, out, script, startsClients: false };
if (values.plan) {
  console.log(JSON.stringify(plan, null, 2));
  return;
}
mkdirSync(out, { recursive: true });
yield* Effect.tryPromise({ try: () => Bun.write(join(out, "plan.json"), JSON.stringify(plan, null, 2)), catch: padCutFailure });
const command = (args: readonly string[]) => runProcess(ChildProcess.make(process.execPath, ["scripts/wisp.ts", ...args], { cwd: join(import.meta.dir, "..") }));
const selected = yield* (readClientsFile(clientsFile));
const sessions = yield* Effect.forEach(selected.clients, entry => desktopSession(entry).pipe(Effect.map(session => ({ ...entry, ...session }))));
yield* Effect.try({ try: () => validatePadCutClients(sessions, selected.clients, appIds, pair), catch: padCutFailure });
yield* command(["client", "watch", "--once", "--clients-file", clientsFile]);
const clients = yield* (loadClients(clientsFile));
const hostedAt = single ? 0 : Date.now();
if (pair === "online") yield* (freshMatch(map).pipe(
  Effect.provide(Layer.mergeAll(Clients.layer(clientsFile), gameFilesLayer, ClientWatch.layer({ filePrefix: "smashcraft" }))),
));
else if (!single) yield* command(["lan", "fresh", map, "--pair", pair]);
const data = clients.map(client => join(client.documents, "CustomMapData"));
yield* pollUntil(Effect.sync(() => data.every(directory => {
  try { return statSync(join(directory, "wc3-melee-ready.txt")).mtimeMs >= hostedAt; } catch { return false; }
}) ? true : undefined), { every: "50 millis", within: "8 seconds", orElse: () => Effect.fail(padCutFailure("Both clients did not publish fresh keyboard readiness")) });
if (single) {
  const ready = preloadLines(readFileSync(join(data[0] ?? "", "wc3-melee-ready.txt"), "utf8")) ?? [];
  if (!ready.includes("BUILD typescript-native-input")) return yield* padCutFailure("Load the assigned native-input probe map through the authorized Steam play chain first");
}
const fresh = Date.now();
const baseline = data.map(directory => new Set(readdirSync(directory)));
const producers = yield* Effect.forEach(clients, (client, slot) => Effect.gen(function*() {
  const appId = appIds.get(client.name);
  if (appId === undefined) return yield* padCutFailure(`Missing --app-id ${client.name}=ID`);
  const pid = yield* (windowPid(client));
  return yield* startPadCutProducer({ helper, client, pid, single, niriWindow, appId, out, slot });
}));
const host = clients[0];
if (host === undefined) return yield* padCutFailure("Missing LAN host");
const timeline: { event: string; hostMs: number; monotonicNs: string; frames?: (number | undefined)[] }[] = [];
const frame = (directory: string, slot: number) => {
  try {
    const lines = preloadLines(readFileSync(join(directory, `smashcraft-drawn-typescript-native-input-p${slot}.txt`), "utf8")) ?? [];
    return Number(lines.join(" ").match(/frame=(\d+)/)?.[1]);
  } catch { return undefined; }
};
const note = (event: string) => timeline.push({ event, hostMs: Date.now(), monotonicNs: process.hrtime.bigint().toString(), frames: data.map(frame) });
yield* Effect.gen(function*() {
  yield* Effect.sleep(300);
  for (const client of clients) yield* (keys(client, "ctrl+g"));
  if (single) for (const setup of ["-dev reset", "-dev slots 1 2", "-dev fighter 2 illidan"]) {
    yield* (keys(host, "Escape", "Return"));
    yield* (typeText(host, setup));
    yield* (keys(host, "Return"));
    yield* Effect.sleep(200);
  }
  yield* (keys(host, "Escape", "Return"));
  yield* (typeText(host, script.setup));
  yield* (keys(host, "Return"));
  yield* Effect.sleep(500);
  const started = Date.now();
  note("match-input-start");
  let cut = false;
  const records = new Map<number, { file: string; lines: readonly string[] }>();
  for (let beat = 0; Date.now() - started < script.combat.deadlineMilliseconds && records.size < clients.length; beat++) {
    if (!cut && Date.now() - started >= script.cut.afterMilliseconds) {
      const producer = producers[0];
      if (producer === undefined) return yield* padCutFailure("Missing cut producer");
      note("pad-cut-start");
      producer.child.kill("SIGSTOP");
      yield* Effect.sleep(script.cut.milliseconds);
      producer.child.kill("SIGCONT");
      note("pad-cut-end");
      cut = true;
    }
    for (const [slot, producer] of producers.entries()) {
      if (producer.child.exitCode !== null) return yield* padCutFailure(`Pad producer ${slot} exited early`);
      const direction = (slot === 0 ? 1 : -1) * (beat % 20 < 14 ? 1 : -1);
      for (const line of [`axis leftx ${direction * 32767}`, `axis lefty ${beat % 20 === 5 ? -16384 : 0}`,
        `button a ${beat % 2}`, `button b ${beat % 7 === 0 ? 1 : 0}`, `button x ${beat % 5 === 0 ? 1 : 0}`]) yield* producer.write(line);
    }
    for (const [slot, directory] of data.entries()) {
      const name = readdirSync(directory).find(name => /^smashcraft-match-\d+\.txt$/.test(name)
        && !baseline[slot]?.has(name) && statSync(join(directory, name)).mtimeMs >= fresh);
      if (name !== undefined) records.set(slot, { file: name, lines: preloadLines(readFileSync(join(directory, name), "utf8")) ?? [] });
    }
    yield* Effect.sleep(script.combat.beatMilliseconds);
  }
  if (!cut || records.size !== clients.length) return yield* padCutFailure("The cut did not complete before every selected client reached normal results");
  const cutStart = timeline.find(event => event.event === "pad-cut-start");
  const cutEnd = timeline.find(event => event.event === "pad-cut-end");
  if (cutStart === undefined || cutEnd === undefined) return yield* padCutFailure("No recorded controller cut interval");
  const cutMilliseconds = Number(BigInt(cutEnd.monotonicNs) - BigInt(cutStart.monotonicNs)) / 1e6;
  if (cutMilliseconds < 1000 || cutMilliseconds >= 2000) return yield* padCutFailure(`Controller cut was ${cutMilliseconds} ms, expected 1 s`);
  for (let slot = 0; slot < clients.length; slot++) {
    const before = cutStart.frames?.[slot];
    const after = cutEnd.frames?.[slot];
    if (before === undefined || after === undefined || !(after > before)) return yield* padCutFailure(`Client ${slot} did not advance through the controller cut`);
  }
  for (const client of clients) yield* (keys(client, "ctrl+h"));
  yield* Effect.sleep(6000);
  const outcomes: string[] = [];
  let callbacks = 0;
  let ownWaiting = 0;
  let anyWaiting = 0;
  for (const [slot, directory] of data.entries()) {
    const record = records.get(slot);
    if (record === undefined) return yield* padCutFailure(`Missing match record on client ${slot}`);
    const result = record.lines.find(line => line.startsWith("result ")) ?? "";
    if (!result.includes("interrupted=0")) return yield* padCutFailure(`Client ${slot} match did not end normally: ${result}`);
    outcomes.push(result);
    copyFileSync(join(directory, record.file), join(out, `p${slot}-${record.file}`));
    const pages = readdirSync(directory).filter(name => /^smashcraft-response-p\d+-run\d+-page\d+\.txt$/.test(name)
      && statSync(join(directory, name)).mtimeMs >= fresh);
    if (pages.length === 0) return yield* padCutFailure(`No callback export for client ${slot}`);
    const rows = new Map<number, { before?: number; after?: number; phase?: number }>();
    let measuredWaiting: { any: number; own: number } | undefined;
    for (const name of pages) {
      copyFileSync(join(directory, name), join(out, `p${slot}-${name}`));
      for (const line of preloadLines(readFileSync(join(directory, name), "utf8")) ?? []) {
        const waiting = /^waiting callbacks=(\d+) own_callbacks=(\d+)$/.exec(line);
        if (waiting !== null) measuredWaiting = { any: Number(waiting[1]), own: Number(waiting[2]) };
        const words = line.split(" ");
        const row = Number(words[1]);
        if (words[0] === "A") rows.set(row, { ...rows.get(row), before: Number(words[7]), after: Number(words[8]) });
        if (words[0] === "B") rows.set(row, { ...rows.get(row), phase: Number(words[6]) });
      }
    }
    if (measuredWaiting === undefined) return yield* padCutFailure(`No actual HUD waiting count for client ${slot}`);
    ownWaiting += measuredWaiting.own;
    anyWaiting += measuredWaiting.any;
    let through = 0;
    for (const row of rows.values()) if (row.phase === Phase.match && row.before !== undefined && row.after !== undefined && row.after >= 0) {
      callbacks++;
      through = Math.max(through, row.after);
    }
    const ended = Number(result.match(/frames=(\d+)/)?.[1]);
    if (!(through >= ended)) return yield* padCutFailure(`Client ${slot} callback recording ends at ${through}, before match frame ${ended}`);
  }
  if (!single && outcomes[0] !== outcomes[1]) return yield* padCutFailure("Clients disagree on the normal match result");
  if (callbacks < 60 || anyWaiting !== 0) return yield* padCutFailure(`${anyWaiting} callbacks showed Waiting, ${ownWaiting} for the local player, out of ${callbacks}`);
  yield* Effect.tryPromise({ try: () => Bun.write(join(out, "result.json"), JSON.stringify({ passed: true, originalPairCheck: single ? "pending" : "passed", selectedClients: clients.length, cutMilliseconds, callbacks, ownWaiting, anyWaiting, outcomes, timeline }, null, 2)), catch: padCutFailure });
  console.log(`PASS ${single ? "one-client cut; original two-client check pending" : "#233"}: ${callbacks} recorded callbacks, ${ownWaiting} waiting; selected clients ended normally`);
}).pipe(Effect.ensuring(Effect.promise(() => Bun.write(join(out, "timeline.json"), JSON.stringify(timeline, null, 2)))));
yield* command(["client", "watch", "--once", "--clients-file", clientsFile]);
});

class PadCutFailure extends Schema.TaggedError<PadCutFailure>()("PadCutFailure", { problem: Schema.String }) {
  override get message() { return this.problem; }
}
const padCutFailure = (cause: unknown) => new PadCutFailure({ problem: cause instanceof Error ? cause.message : String(cause) });

if (import.meta.main) BunRuntime.runMain(Effect.scoped(padCut).pipe(Effect.catchDefect(cause => Effect.fail(padCutFailure(cause))), Effect.provide(Layer.merge(BunServices.layer, platformLayer()))));
