// `bun wisp controller`: Tom's Xbox controller for any Smashcraft session on
// his desktop. Points the always-on controller service at main's helper,
// building it on first use, and restarts the login unit when it changed;
// without the unit, runs the service here until Ctrl-C
// (smashcraft:companion/README.md, "Always-on controller service").
import { Effect } from "effect";
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
  const child = Bun.spawn([CONTROLLER_LAUNCHER, "--service"], { stdio: ["inherit", "inherit", "inherit"] });
  const code = yield* Effect.promise(() => child.exited);
  if (code !== 0) return yield* new PlayProblem({ problem: `the controller service stopped (exit ${code})` });
});
