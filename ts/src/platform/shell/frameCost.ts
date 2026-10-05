// Temporary native probe for deciding which clock measures work in Warcraft.
// It is invoked only by the explicit development console command.
import { frameCostClockFile } from "../../runtime/gameFiles";
declare const os: { readonly clock?: () => number } | undefined;

const WORK_ITERATIONS = 100000;

function seconds(value: number): string {
  return R2SW(value, 12, 6);
}

function readOsClock(): number | undefined {
  if (typeof os === "undefined" || typeof os.clock !== "function") return undefined;
  return os.clock();
}

/** Reports Lua os.clock and Warcraft timer progress around the same bounded loop. */
export function probeFrameCostClock(): void {
  const hasOs = typeof os !== "undefined";
  const hasOsClock = hasOs && typeof os.clock === "function";
  const timer = CreateTimer();
  TimerStart(timer, 3600.0, false, () => {});

  const osBefore = hasOsClock ? readOsClock() : undefined;
  const timerBefore = TimerGetElapsed(timer);
  let work = 0;
  for (let i = 0; i < WORK_ITERATIONS; i++) work = (work + i) | 0;
  const timerAfter = TimerGetElapsed(timer);
  const osAfter = hasOsClock ? readOsClock() : undefined;
  DestroyTimer(timer);

  const message = `frame-cost-clock os=${hasOs ? "present" : "missing"} os.clock=${hasOsClock ? "present" : "missing"}`
    + ` os.delta=${osBefore === undefined || osAfter === undefined ? "n/a" : seconds(osAfter - osBefore)}`
    + ` timer.before=${seconds(timerBefore)} timer.after=${seconds(timerAfter)}`
    + ` timer.delta=${seconds(timerAfter - timerBefore)} work=${I2S(work)}`;
  DisplayTextToPlayer(GetLocalPlayer(), 0.0, 0.0, message);
  PreloadGenClear();
  PreloadGenStart();
  Preload(message);
  PreloadGenEnd(frameCostClockFile(GetPlayerId(GetLocalPlayer())));
}
