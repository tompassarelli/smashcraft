




import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import type { Command } from "wisp/scripts/wisp/command";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { CONTROLLER_LAUNCHER, CONTROLLER_STATUS, CONTROLLER_UNIT, ensureService, pointLauncher, unitInstalled } from "../controllerService";
import { setControllerLayout } from "../controllerLayout";
import { currentHelper } from "../currentPlaytest";

export const controller: Command = (args) => Effect.gen(function*() {
  if (args.length > 0) {
    const [verb, name] = args;
    if (verb !== "layout" || args.length !== 2 || (name !== "standard" && name !== "zjump")) return yield* new PlayProblem({ problem: "use controller layout standard|zjump" });
    const result = yield* setControllerLayout(name === "zjump" ? "z-jump" : "standard");
    console.log(`Controller layout: ${name === "zjump" ? "Z-jump" : "Standard"} (${result === "live" ? "changed live" : "saved for next start"}).`);
    return;
  }
  const helper = yield* currentHelper;
  if (unitInstalled()) {
    const runs = yield* ensureService(helper);
    console.log(`Controller service: ${runs}, helper ${helper}. Its state: ${CONTROLLER_STATUS}`);
    return;
  }
  pointLauncher(helper);
  console.log(`No ${CONTROLLER_UNIT} installed; running the controller service here until Ctrl-C.`);

  const code = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* ChildProcess.make(CONTROLLER_LAUNCHER, ["--service"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    return yield* child.exitCode;
  })).pipe(
    Effect.provide(BunServices.layer),
    Effect.catchTag("PlatformError", (cause) => Effect.fail(new PlayProblem({ problem: `couldn't run the controller service: ${cause.message}` }))),
  );
  if (code !== 0) return yield* new PlayProblem({ problem: `the controller service stopped (exit ${code})` });
});
