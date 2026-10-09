





import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";

export const capacityHelper = join(homedir(), "code/nixos-config/main/dotfiles/agents/skills/machine-capacity/scripts/machine-capacity.mjs");


export function insideCapacityScope(): boolean {
  try {
    return /\/agent-capacity-[0-9a-z]+\.scope(\/|$)/m.test(readFileSync("/proc/self/cgroup", "utf8"));
  } catch {
    return false;
  }
}


export const admitsThroughHelper = () => existsSync(capacityHelper) && !insideCapacityScope();

class CapacityFailure extends Schema.TaggedError<CapacityFailure>()("CapacityFailure", { problem: Schema.String }) {}







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


export async function runAdmitted(capacityClass: "moderate" | "heavy", owner: string, timeoutSeconds: number): Promise<void> {
  const code = await Effect.runPromise(admit(capacityClass, owner, timeoutSeconds));
  if (code !== undefined) process.exit(code);
}
