// `pad`, `fresh` and `accept` take their clients from --clients-file and leave the
// default clients.json alone; the pad runner ignores setup receipts written
// before its session began (a prefix copied from another install carries them).
import { afterAll, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setupReceipt } from "../scripts/wisp/commands/pad";

const folder = mkdtempSync(join(tmpdir(), "smashcraft-clients-file-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));
const fixture = (name: string) => join(import.meta.dir, "fixtures/wisp", name);

/** Runs `bun wisp ARGS` with HOME in the test folder, whose default clients.json no command may read or write. */
const wisp = (args: readonly string[]) => {
  const home = join(folder, `home-${Math.random().toString(36).slice(2)}`);
  const state = join(home, ".local/state/smashcraft");
  mkdirSync(state, { recursive: true });
  const defaultFile = join(state, "clients.json");
  const sentinel = "not the clients for this run\n";
  writeFileSync(defaultFile, sentinel);
  const before = statSync(defaultFile).mtimeMs;
  const run = Bun.spawnSync([process.execPath, join(import.meta.dir, "../scripts/wisp.ts"), ...args], { cwd: join(import.meta.dir, ".."), env: { ...Bun.env, HOME: home }, stdout: "pipe", stderr: "pipe" });
  return { code: run.exitCode, output: `${run.stdout.toString()}${run.stderr.toString()}`, untouched: readFileSync(defaultFile, "utf8") === sentinel && statSync(defaultFile).mtimeMs === before, defaultFile };
};

test("fresh, pad and accept use --clients-file FILE and leave clients.json untouched [spec AGENTS.md]", () => {
  const file = join(folder, "clones.json");
  const script = join(import.meta.dir, "native/pads/archer-neutral.pad");
  for (const args of [
    ["fresh", join(folder, "missing.w3x"), "--no-quick", "--clients-file", file],
    ["pad", script, "--helper", "helper", "--build", "typescript-integrity", "--out", join(folder, "out"), "--app-id", "a=x", "--app-id", "b=y", "--clients-file", file],
    ["pad", script, script, "--helper", "helper", "--out", join(folder, "batch"), "--map", join(folder, "missing.w3x"), "--clients-file", file],
    ["accept", "--only", "82-effects-12", "--out", join(folder, "accept"), "--clients-file", file],
  ]) {
    const run = wisp(args);
    expect(run.code, args[0]).not.toBe(0);
    // A missing clients file fails before capacity admission or client input.
    const output = run.output;
    expect(output, args.join(" ")).toContain(`can't read the clients from ${file}`);
    expect(output).not.toContain(run.defaultFile);
    expect(run.untouched, args.join(" ")).toBe(true);
  }
}, 60_000);

test("a setup receipt written before the session is ignored, even one in an older format [spec AGENTS.md]", async () => {
  const sessionStart = Date.now();
  const stale = join(folder, "stale.pld");
  copyFileSync(fixture("dev-command-receipt-malformed.pld"), stale);
  utimesSync(stale, new Date(sessionStart - 86_400_000), new Date(sessionStart - 86_400_000));
  expect(await Effect.runPromise(setupReceipt(stale, "a", sessionStart))).toBeUndefined();
  // The same file written during the session is read, and its malformed receipt refused.
  utimesSync(stale, new Date(), new Date());
  expect(Exit.isFailure(await Effect.runPromiseExit(setupReceipt(stale, "a", sessionStart)))).toBe(true);
  const fresh = join(folder, "fresh.pld");
  copyFileSync(fixture("dev-command-receipt.pld"), fresh);
  const read = await Effect.runPromise(setupReceipt(fresh, "a", sessionStart));
  expect(read?.value.receipt).toBe(1);
});
