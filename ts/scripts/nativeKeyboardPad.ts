// A pad's physical 60 Hz deadlines through the existing SDL keyboard helper.
// This measures playable pixels; journal parity stays in `bun wisp pad`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { loadClients } from "wisp/scripts/warcraft/desktop";
import { gameProcess } from "./integrity/capture";
import { monotonicNs } from "./integrity/linux";
import { ABS_X, ABS_Y, BTN_START, BTN_SELECT, EV_ABS, EV_KEY } from "./integrity/linuxInput";
import { frameWriteNs, parsePadScript, ruleFrame } from "./integrity/padScript";

export function keyboardPadPlan(script: string) {
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

async function run(args: readonly string[]) {
  const { values } = parseArgs({ args: [...args], strict: true, options: {
    script: { type: "string" }, helper: { type: "string" }, out: { type: "string" },
    "clients-file": { type: "string" }, client: { type: "string" }, "app-id": { type: "string" },
    "frame-one-ns": { type: "string" }, observe: { type: "boolean" },
  } });
  if (values.script === undefined || values.helper === undefined || values.out === undefined) throw Error("requires --script FILE --helper wc3-controller --out DIR");
  const plan = keyboardPadPlan(await Bun.file(values.script).text());
  if (plan.length === 0) throw Error("empty pad script");
  const helperArgs = [values.helper, "--virtual-pad", "--watch-seconds", "20", "--preset", "standard", "--tap-jump", "off"];
  let environment: Record<string, string | undefined> = { ...Bun.env, SDL_VIDEODRIVER: "dummy" };
  if (!values.observe) {
    if (values["clients-file"] === undefined || values.client === undefined || values["app-id"] === undefined) throw Error("live timing requires --clients-file FILE --client NAME --app-id ID");
    const clients = await Effect.runPromise(loadClients(values["clients-file"]));
    const client = clients.find(c => c.name === values.client);
    if (client === undefined || /^:0(?:\.0)?$/.test(client.x11.DISPLAY ?? "")) throw Error("select an owned private client");
    const pid = await Effect.runPromise(gameProcess(client, false));
    helperArgs.push("--emit", "--pad-ingress", "keys", "--display", client.x11.DISPLAY ?? "", "--x11-window", String(Number(client.window)), "--pid", String(pid), "--private-wlr-app-id", values["app-id"]);
    environment = { ...Bun.env, ...client.x11, ...client.wayland };
  }
  mkdirSync(values.out, { recursive: true });
  const helper = Bun.spawn(helperArgs, { env: environment, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  const stdout = new Response(helper.stdout).text(), stderr = new Response(helper.stderr).text();
  const frameOne = values["frame-one-ns"] === undefined ? monotonicNs() + 1_000_000_000 : Number(values["frame-one-ns"]);
  if (!Number.isSafeInteger(frameOne) || frameOne <= monotonicNs()) { helper.kill(); throw Error("--frame-one-ns must be a future CLOCK_MONOTONIC timestamp"); }
  const sent = [];
  let failure: unknown;
  try {
    for (const item of plan) {
      const targetNs = frameWriteNs(frameOne, item.frame);
      const coarse = (targetNs - monotonicNs()) / 1e6 - 5;
      if (coarse > 0) await Bun.sleep(coarse);
      while (monotonicNs() < targetNs) { /* same final 5 ms as the pad scheduler */ }
      if (helper.exitCode !== null) throw Error("keyboard helper exited during stimulus");
      const beforeNs = monotonicNs();
      helper.stdin.write(item.command + "\n");
      await helper.stdin.flush();
      const afterNs = monotonicNs();
      sent.push({ ...item, targetNs, beforeNs, afterNs, writtenFrame: ruleFrame(frameOne, beforeNs) });
    }
    // Keep the helper alive through the two seconds after Start resumes at 348.
    const end = frameWriteNs(frameOne, Math.max(...plan.map(item => item.frame)) + 20);
    const leftMs = (end - monotonicNs()) / 1e6;
    if (leftMs > 0) await Bun.sleep(leftMs);
  } catch (error) { failure = error; }
  finally {
    try { helper.stdin.write("quit\n"); await helper.stdin.flush(); helper.stdin.end(); }
    catch (error) { failure ??= error; }
  }
  const exit = await helper.exited;
  const output = await stdout, errors = await stderr;
  writeFileSync(join(values.out, "keyboard-helper.log"), output + errors);
  const late = sent.filter(item => item.writtenFrame !== item.frame).length;
  writeFileSync(join(values.out, "keyboard-stimulus.json"), JSON.stringify({
    kind: "playable-keyboard-drawn-timing", script: values.script, frame_one_ns: frameOne,
    clock: "CLOCK_MONOTONIC; physical 60 Hz half-open frames, not journal or native simulation frames",
    observe: values.observe ?? false, edges: sent, written_late: late, helper_exit: exit,
    view: "View edges reach SDL Back unchanged; playable keyboard has no View binding. Export probe with Ctrl+H only after capture; original journal comparison remains separate.",
  }, null, 2) + "\n");
  if (failure !== undefined) throw failure;
  if (exit !== 0 || late !== 0 || !output.includes("# selected=")) throw Error(`keyboard stimulus invalid: exit=${exit}, late=${late}, SDL-ready=${output.includes("# selected=")}`);
  console.log(`${sent.length} unchanged pad edges; ${late} missed physical deadlines; ${values.out}`);
}

if (import.meta.main) await run(Bun.argv.slice(2));
