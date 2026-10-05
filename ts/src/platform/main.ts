// Development entry for the hot-reload demonstration (#36): a ticking counter
// whose state survives reloads while the reported value comes from whichever
// code is installed. Started once by the map's main(); reloads call install().
import { on, trampoline } from "./dispatch";
import { startHotReload } from "./hotReload";

interface DemoState {
  ticks: number;
}

declare global {
  var __smashcraftDemo: DemoState | undefined;
}

/** Edit this to see a reload take effect. */
function observedValue(): number {
  return 1;
}

function tick(): void {
  const state = (globalThis.__smashcraftDemo ??= { ticks: 0 });
  state.ticks++;
  PreloadGenClear();
  PreloadGenStart();
  Preload(`tick ${state.ticks} value ${observedValue()} applied ${globalThis.__smashcraftHot?.applied ?? 0}`);
  PreloadGenEnd(`smashcraft-hot-observe-p${GetPlayerId(GetLocalPlayer())}.txt`);
}

export function install(this: void): void {
  on("demo.tick", tick);
}

export function start(this: void): void {
  install();
  TimerStart(CreateTimer(), 0.5, true, trampoline("demo.tick"));
  startHotReload(0, GetPlayerId(GetLocalPlayer()));
}
