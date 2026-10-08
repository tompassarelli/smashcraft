// Where Classic's tournament opening plays (#269 builds it): before a run's
// first fight loads. Until it exists the run starts at once.
import type { ShellState } from "./state";

export function beforeClassicRun(_s: ShellState, start: () => void): void {
  start();
}
