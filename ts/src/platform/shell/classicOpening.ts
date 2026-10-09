

import type { ShellState } from "./state";

export function beforeClassicRun(_s: ShellState, start: () => void): void {
  start();
}
