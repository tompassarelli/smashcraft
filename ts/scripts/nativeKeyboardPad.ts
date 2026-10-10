

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { BunRuntime } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { loadClients } from "wisp/scripts/warcraft/desktop";
import { gameProcess } from "./integrity/capture";
import { monotonicNs } from "./integrity/linux";
import { ABS_X, ABS_Y, BTN_START, BTN_SELECT, EV_ABS, EV_KEY } from "./integrity/linuxInput";
import { frameWriteNs, padScriptPreset, parsePadScript, ruleFrame } from "./integrity/padScript";
import { platformLayer } from "wisp/scripts/platform/layer";

function keyboardPadPlan(script: string) {
  return parsePadScript(script).flatMap(step => {
    if (step.kind !== "edge" || step.slot !== 0) throw Error("keyboard timing requires input edges for pad a only");
    return step.edges.map(edge => {
      const control = edge.type === EV_ABS ? edge.code === ABS_X ? "axis leftx" : edge.code === ABS_Y ? "axis lefty" : undefined
        : edge.type === EV_KEY ? edge.code === BTN_START ? "button start" : edge.code === BTN_SELECT ? "button back" : undefined : undefined;
      if (control === undefined) throw Error(`unsupported keyboard timing control on line ${step.line}`);
      return { frame: step.frame, line: step.line, edge, command: `${control} ${edge.value}` };
    });
  });
}


class KeyboardPadFailure extends Schema.TaggedError<KeyboardPadFailure>()("KeyboardPadFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const failure = (cause: unknown) => cause instanceof KeyboardPadFailure ? cause
  : new KeyboardPadFailure({ problem: cause instanceof Error ? cause.message : String(cause) });

type Helper = Bun.Subprocess<"pipe", "pipe", "pipe">;


const startHelper = (helperArgs: readonly string[], environment: Record<string, string | undefined>) => Effect.acquireRelease(
  Effect.try({ try: (): Helper => Bun.spawn([...helperArgs], { env: environment, stdin: "pipe", stdout: "pipe", stderr: "pipe" }), catch: failure }),
  (helper) => helper.exitCode !== null ? Effect.void : Effect.promise(async () => {
    helper.kill("SIGKILL");
    await helper.exited;
  }),
);

const run = (args: readonly string[]) => Effect.gen(function*() {
  const { values } = yield* Effect.try({ try: () => parseArgs({ args: [...args], strict: true, options: {
    script: { type: "string" }, helper: { type: "string" }, out: { type: "string" },
    "clients-file": { type: "string" }, client: { type: "string" }, "app-id": { type: "string" },
    "frame-one-ns": { type: "string" }, observe: { type: "boolean" },
  } }), catch: failure });
  if (values.script === undefined || values.helper === undefined || values.out === undefined) return yield* new KeyboardPadFailure({ problem: "requires --script FILE --helper wc3-controller --out DIR" });
  const scriptPath = values.script;
  const out = values.out;
  const plan = yield* Effect.tryPromise({ try: async () => keyboardPadPlan(await Bun.file(scriptPath).text()), catch: failure });
  if (plan.length === 0) return yield* new KeyboardPadFailure({ problem: "empty pad script" });
  const helperArgs = [values.helper, "--virtual-pad", "--watch-seconds", "20", ...padScriptPreset(), "--tap-jump", "off"];
  let environment: Record<string, string | undefined> = { ...Bun.env, SDL_VIDEODRIVER: "dummy" };
  if (!values.observe) {
    if (values["clients-file"] === undefined || values.client === undefined || values["app-id"] === undefined) return yield* new KeyboardPadFailure({ problem: "live timing requires --clients-file FILE --client NAME --app-id ID" });
    const clients = yield* loadClients(values["clients-file"]);
    const client = clients.find(c => c.name === values.client);
    if (client === undefined || /^:0(?:\.0)?$/.test(client.x11.DISPLAY ?? "")) return yield* new KeyboardPadFailure({ problem: "select an owned private client" });
    const pid = yield* gameProcess(client, false);
    helperArgs.push("--emit", "--pad-ingress", "keys", "--display", client.x11.DISPLAY ?? "", "--x11-window", String(Number(client.window)), "--pid", String(pid), "--private-wlr-app-id", values["app-id"]);
    environment = { ...Bun.env, ...client.x11, ...client.wayland };
  }
  yield* Effect.try({ try: () => mkdirSync(out, { recursive: true }), catch: failure });
  const helper = yield* startHelper(helperArgs, environment);
  const stdout = new Response(helper.stdout).text(), stderr = new Response(helper.stderr).text();
  const frameOne = values["frame-one-ns"] === undefined ? monotonicNs() + 1_000_000_000 : Number(values["frame-one-ns"]);
  if (!Number.isSafeInteger(frameOne) || frameOne <= monotonicNs()) return yield* new KeyboardPadFailure({ problem: "--frame-one-ns must be a future CLOCK_MONOTONIC timestamp" });
  const sent: (ReturnType<typeof keyboardPadPlan>[number] & { targetNs: number; beforeNs: number; afterNs: number; writtenFrame: number })[] = [];

  const stimulus = yield* Effect.promise(async () => {
    let problem: unknown;
    try {
      for (const item of plan) {
        const targetNs = frameWriteNs(frameOne, item.frame);
        const coarse = (targetNs - monotonicNs()) / 1e6 - 5;
        if (coarse > 0) await Bun.sleep(coarse);
        while (monotonicNs() < targetNs) {   }
        if (helper.exitCode !== null) throw Error("keyboard helper exited during stimulus");
        const beforeNs = monotonicNs();
        helper.stdin.write(item.command + "\n");
        await helper.stdin.flush();
        const afterNs = monotonicNs();
        sent.push({ ...item, targetNs, beforeNs, afterNs, writtenFrame: ruleFrame(frameOne, beforeNs) });
      }

      const end = frameWriteNs(frameOne, Math.max(...plan.map(item => item.frame)) + 20);
      const leftMs = (end - monotonicNs()) / 1e6;
      if (leftMs > 0) await Bun.sleep(leftMs);
    } catch (error) { problem = error; }
    try { helper.stdin.write("quit\n"); await helper.stdin.flush(); helper.stdin.end(); }
    catch (error) { problem ??= error; }
    return problem;
  });
  const exit = yield* Effect.promise(() => helper.exited);
  const output = yield* Effect.promise(() => stdout), errors = yield* Effect.promise(() => stderr);
  const late = sent.filter(item => item.writtenFrame !== item.frame).length;
  yield* Effect.try({ try: () => {
    writeFileSync(join(out, "keyboard-helper.log"), output + errors);
    writeFileSync(join(out, "keyboard-stimulus.json"), JSON.stringify({
      kind: "playable-keyboard-drawn-timing", script: scriptPath, frame_one_ns: frameOne,
      clock: "CLOCK_MONOTONIC; physical 60 Hz half-open frames, not journal or native simulation frames",
      observe: values.observe ?? false, edges: sent, written_late: late, helper_exit: exit,
      view: "View edges reach SDL Back unchanged; playable keyboard has no View binding. Export probe with Ctrl+H only after capture; original journal comparison remains separate.",
    }, null, 2) + "\n");
  }, catch: failure });
  if (stimulus !== undefined) return yield* failure(stimulus);
  if (exit !== 0 || late !== 0 || !output.includes("# selected=")) return yield* new KeyboardPadFailure({ problem: `keyboard stimulus invalid: exit=${exit}, late=${late}, SDL-ready=${output.includes("# selected=")}` });
  console.log(`${sent.length} unchanged pad edges; ${late} missed physical deadlines; ${out}`);
});


if (import.meta.main) BunRuntime.runMain(Effect.scoped(run(Bun.argv.slice(2))).pipe(Effect.provide(platformLayer())));
