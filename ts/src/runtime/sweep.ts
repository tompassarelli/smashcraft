


import { test } from "wisp/src/runtime/testing";

export const SWEEP_PREFIX = "(sweep) ";

export function sweep(name: string, run: () => void): void {
  test(`${SWEEP_PREFIX}${name}`, run);
}

export const isSweep = (name: string): boolean => name.startsWith(SWEEP_PREFIX);
