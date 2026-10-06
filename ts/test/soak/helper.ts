// The soak through the real input path (wisp:docs/soak.md, "Through a game's
// own input helper"): each match plays in two headless clients in real time.
// Each player's controller is a uinput pad that the soak's fuzzer drives at a
// rate real time allows, read by a persistent wc3-journal helper typing into
// its client's edit box (--text-out) and reading its client's CustomMapData,
// as `wisp parity headless` runs them (scripts/integrity/headless.ts). The
// soak's detectors watch every frame. Loaded only by `bun wisp soak
// --helper`, so the host type check never reads map code.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { RealtimeClients, type TypedInput, customMapData, typedFile } from "wisp/scripts/wisp/headlessInput";
import {
  FUZZ_POLICY, SOAK_LIMITS, type SoakController, type SoakEdge, type SoakMatch, SoakMonitor, type SoakResult, cpuMillis, describeMatch, fuzzedInputs,
  helperRecorder, planSoak, soakRepro,
} from "wisp/scripts/wisp/soak";
import { MEASURED_BATTLE_NET, syncDelivery } from "wisp/src/headless/syncChannel";
import { at } from "wisp/src/runtime/lookup";
import { PLAYABLE_BUILD } from "../../src/game/shell/currentBuild";
import { startHelper } from "../../scripts/integrity/capture";
import { IntegrityFailure, tryIntegrity } from "../../scripts/integrity/evidence";
import { type Pad, openPad } from "../../scripts/integrity/linux";
import { ABS_RZ, ABS_X, ABS_Y, ABS_Z, EV_ABS, EV_KEY, PAD_BUTTONS, type SourceEdge } from "../../scripts/integrity/linuxInput";
import project from "../../scripts/wisp/soak";
import { SMASHCRAFT_SCENE } from "../../scripts/wisp/playerView";
import { PREDICTED_HEADLESS } from "../../scripts/wisp/headless";
import { SOAK_ENTRY, beginMatch, matchView } from "./game";

/** The pad as the helper reads it: A, B, X, Y, LB, RB and Start, the left stick and both triggers. */
const PAD: SoakController = {
  buttons: ["a", "b", "x", "y", "lb", "rb", "start"],
  toggles: ["start"],
  axes: ["leftX", "leftY", "leftTrigger", "rightTrigger"],
  axisLimit: 32767,
  // Melee's 0.28 dead zone of a full-scale stick (companion/src/stick.rs).
  deadZone: 9175,
};
const AXES = [ABS_X, ABS_Y, ABS_Z, ABS_RZ] as const;

/** A pattern every second or so: the helper journals edges in real time, one at a time. */
const HELPER_FUZZ = { rate: 1 / 60, silence: 0, hitch: 1 / 3600 };

/** The pad's kernel event for a fuzzed edge; triggers rest at zero and press to the magnitude. */
const sourceEdge = (edge: SoakEdge): SourceEdge =>
  "button" in edge
    ? { type: EV_KEY, code: at(PAD_BUTTONS, edge.button), value: edge.down ? 1 : 0 }
    : { type: EV_ABS, code: at(AXES, edge.axis), value: edge.axis >= 2 ? Math.abs(edge.value) : edge.value };

interface HelperSoakOptions {
  /** The persistent controller helper binary, built with --text-out. */
  readonly helper: string;
  readonly out: string;
  readonly matches: number;
  readonly seed: number;
  /** Real-time seconds each match may run. */
  readonly seconds: number;
}

type PadReply = { readonly error: string } | { readonly injection: unknown };

/** Pad writes in scripts/integrity/padWorker.ts's thread, in order, each answered before the next. */
const padThread = Effect.acquireRelease(
  Effect.sync(() => {
    const worker = new Worker(join(import.meta.dir, "../../scripts/integrity/padWorker.ts"));
    const waiting: ((reply: PadReply) => void)[] = [];
    worker.onmessage = (event: MessageEvent<PadReply>) => waiting.shift()?.(event.data);
    const write = (pad: Pad, edge: SourceEdge) =>
      Effect.callback<void, IntegrityFailure>((resume) => {
        waiting.push((reply) => resume("error" in reply ? Effect.fail(new IntegrityFailure({ operation: "write pad edge", path: pad.device, cause: reply.error })) : Effect.void));
        worker.postMessage({ pad, edge });
      });
    return { worker, write };
  }),
  ({ worker }) => Effect.sync(() => worker.terminate()),
);

const SLOTS = [0, 1] as const;

/** One match: pads, helpers and clients made for it and gone after it. */
const playMatch = (runtime: ReturnType<typeof installHeadless>, match: SoakMatch, options: HelperSoakOptions) =>
  Effect.scoped(Effect.gen(function*() {
    const out = join(options.out, `match-${match.index}`);
    const data = SLOTS.map((slot) => join(out, `client-${slot}`, "CustomMapData"));
    yield* tryIntegrity("create match directory", out, () => mkdirSync(out, { recursive: true }));
    let monitor: SoakMonitor | undefined;
    // What the helpers type and write, by the frame it reaches the clients: what a replay plays.
    const recorder = helperRecorder(() => (monitor === undefined ? 0 : monitor.frame + 1));
    const typed = new Map<number, TypedInput>();
    const pads: Pad[] = [];
    for (const slot of SLOTS) {
      const textPath = join(out, `typed-${slot}.txt`);
      typed.set(slot, recorder.input(slot, yield* Effect.acquireRelease(tryIntegrity("open typed text", textPath, () => typedFile(textPath)), (input) => Effect.sync(input.close))));
      const pad = yield* openPad(PAD_BUTTONS);
      pads.push(pad);
      yield* startHelper([
        options.helper, "--follow-matches", "--build", PLAYABLE_BUILD.id, "--slot", String(slot), "--device", pad.device, "--out", at(data, slot), "--text-out", textPath,
      ], Bun.env, join(out, `helper-${slot}.log`));
    }
    const writes = yield* padThread;
    const clients = runtime.clients(SOAK_ENTRY, SLOTS, {
      files: (slot) => recorder.files(slot, customMapData(at(data, slot))),
      delivery: syncDelivery(MEASURED_BATTLE_NET, match.seed),
      keepCalls: 64,
      cost: cpuMillis,
    });
    const watching = new SoakMonitor(clients, { input: () => undefined, ...matchView(() => undefined) }, SOAK_LIMITS, SMASHCRAFT_SCENE, PREDICTED_HEADLESS.filePrefix);
    let began = 0;
    const noQuiet: ReadonlySet<number> = new Set();
    const realtime = new RealtimeClients(clients, typed, undefined, () => watching.afterFrame(performance.now() - began, noQuiet));
    yield* tryIntegrity("start headless clients", out, () => realtime.start());
    // Menus take the clients' own frames; the helpers follow them through the files the map writes.
    yield* tryIntegrity("begin the match", out, () => beginMatch(clients, match, () => clients.frames(1)));
    monitor = watching;
    began = performance.now();
    const source = fuzzedInputs(match, PAD, HELPER_FUZZ);
    const deadline = began + options.seconds * 1000;
    let injected = 0;
    while (!watching.done && watching.frame < match.frames && performance.now() < deadline) {
      const wait = yield* tryIntegrity("run headless clients", out, () => realtime.advance());
      for (; injected < watching.frame; injected++) {
        const step = source.frame(injected + 1);
        for (const [slot, edges] of step.edges) for (const edge of edges) yield* writes.write(at(pads, slot), sourceEdge(edge));
        if (step.hitchMs > 0) {
          // A lag spike: the game stops, the helpers' clocks don't.
          realtime.hold(0);
          yield* Effect.sleep(step.hitchMs);
          realtime.release(0);
        }
      }
      yield* Effect.sleep(Math.max(0, wait));
    }
    const findings = watching.finish();
    const result: SoakResult = {
      match: { ...match, typed: true }, frames: watching.frame, wallMs: performance.now() - began, costMs: watching.costMs, worstFrameMs: watching.worstFrameMs,
      over: watching.over, findings, inputs: recorder.recorded(source.recorded()), checksums: clients.clients.map((client) => client.checksum()),
    };
    // The pads' edges stay as evidence; `bun wisp soak --repro` plays what the helpers typed, without them.
    yield* tryIntegrity("write repro", out, () => writeFileSync(join(out, "match.json"), `${JSON.stringify(soakRepro(project.name, result))}\n`));
    return result;
  }));

/** Every match in turn; prints each finding with its folder and returns how many matches found something. */
export default (options: HelperSoakOptions) =>
  Effect.gen(function*() {
    const runtime = yield* Effect.acquireRelease(Effect.sync(() => installHeadless(PREDICTED_HEADLESS)), (installed) => Effect.sync(installed.restore));
    const plan = planSoak(project.roster, options.matches, options.seed, project.frames, ({ policies }) => policies.every((policy) => policy === FUZZ_POLICY || policy === "cpu"));
    let found = 0;
    for (const match of plan) {
      const result = yield* playMatch(runtime, match, options);
      const lines = result.findings.map(({ kind, frame, text }) => `  ${kind} after frame ${frame}: ${text}`);
      if (lines.length > 0) found++;
      yield* Effect.sync(() => console.log([`${describeMatch(match)}: ${result.frames} frames in ${(result.wallMs / 1000).toFixed(1)} s through the helpers`, ...lines].join("\n")));
    }
    return found;
  }).pipe(Effect.scoped);
