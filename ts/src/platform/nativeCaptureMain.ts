// One client plays every baked pad script (both players' pads) through the
// native driver and holds each capture frame for the host to photograph
// (`bun scripts/nativeCapture.ts run`). The host takes a capture only when the
// drawn stamp in its pixels names the held frame (smashcraft:ts/src/runtime/drawnStamp.ts).
// Nothing reaches the map from the host: the fixtures are part of the build.
import type { MapBuild } from "../game/shell/build";
import { NATIVE_DRIVER_BUILD } from "../game/shell/currentBuild";
import { install as installGame, startBuild } from "./main";
import { nativeDriverCommand } from "./nativeDriver";
import { shellState } from "./shell/state";
import { on, trampoline } from "wisp/src/platform/dispatch";
import { writeLines } from "wisp/src/platform/fileio";
import { f32 } from "wisp/src/sim/f32";
import { CAPTURE_FIXTURES } from "./captureFixtures";
import { CAPTURE_STATUS_FILE } from "../runtime/gameFiles";

const BUILD: MapBuild = { ...NATIVE_DRIVER_BUILD, presentation: "pool-predicted" };
const TICK = "capture.fixtures";
/** Callbacks after the map starts before the first script: the menus finish loading. */
const WARMUP_TICKS = 300;
/** Callbacks a new script holds its first frame, so the match's opening presentation settles. */
const OPENING_TICKS = 120;
/** Callbacks each capture frame is held: several host captures at about 0.3-1.5 s each. */
const HOLD_TICKS = 180;
/** Frames played past a script's last capture before the next script. */
const TAIL_FRAMES = 30;

interface Runner {
  ticks: number;
  script: number;
  /** The capture frame being run to or held, or the opening hold at frame 0, or the tail after the last capture. */
  stage: "opening" | "target" | "tail";
  frame: number;
  held: number;
  tail: number;
}
declare global { var __smashcraftCaptureRunner: Runner | undefined; }
const runner = (): Runner => globalThis.__smashcraftCaptureRunner ??= { ticks: 0, script: -1, stage: "opening", frame: 0, held: 0, tail: 0 };

function status(line: string): void { writeLines(CAPTURE_STATUS_FILE, [line]); }

function nextScript(r: Runner): void {
  r.script++;
  r.stage = "opening";
  r.frame = 0;
  r.held = 0;
  const fixture = CAPTURE_FIXTURES[r.script];
  if (fixture === undefined) {
    nativeDriverCommand("reset");
    status(`CAPTURE DONE ${CAPTURE_FIXTURES.length}`);
    return;
  }
  nativeDriverCommand(fixture.script);
  status(`CAPTURE SCRIPT ${r.script + 1} ${fixture.name}`);
}

function tick(): void {
  const s = shellState();
  const r = runner();
  if (s === undefined || ++r.ticks < WARMUP_TICKS) return;
  if (r.script < 0) { nextScript(r); return; }
  const fixture = CAPTURE_FIXTURES[r.script];
  if (fixture === undefined) return;
  const now = s.runtime.simulationFrame;
  if (r.stage === "tail") {
    if (now >= r.tail) nextScript(r);
    return;
  }
  if (r.stage === "opening") {
    if (++r.held < OPENING_TICKS) return;
    r.held = 0;
    r.stage = "target";
    nativeDriverCommand(`resume ${fixture.frames[0] ?? 0}`);
    return;
  }
  const target = fixture.frames[r.frame];
  if (target === undefined || now !== target || ++r.held < HOLD_TICKS) return;
  r.held = 0;
  r.frame++;
  const next = fixture.frames[r.frame];
  if (next !== undefined) {
    nativeDriverCommand(`resume ${next}`);
    return;
  }
  r.stage = "tail";
  r.tail = target + TAIL_FRAMES;
  nativeDriverCommand(`resume ${r.tail}`);
}

export function install(this: void): void {
  installGame(BUILD);
  on(TICK, tick);
}

export function start(this: void): void {
  startBuild(BUILD);
  on(TICK, tick);
  TimerStart(CreateTimer(), f32(0.01666666753590107), true, trampoline(TICK));
}
