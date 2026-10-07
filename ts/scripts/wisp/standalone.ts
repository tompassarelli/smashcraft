import type { StandaloneGame, StandaloneInput, StandaloneSession } from "wisp/scripts/wisp/standalone";
import { join } from "node:path";
import type { MapEntry } from "wisp/src/headless/client";
import { Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { RenderFailure } from "wisp/scripts/wisp/headlessRender";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { Action } from "../../src/game/input/actions";
import { keyFor, presetBindings } from "../../src/game/input/keyBindings";
import { Phase } from "../../src/game/match/rules";
import { NATIVE_DRIVER_BUILD, PLAYABLE_BUILD } from "../../src/game/shell/currentBuild";
import type { MapBuild } from "../../src/game/shell/build";
import { PREDICTED_HEADLESS, SMASHCRAFT_HEADLESS } from "./headless";
import { headlessRender } from "./headlessRender";

const ACTIONS: Readonly<Record<string, Action>> = {
  attack: Action.attack, special: Action.special, jump: Action.jump,
  grab: Action.grab, shield: Action.leftTrigger, walk: Action.walk,
  left: Action.moveLeft, right: Action.moveRight, up: Action.moveUp, down: Action.moveDown,
  smashLeft: Action.smashLeft, smashRight: Action.smashRight,
  smashUp: Action.smashUp, smashDown: Action.smashDown,
};
const BINDINGS = presetBindings("standard");
export const NEUTRAL_INPUT: StandaloneInput = { buttons: [], axisX: 0, axisY: 0 };

function keys(input: StandaloneInput): Set<number> {
  const buttons = new Set(input.buttons);
  if (input.axisX < -0.28) buttons.add("left");
  if (input.axisX > 0.28) buttons.add("right");
  if (input.axisY < -0.28) buttons.add("down");
  if (input.axisY > 0.28) buttons.add("up");
  const held = new Set<number>();
  for (const button of buttons) {
    const action = ACTIONS[button];
    const key = button === "start" ? 89 : button === "view" ? 75 : action === undefined ? undefined : keyFor(BINDINGS, action, 0);
    if (key !== undefined) held.add(key);
  }
  return held;
}

/** One map callback per step; scripts share the native driver's exact pad rows. */
export async function createStandaloneSession(options: { readonly script?: string; readonly presentation?: MapBuild["presentation"] } = {}): Promise<StandaloneSession & { frame(): number; finished(): boolean }> {
  const { script, presentation } = options;
  const runtime = installHeadless(script === undefined || presentation === "pool-confirmed" || presentation === "pool-predicted" ? PREDICTED_HEADLESS : SMASHCRAFT_HEADLESS);
  try {
    // Map modules are checked by tsconfig.game.json, with Warcraft's native types.
    const platform = join(import.meta.dir, "../../src/platform");
    interface State { readonly game: { readonly phase: number }; readonly runtime: { readonly simulationFrame: number } }
    const { shell }: { shell(): State } = await import(join(platform, "shell/state.ts"));
    const { confirmedChecksum }: { confirmedChecksum(state: State): string } = await import(join(platform, "shell/diagnostics.ts"));
    const { applyDeveloperCommand }: { applyDeveloperCommand(state: State, slot: number, text: string): void } = await import(join(platform, "shell/keys.ts"));
    const { drawnFrame }: { drawnFrame(state: State): { readonly frame: number } } = await import(join(platform, "shell/drawnFrame.ts"));
    const build = { ...PLAYABLE_BUILD, devConsole: true, ...(presentation === undefined ? {} : { presentation }) };
    const main: { install(build: MapBuild): void; startBuild(build: MapBuild): void } = await import(join(platform, "main.ts"));
    const driverApi: { nativeDriverCommand(text: string): void; installSmashcraftNativeDriver(): void; startSmashcraftNativeDriver(): void } | undefined = script === undefined ? undefined : await import(join(platform, "nativeDriver.ts"));
    const driverBuild = { ...NATIVE_DRIVER_BUILD, ...(presentation === undefined ? {} : { presentation }) };
    const driver: MapEntry | undefined = script === undefined ? undefined : presentation === undefined ? await import(join(platform, "nativeDriverMain.ts")) : {
      install() { main.install(driverBuild); driverApi?.installSmashcraftNativeDriver(); },
      start() { main.startBuild(driverBuild); driverApi?.installSmashcraftNativeDriver(); driverApi?.startSmashcraftNativeDriver(); },
    };
    const driverCommand = driverApi?.nativeDriverCommand;
    const clients = runtime.clients(driver ?? { install: () => main.install(build), start: () => main.startBuild(build) }, script === undefined ? [0] : [0, 1], { keepCalls: 0 });
    clients.start();
    clients.frames(30);
    const client = clients.client(0);
    const value = <T>(read: () => T): T => {
      let result: T | undefined;
      client.run(() => { result = read(); });
      if (result === undefined) throw new Error("standalone state missing");
      return result;
    };
    if (script === undefined) client.run(() => applyDeveloperCommand(shell(), 0, "-dev quick cpu wren expert"));
    else clients.everywhere(() => driverCommand?.(script));
    if (value(() => shell().game.phase) !== Phase.match) throw new Error("standalone match did not start");
    if (script !== undefined) clients.everywhere(() => driverCommand?.("resume"));
    let held = new Set<number>();
    let closed = false;
    return {
      client,
      step(input) {
        if (closed) throw new Error("standalone session is closed");
        if (script === undefined) {
          const next = keys(input);
          for (const key of held) if (!next.has(key)) client.key(0, key, 0, false);
          for (const key of next) if (!held.has(key)) client.key(0, key, 0, true);
          held = next;
        }
        clients.frames(1);
        for (const current of clients.clients) if (current.errors.length > 0) throw new Error(current.errors.join("\n"));
      },
      checksum: () => value(() => confirmedChecksum(shell())),
      frame: () => value(() => presentation === "pool-predicted" ? drawnFrame(shell()).frame : shell().runtime.simulationFrame),
      finished: () => value(() => shell().game.phase === Phase.result),
      close() { if (!closed) { closed = true; runtime.restore(); } },
    };
  } catch (error) {
    runtime.restore();
    throw error;
  }
}

export const SMASHCRAFT_STANDALONE: StandaloneGame = {
  title: "Smashcraft",
  render: { ...headlessRender(), preloadModels: ["Abilities\\Spells\\Human\\Thunderclap\\ThunderclapTarget.mdx"] },
  create: createStandaloneSession,
};

export function standaloneArguments(args: readonly string[]) {
  let script: string | undefined, out: string | undefined, frames: number | undefined;
  let presentation: MapBuild["presentation"] | undefined;
  let headless = false;
  const captureFrames: number[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--standalone") continue;
    if (arg === "--headless") { headless = true; continue; }
    if (arg === "--script" || arg === "--out" || arg === "--frames" || arg === "--capture-frames" || arg === "--presentation") {
      const value = args[++index];
      if (value === undefined || value.startsWith("--")) throw new Error(`${arg} needs a value`);
      if (arg === "--presentation") {
        if (value !== "native" && value !== "pool-confirmed" && value !== "pool-predicted") throw new Error("--presentation needs native, pool-confirmed or pool-predicted");
        presentation = value;
      } else if (arg === "--script") script = value;
      else if (arg === "--out") out = value;
      else if (arg === "--frames") {
        if (!/^\d+$/.test(value) || Number(value) < 1) throw new Error("--frames needs a positive frame count");
        frames = Number(value);
      } else {
        if (!/^\d+(,\d+)*$/.test(value)) throw new Error("--capture-frames needs comma-separated frame numbers");
        captureFrames.push(...value.split(",").map(Number));
      }
    } else throw new Error(`unknown standalone option: ${arg}`);
  }
  if (headless && (frames === undefined || out === undefined)) throw new Error("--headless needs --frames N and --out DIR");
  return { ...(script === undefined ? {} : { script }), ...(presentation === undefined ? {} : { presentation }), ...(out === undefined ? {} : { out }), ...(frames === undefined ? {} : { frames }), headless, ...(captureFrames.length === 0 ? {} : { captureFrames }) };
}

export const standalonePlay: Command = (args) => Effect.gen(function*() {
  const options = yield* Effect.try({ try: () => standaloneArguments(args), catch: (cause) => new UsageFailure({ problem: String(cause) }) });
  const { runStandalone } = yield* Effect.tryPromise({ try: () => import("wisp/scripts/wisp/standalone"), catch: (cause) => new RenderFailure({ cause }) });
  return yield* runStandalone({ ...SMASHCRAFT_STANDALONE, create: (session) => createStandaloneSession({ ...session, ...(options.presentation === undefined ? {} : { presentation: options.presentation }) }) }, options);
});
