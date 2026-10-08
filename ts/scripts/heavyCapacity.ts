// Heavy local tools (cpuField, cpuTiers, lua-tests, the full logic suite)
// admit themselves through the machine-capacity helper, so parallel calls
// queue in the helper instead of all running at once (39 copies of cpuField
// under `xargs -P 20` once took this 24-core machine to load 122). A tool
// already inside a capacity scope, or on a host without the helper (CI), runs
// as it is.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";

export const capacityHelper = join(homedir(), "code/nixos-config/main/dotfiles/agents/skills/machine-capacity/scripts/machine-capacity.mjs");

/** The helper runs each admitted command in its own scope, `agent-capacity-LEASE.scope`. */
export function insideCapacityScope(): boolean {
  try {
    return /\/agent-capacity-[0-9a-z]+\.scope(\/|$)/m.test(readFileSync("/proc/self/cgroup", "utf8"));
  } catch {
    return false;
  }
}

/** Whether this call runs where the helper admits it: a local host with the helper, outside any capacity scope. */
export const admitsThroughHelper = () => existsSync(capacityHelper) && !insideCapacityScope();

class CapacityFailure extends Schema.TaggedError<CapacityFailure>()("CapacityFailure", { problem: Schema.String }) {}

/**
 * Re-runs this command inside a capacity scope of `capacityClass` (moderate
 * for one core, heavy for several) and returns its exit code; the helper
 * queues the run while the machine is full. Returns undefined when the
 * command should run here as it is.
 */
export const admit = (capacityClass: "moderate" | "heavy", owner: string, timeoutSeconds: number) => Effect.gen(function*() {
  if (!admitsThroughHelper()) return undefined;
  return yield* Effect.tryPromise({
    try: () => Bun.spawn([process.execPath, capacityHelper, "run", "--class", capacityClass, "--owner", owner,
      "--timeout-seconds", String(timeoutSeconds), "--", process.execPath, ...process.argv.slice(1)], {
      stdin: "inherit", stdout: "inherit", stderr: "inherit",
    }).exited,
    catch: (cause) => new CapacityFailure({ problem: String(cause) }),
  });
});

/** Runs admit for a script's entry point: exits with the admitted run's code, or returns to run here. */
export async function runAdmitted(capacityClass: "moderate" | "heavy", owner: string, timeoutSeconds: number): Promise<void> {
  const code = await Effect.runPromise(admit(capacityClass, owner, timeoutSeconds));
  if (code !== undefined) process.exit(code);
}
