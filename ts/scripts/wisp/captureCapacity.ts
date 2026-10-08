import { readFileSync } from "node:fs";
import { loadavg } from "node:os";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { capacityHelper } from "../heavyCapacity";
import { IntegrityFailure } from "../integrity/evidence";

const Lease = Schema.Struct({ id: Schema.String, class: Schema.String, owner: Schema.String, kind: Schema.String, expiresAt: Schema.NullOr(Schema.Number) });

/** Only the lease of this process's actual cgroup can be shared by capture lanes. */
export function captureLease() {
  const compact = /\/agent-capacity-([0-9a-f]{32})\.scope(?:\/|$)/m.exec(readFileSync("/proc/self/cgroup", "utf8"))?.[1];
  if (compact === undefined) return undefined;
  const id = `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  const root = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.()}`;
  const lease = Schema.decodeUnknownSync(Schema.fromJsonString(Lease))(readFileSync(join(root, "agent-capacity-v1/leases", `${id}.json`), "utf8"));
  return lease;
}

export const requireCaptureLease = Effect.try({
  try: () => {
    const lease = captureLease();
    if (lease === undefined || lease.class !== "exclusive" || lease.kind !== "run" || lease.expiresAt === null || lease.expiresAt <= Date.now()) throw new Error("Native capture needs an exclusive capacity lease before client input");
    return lease;
  },
  catch: (cause) => new IntegrityFailure({ operation: "quiet capture window", path: capacityHelper, cause }),
});

export const captureLoad = () => ({ load_average: loadavg(), capacity_lease: captureLease() });

/** Re-executes the complete pad command; the helper queues and owns its lifetime. */
export const admitCaptures = (args: readonly string[]) => Effect.scoped(Effect.gen(function*() {
  const lease = yield* Effect.try({ try: captureLease, catch: (cause) => new IntegrityFailure({ operation: "quiet capture window", path: capacityHelper, cause }) });
  if (lease !== undefined) {
    yield* requireCaptureLease;
    return false;
  }
  console.log("Waiting for an exclusive capture window before client input (up to 15 minutes per batch)");
  const child = yield* ChildProcess.make(process.execPath, [capacityHelper, "run", "--class", "exclusive", "--owner", "smashcraft:pad", "--timeout-seconds", "900", "--", process.execPath, join(import.meta.dir, "../wisp.ts"), "pad", ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const code = yield* child.exitCode;
  if (code !== 0) return yield* new IntegrityFailure({ operation: "quiet capture batch", path: capacityHelper, cause: `capture command exited ${code}` });
  return true;
})).pipe(Effect.provide(BunServices.layer), Effect.mapError((cause) => new IntegrityFailure({ operation: "quiet capture window", path: capacityHelper, cause })));
