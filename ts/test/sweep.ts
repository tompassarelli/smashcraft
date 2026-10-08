// Bun-only sweeps (src/runtime/sweep.ts): skipped in the suite; `SWEEPS=1 bun
// run test` runs only them.
import { test } from "bun:test";
import { SWEEP_PREFIX } from "../src/runtime/sweep";

export const SWEEPS = process.env.SWEEPS === "1";

export function sweep(name: string, run: () => void | Promise<void>, timeout?: number): void {
  (SWEEPS ? test : test.skip)(`${SWEEP_PREFIX}${name}`, run, timeout);
}
