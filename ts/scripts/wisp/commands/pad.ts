// `bun wisp pad SCRIPT --helper BINARY --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT]`:
// a virtual pad and the real helper for each client, as the integrity
// capture runs them; `--chat` types a developer command into client A (such
// as `-dev quick hero lich`); each script edge is written in the middle of its
// frame on the helper's own clock, and result.json gives the frame each one
// landed on. Script syntax: smashcraft:ts/scripts/integrity/padScript.ts.
import { mkdirSync, openSync, readFileSync, writeFileSync, writeSync, closeSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { at } from "wisp/src/runtime/lookup";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { type DesktopFailure, capture, keys, loadClients, typeText } from "wisp/scripts/warcraft/desktop";
import { encodePpm } from "wisp/scripts/wisp/frameProbe";
import { step } from "wisp/scripts/wisp/timings";
import { gameProcess, json, startHelper } from "../../integrity/capture";
import { IntegrityFailure, producerLine, tryIntegrity } from "../../integrity/evidence";
import { inject, monotonicNs, openPad } from "../../integrity/linux";
import { BTN_SELECT, PAD_BUTTONS } from "../../integrity/linuxInput";
import { type SentEdge, frameMiddleNs, landEdges, matchStart, parsePadScript, ruleFrame } from "../../integrity/padScript";
import { SLOTS } from "../../integrity/reconcile";
import { clientState } from "../project";
import { onHealthyClients } from "../doctor";

const USAGE = "pad SCRIPT --helper BINARY --build BUILD --out DIR --app-id a=ID --app-id b=ID [--chat=TEXT]";

const fromDesktop = (failure: DesktopFailure) => new IntegrityFailure({ operation: failure.operation, path: failure.client, cause: failure.cause });

/** Sleeps to `targetNs` on CLOCK_MONOTONIC: a coarse sleep, then a short spin for the last 2 ms. */
const until = (targetNs: number) => Effect.gen(function*() {
  const coarse = (targetNs - monotonicNs()) / 1e6 - 2;
  if (coarse > 0) yield* Effect.sleep(coarse);
  while (monotonicNs() < targetNs) { /* spin */ }
});

export const pad: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], allowPositionals: true, options: { helper: { type: "string" }, build: { type: "string" }, out: { type: "string" }, chat: { type: "string" }, "app-id": { type: "string", multiple: true } } }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const { helper, build, out, chat } = parsed.values;
  const [scriptPath] = parsed.positionals;
  if (scriptPath === undefined || helper === undefined || build === undefined || out === undefined) return yield* new UsageFailure({ problem: `usage: bun wisp ${USAGE}` });
  const appIds = new Map<string, string>();
  for (const entry of parsed.values["app-id"] ?? []) {
    const at = entry.indexOf("=");
    if (at > 0) appIds.set(entry.slice(0, at), entry.slice(at + 1));
  }
  const steps = yield* Effect.try({ try: () => parsePadScript(readFileSync(scriptPath, "utf8")), catch: (cause) => new UsageFailure({ problem: describeCause(cause) }) });

  const run = Effect.scoped(Effect.gen(function*() {
    const loaded = yield* loadClients(clientState).pipe(Effect.mapError(fromDesktop));
    if (loaded.length !== 2) return yield* new IntegrityFailure({ operation: "load clients", path: clientState, cause: `${loaded.length} clients, need 2` });
    const clients = [at(loaded, 0), at(loaded, 1)] as const;
    yield* tryIntegrity("create pad directory", out, () => mkdirSync(out, { recursive: true }));
    const data = clients.map((client) => join(client.documents, "CustomMapData"));
    const startedNs = monotonicNs();
    const pads = [];
    for (const slot of SLOTS) {
      const client = clients[slot];
      const appId = appIds.get(client.name);
      if (appId === undefined) return yield* new UsageFailure({ problem: `--app-id ${client.name}=ID is missing` });
      const pid = yield* gameProcess(client, false);
      const device = yield* openPad([...PAD_BUTTONS, BTN_SELECT]);
      pads.push(device);
      yield* startHelper([
        helper, "--follow-matches", "--build", build, "--slot", String(slot), "--device", device.device, "--out", at(data, slot),
        "--editbox-display", client.x11.DISPLAY ?? "", "--x11-window", client.window, "--pid", String(pid), "--private-wlr-app-id", appId, "--trace",
      ], { ...Bun.env, ...client.x11, ...client.wayland }, join(out, `helper-${slot}.log`));
    }
    const log = (slot: number) => readFileSync(join(out, `helper-${slot}.log`), "utf8");
    const logs = (): [string, string] => [log(SLOTS[0]), log(SLOTS[1])];
    if (chat !== undefined) {
      yield* Effect.sleep("1 second");
      yield* keys(clients[0], "Return").pipe(Effect.andThen(typeText(clients[0], chat, 35)), Effect.andThen(keys(clients[0], "Return")), Effect.mapError(fromDesktop));
    }
    // Both helpers' match start, written after this run began.
    const deadline = Date.now() + 60_000;
    let epochs: readonly number[] = [];
    while (epochs.length < 2) {
      const starts = logs().map(matchStart);
      if (starts.every((start) => start !== undefined && start.epochNs > startedNs)) epochs = starts.map((start) => start?.epochNs ?? 0);
      else if (Date.now() > deadline) return yield* new IntegrityFailure({ operation: "wait for match start", path: out, cause: "a helper reported no match start within 60 s" });
      else yield* Effect.sleep("20 millis");
    }
    const producerPath = join(out, "producer.jsonl");
    const producer = yield* Effect.acquireRelease(tryIntegrity("open producer log", producerPath, () => openSync(producerPath, "w")), (fd) => Effect.sync(() => closeSync(fd)));
    const sent: SentEdge[] = [];
    for (const item of steps) {
      yield* until(frameMiddleNs(at(epochs, item.slot), item.frame));
      if (item.kind === "capture") {
        const client = clients[item.slot];
        yield* Effect.forkScoped(capture(client).pipe(
          Effect.flatMap((frame) => tryIntegrity("save frame", out, () => writeFileSync(join(out, `frame-${item.frame}-${client.name}.ppm`), encodePpm(frame)))),
          Effect.catch((failure) => Effect.sync(() => console.error(`capture at frame ${item.frame}: ${failure.message}`))),
        ));
        continue;
      }
      for (const edge of item.edges) {
        const injection = inject(at(pads, item.slot), edge);
        writeSync(producer, producerLine(`line-${item.line}`, item.slot, edge, injection));
        sent.push({ line: item.line, text: item.text, slot: item.slot, planned: item.frame, injectedNs: injection.injectedNs });
      }
    }
    const last = steps.at(-1)?.frame ?? 0;
    yield* until(frameMiddleNs(Math.max(...epochs), last + 30));
    const final = logs();
    const results = landEdges(sent, final).map((edge) => ({
      ...edge,
      // Stick and trigger edges have no event line; the helper's frame rule places them.
      frame: edge.landed ?? ruleFrame(at(epochs, edge.slot), edge.injectedNs),
      confirmedBy: edge.landed === undefined ? "frame rule" : "helper event",
      // The frame the write itself fell in: a late write is the producer's slip, not the helper's.
      written: ruleFrame(at(epochs, edge.slot), edge.injectedNs),
    }));
    const stopped = final.flatMap((log, slot) => (/late kernel event|journal stopped/.test(log) ? [`helper ${slot}: ${/^wc3-journal: .*$/m.exec(log)?.[0] ?? "stopped"}`] : []));
    const off = results.filter((edge) => edge.frame !== edge.planned);
    const lateWrites = off.filter((edge) => edge.written !== edge.planned).length;
    writeFileSync(join(out, "result.json"), json({ script: scriptPath, epochs_ns: epochs, edges: results, off_frame: off.length, written_late: lateWrites, helpers_stopped: stopped }));
    for (const edge of results) console.log(`line ${edge.line} ${edge.slot === 0 ? "a" : "b"} planned ${edge.planned} written ${edge.written} landed ${edge.frame} (${edge.confirmedBy}): ${edge.text}`);
    console.log(`${results.length} edges, ${off.length} off their frame (${lateWrites} of them written late)${stopped.length > 0 ? `; ${stopped.join("; ")}` : ""}; ${join(out, "result.json")}`);
    if (off.length > 0 || stopped.length > 0) return yield* new IntegrityFailure({ operation: "replay pad script", path: out, cause: `${off.length} edges off their frame, ${stopped.length} helpers stopped` });
  }));
  return yield* onHealthyClients(run.pipe(step("pad script")), { retry: false });
});
