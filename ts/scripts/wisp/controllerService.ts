// The always-on controller service (smashcraft:companion/README.md, "Always-on
// controller service"): `wc3-journal --service` finds Warcraft III on :0, the
// pad and the map's session by itself. The systemd user unit
// smashcraft-controller.service (nixos-config) starts it at login through the
// launcher link below; `bun wisp controller` and `play` point that link at
// main's helper and restart the service when it changes.
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Clock, Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";

export const CONTROLLER_LAUNCHER = join(homedir(), ".local/share/smashcraft-build-inputs/controller/wc3-journal");
export const CONTROLLER_UNIT = "smashcraft-controller.service";
export const CONTROLLER_STATUS = join(homedir(), ".local/state/smashcraft/controller-service.txt");
export const CONTROLLER_LOG = join(homedir(), ".local/state/smashcraft/controller-service.log");

/** The service's status file: one `key=value` per line. */
export type ServiceStatus = Readonly<Record<string, string>>;

export function parseStatus(text: string): ServiceStatus {
  return Object.fromEntries(text.split("\n").flatMap((line) => {
    const at = line.indexOf("=");
    return at <= 0 ? [] : [[line.slice(0, at), line.slice(at + 1)]];
  }));
}

/** Whether the service's helper is ready for this game's Smashcraft session of `build`. */
export function servesGame(status: ServiceStatus, pid: number, build: string): boolean {
  return status.state === "serving" && status.game_pid === String(pid) && (status.session ?? "").startsWith(`${build}/`);
}

export function readStatus(path = CONTROLLER_STATUS): ServiceStatus {
  try {
    return parseStatus(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

/** Points the launcher at `helper`; true when it changed. */
export function pointLauncher(helper: string, launcher = CONTROLLER_LAUNCHER): boolean {
  try {
    if (readlinkSync(launcher) === helper) return false;
  } catch {
    // No launcher yet.
  }
  mkdirSync(dirname(launcher), { recursive: true });
  // A link of this process's own: two plays pointing the launcher at once never share one.
  const next = `${launcher}.${process.pid}.next`;
  rmSync(next, { force: true });
  symlinkSync(helper, next);
  renameSync(next, launcher);
  return true;
}

const systemctl = (...args: string[]) => Bun.spawnSync(["systemctl", "--user", ...args], { stdout: "ignore", stderr: "pipe" });
export const unitInstalled = () => systemctl("cat", CONTROLLER_UNIT).exitCode === 0;

const alive = (pid: string | undefined) => pid !== undefined && /^\d+$/.test(pid) && existsSync(`/proc/${pid}`);

const fail = (problem: string) => new PlayProblem({ problem });

/** Starts or refreshes the service on `helper`; says how it runs. */
export const ensureService = (helper: string) => Effect.gen(function*() {
  const changed = pointLauncher(helper);
  if (unitInstalled()) {
    if (changed || systemctl("is-active", "--quiet", CONTROLLER_UNIT).exitCode !== 0) {
      const restart = systemctl("restart", CONTROLLER_UNIT);
      if (restart.exitCode !== 0) return yield* fail(`couldn't start ${CONTROLLER_UNIT}: ${restart.stderr.toString().trim()}`);
    }
    return `${CONTROLLER_UNIT} (journalctl --user -u ${CONTROLLER_UNIT})`;
  }
  // Before the login unit is installed: a service in its own session. Its
  // lock refuses a second copy; one on an older helper is replaced.
  const running = readStatus().service_pid;
  if (alive(running) && !changed) return `the controller service (pid ${running}), log ${CONTROLLER_LOG}`;
  if (alive(running)) {
    process.kill(Number(running), "SIGTERM");
    for (let waited = 0; alive(running) && waited < 40; waited++) yield* Effect.sleep("50 millis");
  }
  const pid = yield* Effect.tryPromise({
    try: () => new Promise<number>((resolve, reject) => {
      mkdirSync(dirname(CONTROLLER_LOG), { recursive: true });
      const output = openSync(CONTROLLER_LOG, "a");
      const child = spawn(CONTROLLER_LAUNCHER, ["--service"], { detached: true, stdio: ["ignore", output, output] });
      child.once("error", (error) => {
        closeSync(output);
        reject(error);
      });
      child.once("spawn", () => {
        closeSync(output);
        child.unref();
        if (child.pid === undefined) reject(new Error("the controller service has no process id"));
        else resolve(child.pid);
      });
    }),
    catch: (cause) => fail(`couldn't start the controller service: ${String(cause)}`),
  });
  return `the controller service (pid ${pid}), log ${CONTROLLER_LOG}`;
});

/** Seconds the service has to serve a game whose map shows its first screen. */
export const SERVE_SECONDS = 15;

/** Waits until the service serves this game's session of `build`; fails at once when it found the game but no controller. */
export const awaitService = (pid: number, build: string, runs: string, statusFile = CONTROLLER_STATUS) => Effect.gen(function*() {
  const deadline = (yield* Clock.currentTimeMillis) + SERVE_SECONDS * 1000;
  while (true) {
    const status = readStatus(statusFile);
    if (servesGame(status, pid, build)) return `ready for Warcraft III (pid ${pid}) through ${runs}`;
    if (status.state === "no-controller" && status.game_pid === String(pid)) return yield* fail("no controller is plugged in");
    if ((yield* Clock.currentTimeMillis) >= deadline) {
      const why = status.problem === undefined ? `its state is ${status.state ?? "unknown"}` : status.problem;
      return yield* fail(`the controller service didn't take this game within ${SERVE_SECONDS} s: ${why} (${statusFile})`);
    }
    yield* Effect.sleep("250 millis");
  }
});

/**
 * The controller is optional: the keyboard always plays. Starts or refreshes
 * the service and says whether a controller serves this game; never fails.
 */
export const optionalController = (helper: string, pid: number, build: string, statusFile = CONTROLLER_STATUS) =>
  ensureService(helper).pipe(
    Effect.flatMap((runs) => awaitService(pid, build, runs, statusFile)),
    Effect.map((ready) => `controller ${ready}`),
    Effect.catchTag("PlayProblem", (problem) => Effect.succeed(`keyboard (no controller: ${problem.problem})`)),
  );
