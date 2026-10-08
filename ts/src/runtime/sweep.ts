// Sweeps play many matches or measure a whole roster. They run in CI's sweep
// jobs on every push, not in the suite (#243): the runners select them by this
// name prefix, the suite skipping them and SWEEPS=1 running only them.
import { test } from "wisp/src/runtime/testing";

export const SWEEP_PREFIX = "(sweep) ";

export function sweep(name: string, run: () => void): void {
  test(`${SWEEP_PREFIX}${name}`, run);
}

export const isSweep = (name: string): boolean => name.startsWith(SWEEP_PREFIX);
