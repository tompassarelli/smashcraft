// The Linux operations the capture needs beyond node:fs: libc's
// clock_gettime (Bun's hrtime counts from process start, not CLOCK_MONOTONIC)
// and ioctl, uinput pads, evdev observers and stopped-process checks.
import { dlopen, ptr, read } from "bun:ffi";
import { closeSync, constants, existsSync, openSync, readFileSync, readSync, readdirSync, writeSync } from "node:fs";
import { join } from "node:path";
import { Effect, Predicate } from "effect";
import { IntegrityFailure, kernelLine, tryIntegrity } from "./evidence";
import {
  CLOCK_MONOTONIC, CLOCK_REALTIME, EVIOCSCLOCKID, INPUT_EVENT_BYTES, type Injection, type SourceEdge, UI_DEV_CREATE, UI_DEV_DESTROY, UI_GET_SYSNAME,
  decodeEvents, edgePacket, padCapabilities, padSetup,
} from "./linuxInput";

const libc = dlopen("libc.so.6", {
  clock_gettime: { args: ["i32", "ptr"], returns: "i32" },
  ioctl: { args: ["i32", "u64", "u64"], returns: "i32" },
  __errno_location: { args: [], returns: "ptr" },
});

const timespec = new BigInt64Array(2);

function clock(id: number): bigint {
  if (libc.symbols.clock_gettime(id, timespec) !== 0) throw new Error(`clock_gettime(${id}) failed`);
  const [seconds, nanoseconds] = timespec;
  if (seconds === undefined || nanoseconds === undefined) throw new Error("clock_gettime returned an incomplete timespec");
  return seconds * 1_000_000_000n + nanoseconds;
}

/** CLOCK_MONOTONIC in nanoseconds; exact as a number for about 104 days of uptime. */
export const monotonicNs = (): number => Number(clock(CLOCK_MONOTONIC));
export const realtimeNs = (): bigint => clock(CLOCK_REALTIME);

function ioctl(fd: number, request: number, argument: number | Uint8Array | Int32Array): void {
  if (libc.symbols.ioctl(fd, request, typeof argument === "number" ? argument : ptr(argument)) >= 0) return;
  const errno = libc.symbols.__errno_location();
  throw new Error(`ioctl 0x${request.toString(16)} failed with errno ${errno === null ? "unknown" : read.i32(errno, 0)}`);
}

const UDEV_DATA = "/run/udev/data";
const TWIN_PROPERTY = "E:SMASHCRAFT_TEST_PAD_NODE=";

export interface Pad {
  readonly fd: number;
  /** The pad's evdev node: /dev/input/eventN, or its twin where udev hides that one. */
  readonly device: string;
}

/**
 * The evdev node a helper opens for a created uinput device, once udev has
 * finished with it. On Tom's machine a udev rule
 * (nixos-config:native/nix/smashcraft-test-pads.clause) keeps the
 * /dev/input node root-only, so Steam never sees a test pad, and names a twin
 * node only the helpers open.
 */
function padDevice(fd: number): string | undefined {
  const name = new Uint8Array(80);
  ioctl(fd, UI_GET_SYSNAME, name);
  const node = new TextDecoder().decode(name.subarray(0, name.indexOf(0)));
  const events = readdirSync(`/sys/devices/virtual/input/${node}`).filter((entry) => entry.startsWith("event"));
  if (events.length !== 1) throw new Error(`unexpected virtual device interfaces: ${events.join(", ")}`);
  const event = `/dev/input/${events[0]}`;
  if (!existsSync(UDEV_DATA)) return existsSync(event) ? event : undefined;
  const record = join(UDEV_DATA, `c${readFileSync(`/sys/class/input/${events[0]}/dev`, "utf8").trim()}`);
  if (!existsSync(record)) return undefined;
  const twin = readFileSync(record, "utf8").split("\n").find((line) => line.startsWith(TWIN_PROPERTY))?.slice(TWIN_PROPERTY.length);
  const device = twin ?? event;
  return existsSync(device) ? device : undefined;
}

/** A virtual Xbox 360 pad with these buttons and both sticks and triggers, removed with its scope. */
export const openPad = (buttons: readonly number[]) =>
  Effect.gen(function*() {
    const fd = yield* Effect.acquireRelease(
      tryIntegrity("create virtual pad", "/dev/uinput", () => {
        const fd = openSync("/dev/uinput", constants.O_WRONLY | constants.O_NONBLOCK);
        try {
          for (const [request, argument] of padCapabilities(buttons)) ioctl(fd, request, argument);
          const setup = padSetup();
          if (writeSync(fd, setup) !== setup.length) throw new Error("short uinput setup write");
          ioctl(fd, UI_DEV_CREATE, 0);
          return fd;
        } catch (error) {
          closeSync(fd);
          throw error;
        }
      }),
      (fd) => Effect.sync(() => {
        try {
          ioctl(fd, UI_DEV_DESTROY, 0);
        } catch (error) {
          console.error(`virtual pad removal: ${String(error)}`);
        } finally {
          closeSync(fd);
        }
      }),
    );
    // udev creates the event node after UI_DEV_CREATE returns.
    for (let waitedMs = 0; ; waitedMs += 25) {
      yield* Effect.sleep("25 millis");
      const device = yield* tryIntegrity("find virtual pad device", "/dev/uinput", () => padDevice(fd));
      if (device !== undefined) return { fd, device } satisfies Pad;
      if (waitedMs >= 3000) return yield* new IntegrityFailure({ operation: "find virtual pad device", path: "/dev/uinput", cause: "udev did not publish the pad's node within 3 s" });
    }
  });

/** Publishes an edge and its SYN_REPORT in one write, stamped before the write. */
export function inject(pad: Pad, edge: SourceEdge): Injection {
  const beforeNs = monotonicNs();
  const injectedNs = beforeNs - (beforeNs % 1000);
  const packet = edgePacket(injectedNs, edge);
  const written = writeSync(pad.fd, packet);
  const afterNs = monotonicNs();
  if (written !== packet.length) throw new Error(`short uinput write (${written}/${packet.length})`);
  return { injectedNs, beforeNs, afterNs };
}

export interface Observer {
  /** Set when reading the device failed; the capture stops at its next check. */
  readonly failure: () => IntegrityFailure | undefined;
}

/**
 * Logs every event the kernel reports for `device` as JSON lines, read-only
 * and on the producer's CLOCK_MONOTONIC, until its scope closes.
 */
export const observeDevice = (device: string, logPath: string) =>
  Effect.gen(function*() {
    const fd = yield* Effect.acquireRelease(
      tryIntegrity("open pad events", device, () => {
        const fd = openSync(device, constants.O_RDONLY | constants.O_NONBLOCK);
        try {
          ioctl(fd, EVIOCSCLOCKID, new Int32Array([CLOCK_MONOTONIC]));
          return fd;
        } catch (error) {
          closeSync(fd);
          throw error;
        }
      }),
      (fd) => Effect.sync(() => closeSync(fd)),
    );
    const log = yield* Effect.acquireRelease(tryIntegrity("open kernel log", logPath, () => openSync(logPath, "w")), (log) => Effect.sync(() => closeSync(log)));
    const buffer = new Uint8Array(INPUT_EVENT_BYTES * 128);
    const drain = tryIntegrity("read pad events", device, () => {
      for (;;) {
        let bytes: number;
        try {
          bytes = readSync(fd, buffer, 0, buffer.length, null);
        } catch (error) {
          if (Predicate.isObject(error) && error.code === "EAGAIN") return;
          throw error;
        }
        if (bytes <= 0) return;
        writeSync(log, decodeEvents(buffer.subarray(0, bytes)).map(kernelLine).join(""));
      }
    });
    let failure: IntegrityFailure | undefined;
    // Runs after the reader stops and before the log closes: nothing written is left unread.
    yield* Effect.addFinalizer(() => drain.pipe(Effect.ignore));
    yield* Effect.forkScoped(Effect.forever(drain.pipe(Effect.andThen(Effect.sleep("5 millis")))).pipe(
      Effect.catch((error) => Effect.sync(() => {
        failure = error;
      })),
    ));
    return { failure: () => failure } satisfies Observer;
  });

/** The process state letter from /proc/PID/stat, or undefined once it has exited. */
function processState(pid: number): string | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[0];
  } catch {
    return undefined;
  }
}

/** Sends SIGSTOP and waits up to 2 s for the kernel to report the process stopped; continues it again on failure. */
export const stopProcess = (pid: number) =>
  Effect.gen(function*() {
    yield* tryIntegrity("stop process", String(pid), () => process.kill(pid, "SIGSTOP"));
    const deadline = performance.now() + 2000;
    for (;;) {
      const state = processState(pid);
      if (state === "T" || state === "t") return;
      if (state === undefined) return yield* new IntegrityFailure({ operation: "stop process", path: String(pid), cause: "process exited" });
      if (performance.now() > deadline) return yield* new IntegrityFailure({ operation: "stop process", path: String(pid), cause: `state ${state}, not stopped` });
      yield* Effect.sleep("5 millis");
    }
  }).pipe(Effect.onError(() => continueProcess(pid)));

export const continueProcess = (pid: number) =>
  Effect.sync(() => {
    try {
      process.kill(pid, "SIGCONT");
    } catch {
      // Already exited.
    }
  });
