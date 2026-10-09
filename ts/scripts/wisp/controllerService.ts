





import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { pollUntil } from "../hostPoll";

export const CONTROLLER_LAUNCHER = join(homedir(), ".local/share/smashcraft-build-inputs/controller/wc3-journal");
export const CONTROLLER_UNIT = "smashcraft-controller.service";
export const CONTROLLER_STATUS = join(homedir(), ".local/state/smashcraft/controller-service.txt");
export const CONTROLLER_LOG = join(homedir(), ".local/state/smashcraft/controller-service.log");


export type ServiceStatus = Readonly<Record<string, string>>;

export function parseStatus(text: string): ServiceStatus {
  return Object.fromEntries(text.split("\n").flatMap((line) => {
    const at = line.indexOf("=");
    return at <= 0 ? [] : [[line.slice(0, at), line.slice(at + 1)]];
  }));
}


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


export function pointLauncher(helper: string, launcher = CONTROLLER_LAUNCHER): boolean {
  try {
    if (readlinkSync(launcher) === helper) return false;
  } catch {

  }
  mkdirSync(dirname(launcher), { recursive: true });

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


export const ensureService = (helper: string) => Effect.gen(function*() {
  const changed = pointLauncher(helper);
  if (unitInstalled()) {
    if (changed || systemctl("is-active", "--quiet", CONTROLLER_UNIT).exitCode !== 0) {
      const restart = systemctl("restart", CONTROLLER_UNIT);
      if (restart.exitCode !== 0) return yield* fail(`couldn't start ${CONTROLLER_UNIT}: ${restart.stderr.toString().trim()}`);
    }
    return `${CONTROLLER_UNIT} (journalctl --user -u ${CONTROLLER_UNIT})`;
  }


  const running = readStatus().service_pid;
  if (alive(running) && !changed) return `the controller service (pid ${running}), log ${CONTROLLER_LOG}`;
  if (alive(running)) {
    process.kill(Number(running), "SIGTERM");

    yield* pollUntil(Effect.sync(() => alive(running) ? undefined : true), {
      every: "50 millis",
      within: "2 seconds",
      orElse: () => Effect.fail(fail(`the old controller service (pid ${running}) was still running 2 s after SIGTERM`)),
    });
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


export const SERVE_SECONDS = 15;


export const awaitService = (pid: number, build: string, runs: string, statusFile = CONTROLLER_STATUS) =>
  pollUntil(
    Effect.gen(function*() {
      const status = readStatus(statusFile);
      if (servesGame(status, pid, build)) return `ready for Warcraft III (pid ${pid}) through ${runs}`;
      if (status.state === "no-controller" && status.game_pid === String(pid)) return yield* fail("no controller is plugged in");
      return undefined;
    }),
    {
      every: "250 millis",
      within: `${SERVE_SECONDS} seconds`,
      orElse: () => Effect.suspend(() => {
        const status = readStatus(statusFile);
        const why = status.problem === undefined ? `its state is ${status.state ?? "unknown"}` : status.problem;
        return Effect.fail(fail(`the controller service didn't take this game within ${SERVE_SECONDS} s: ${why} (${statusFile})`));
      }),
    },
  );





export const optionalController = (helper: string, pid: number, build: string, statusFile = CONTROLLER_STATUS) =>
  ensureService(helper).pipe(
    Effect.flatMap((runs) => awaitService(pid, build, runs, statusFile)),
    Effect.map((ready) => `controller ${ready}`),
    Effect.catchTag("PlayProblem", (problem) => Effect.succeed(`keyboard (no controller: ${problem.problem})`)),
  );
