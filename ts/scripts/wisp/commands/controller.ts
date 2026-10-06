// `bun wisp controller`: Tom's Xbox controller for any Smashcraft session on
// his desktop. Points the always-on controller service at main's helper,
// building it on first use, and restarts the login unit when it changed;
// without the unit, runs the service here until Ctrl-C
// (smashcraft:companion/README.md, "Always-on controller service").
import { Effect } from "effect";
import type { Command } from "wisp/scripts/wisp/command";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { CONTROLLER_LAUNCHER, CONTROLLER_STATUS, CONTROLLER_UNIT, ensureService, pointLauncher, unitInstalled } from "../controllerService";
import { currentHelper } from "../currentPlaytest";

export const controller: Command = () => Effect.gen(function*() {
  const helper = yield* currentHelper;
  if (unitInstalled()) {
    const runs = yield* ensureService(helper);
    console.log(`Controller service: ${runs}, helper ${helper}. Its state: ${CONTROLLER_STATUS}`);
    return;
  }
  pointLauncher(helper);
  console.log(`No ${CONTROLLER_UNIT} installed; running the controller service here until Ctrl-C.`);
  const child = Bun.spawn([CONTROLLER_LAUNCHER, "--service"], { stdio: ["inherit", "inherit", "inherit"] });
  const code = yield* Effect.promise(() => child.exited);
  if (code !== 0) return yield* new PlayProblem({ problem: `the controller service stopped (exit ${code})` });
});
