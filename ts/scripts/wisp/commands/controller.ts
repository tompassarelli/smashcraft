




import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import type { Command } from "wisp/scripts/wisp/command";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { CONTROLLER_STATUS, CONTROLLER_UNIT, SERVICE_ARGS, SERVICE_LAUNCHER, ensureService, pointLaunchers, unitInstalled } from "../controllerService";
import { LAYOUTS, setControllerLayout } from "../controllerLayout";
import { currentHelper } from "../currentPlaytest";

export const controller: Command = (args) => Effect.gen(function*() {
  if (args.length > 0) {
    const [verb, name] = args;
    const layout = LAYOUTS.find((known) => known === name);
    if (verb !== "layout" || args.length !== 2 || layout === undefined) return yield* new PlayProblem({ problem: `use controller layout ${LAYOUTS.join("|")}` });
    const result = yield* setControllerLayout(layout);
    console.log(`Controller layout: ${layout} (${result === "live" ? "changed live" : "saved for next start"}).`);
    return;
  }
  const helper = yield* currentHelper;
  if (yield* unitInstalled) {
    const runs = yield* ensureService(helper);
    console.log(`Controller service: ${runs}. Its state: ${CONTROLLER_STATUS}`);
    return;
  }
  pointLaunchers(helper);
  console.log(`No ${CONTROLLER_UNIT} installed; running the controller service here until Ctrl-C.`);

  const code = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* ChildProcess.make(SERVICE_LAUNCHER, SERVICE_ARGS, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    return yield* child.exitCode;
  })).pipe(
    Effect.provide(BunServices.layer),
    Effect.catchTag("PlatformError", (cause) => Effect.fail(new PlayProblem({ problem: `couldn't run the controller service: ${cause.message}` }))),
  );
  if (code !== 0) return yield* new PlayProblem({ problem: `the controller service stopped (exit ${code})` });
});
