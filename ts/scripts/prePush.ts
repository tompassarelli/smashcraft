// The pre-push gate. Git runs smashcraft:.githooks/pre-push (core.hooksPath
// .githooks) on every push, safe-push's included; it runs the fast checks for
// the projects the pushed commits change, so no lane lands a compile break or
// a type escape. CI runs the full suite on main. The checks read the working
// tree, so the gate refuses a push whose commit isn't the clean checkout.
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");
const ZERO = /^0+$/;

interface Check { readonly name: string; readonly directory: string; readonly args: readonly string[] }

/** The checks a push changing `paths` (relative to the repository root) needs. */
export function checksFor(paths: readonly string[]): Check[] {
  const ts = paths.some((path) => path.startsWith("ts/") || path === "typescript-toolchain.lock");
  const client = paths.some((path) => path.startsWith("client/ui/"));
  return [
    ...(ts ? [
      { name: "type-check ts", directory: "ts", args: ["run", "check"] },
      { name: "type escapes and source shapes", directory: "ts", args: ["test", "test/source-shapes.test.ts"] },
    ] : []),
    ...(client ? [{ name: "type-check client/ui", directory: "client/ui", args: ["run", "check"] }] : []),
  ];
}

const git = (...args: string[]) => {
  const child = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  return child.exitCode === 0 ? child.stdout.toString().trim() : undefined;
};

/** The files the pushed commits change: from what the remote has, else from where they leave origin/main. */
function changedPaths(local: string, remote: string): string[] {
  const base = !ZERO.test(remote) && git("cat-file", "-e", `${remote}^{commit}`) !== undefined ? remote : git("merge-base", local, "origin/main");
  const listed = base === undefined ? git("show", "--name-only", "--format=", local) : git("diff", "--name-only", base, local);
  return (listed ?? "").split("\n").filter((path) => path.length > 0);
}

/** Runs the gate on git's pre-push input: one "LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA" line per pushed ref. */
export function prePush(input: string): void {
  const pushed = input.split("\n").flatMap((line) => {
    const [, local, , remote] = line.trim().split(/\s+/);
    return local === undefined || remote === undefined || ZERO.test(local) ? [] : [{ local, remote }];
  });
  const paths = [...new Set(pushed.flatMap(({ local, remote }) => changedPaths(local, remote)))];
  const checks = checksFor(paths);
  if (checks.length > 0) {
    const head = git("rev-parse", "HEAD");
    const dirty = git("status", "--porcelain", "--", ...new Set(checks.map(({ directory }) => directory)));
    if (pushed.some(({ local }) => local !== head) || dirty !== "") {
      console.error(`pre-push: the checks read the working tree, so push the clean checked-out commit (HEAD ${head?.slice(0, 12)}).\n${dirty ?? ""}`);
      process.exit(1);
    }
    for (const { name, directory, args } of checks) {
      const cwd = join(root, directory);
      if (!existsSync(join(cwd, "node_modules"))) Bun.spawnSync([process.execPath, "install", "--frozen-lockfile"], { cwd, stdout: "ignore", stderr: "inherit" });
      const started = performance.now();
      const child = Bun.spawnSync([process.execPath, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      if (child.exitCode !== 0) {
        console.error(`${child.stdout.toString()}${child.stderr.toString()}\npre-push: ${name} failed (${seconds} s); fix it before landing.`);
        process.exit(1);
      }
      console.error(`pre-push: ${name} passed (${seconds} s)`);
    }
  }
}
