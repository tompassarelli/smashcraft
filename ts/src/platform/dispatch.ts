// Engine callbacks bind to stable trampolines that look up the current handler
// by name, so hot reload replaces code by re-registering handlers; timers and
// triggers created once keep working. The table lives in a Lua global so a
// reloaded bundle, whose module locals are fresh, finds the same handlers.

type Handler = (this: void) => void;

interface DispatchTable {
  handlers: Record<string, Handler | undefined>;
}

declare global {
  var __smashcraftDispatch: DispatchTable | undefined;
}

function table(): DispatchTable {
  return (globalThis.__smashcraftDispatch ??= { handlers: {} });
}

/** Registers or replaces the handler for a named engine callback. */
export function on(name: string, handler: Handler): void {
  table().handlers[name] = handler;
}

/** A callback for natives (TimerStart, TriggerAddAction) that always runs the current handler. */
export function trampoline(name: string): Handler {
  return () => table().handlers[name]?.();
}
