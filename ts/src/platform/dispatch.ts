// Engine callbacks bind to stable trampolines that look up the current handler
// by name, so hot reload replaces code by re-registering handlers; timers and
// triggers created once keep working. The table lives in a Lua global so a
// reloaded bundle, whose module locals are fresh, finds the same handlers.
// Trampolines call the table's `run`, which each bundle replaces when it
// installs, so how handlers run, including error reporting, reloads too.
import { reportError, traceback } from "./errors";

type Handler = (this: void) => void;

interface DispatchTable {
  handlers: Record<string, Handler | undefined>;
  run: (this: void, name: string) => void;
}

declare global {
  var __smashcraftDispatch: DispatchTable | undefined;
}

/** Runs a handler under the one error handler that reports where it failed. */
function run(name: string): void {
  const handler = table().handlers[name];
  if (handler !== undefined) xpcall(handler, (error: unknown) => reportError(name, error, traceback()));
}

function table(): DispatchTable {
  return (globalThis.__smashcraftDispatch ??= { handlers: {}, run });
}

/** Makes this bundle's way of running handlers the current one. */
export function installDispatch(): void {
  table().run = run;
}

/** Registers or replaces the handler for a named engine callback. */
export function on(name: string, handler: Handler): void {
  table().handlers[name] = handler;
}

/** A callback for natives (TimerStart, TriggerAddAction) that always runs the current handler. */
export function trampoline(name: string): Handler {
  return () => table().run(name);
}
