// `bun wisp perf census --functions` and `perf profile`'s Lua side: replays a
// perf run with a sampling hook on the frames PERF_PROFILE_FRAMES names (a
// run is deterministic, so its frame numbers repeat) and prints, per frame, the map
// functions the samples landed in: `prof FRAME LINE SELF INCLUSIVE`, LINE
// being where the function starts in the map bundle. Only the map's own code
// is sampled: a sample taken inside an emulated native is dropped.
import type { ClientScope } from "wisp/src/headless/client";
import { luaLockstep, readFile } from "wisp/src/headless/lua";
import type { LuaHeadlessMap } from "wisp/src/headless/lua";
import type { Lockstep, SyncDelivery } from "wisp/src/headless/lockstep";
import type { PerfMeasure } from "wisp/src/headless/luaPerf";

/** Instructions between samples. */
const SAMPLE_STEP = 1000;

export function profileRun(
  map: LuaHeadlessMap,
  bundlePath: string,
  declarationsPath: string,
  frames: ReadonlySet<number>,
  play: (this: void, clients: Lockstep, measure: PerfMeasure) => { readonly problems: number; readonly lines: readonly string[] },
  delivery?: SyncDelivery,
): number {
  /** By frame, then by function start line: [self, inclusive] samples. */
  const counts = new Map<number, Map<number, [number, number]>>();
  let current: Map<number, [number, number]> | undefined;
  const sample = () => {
    const top = debug.getinfo(2, "S");
    if (top === undefined || top.short_src !== "map" || current === undefined) return;
    const seen = new Set<number>();
    for (let level = 2; ; level++) {
      const info = debug.getinfo(level, "S");
      if (info === undefined) break;
      if (info.short_src !== "map") continue;
      const line = info.linedefined ?? 0;
      let entry = current.get(line);
      if (entry === undefined) {
        entry = [0, 0];
        current.set(line, entry);
      }
      if (level === 2) entry[0]++;
      if (!seen.has(line)) {
        entry[1]++;
        seen.add(line);
      }
    }
  };
  let clients: Lockstep | undefined;
  const scope: ClientScope = {
    enter: () => {
      const frame = clients?.frame ?? 0;
      if (!frames.has(frame)) return;
      current = counts.get(frame) ?? new Map();
      counts.set(frame, current);
      debug.sethook(sample, "", SAMPLE_STEP);
    },
    leave: () => {
      debug.sethook();
      current = undefined;
    },
  };
  const lockstep = luaLockstep(map, readFile(bundlePath), readFile(declarationsPath), scope, delivery);
  clients = lockstep;
  const result = play(lockstep, { begin: () => undefined, typed: () => undefined });
  for (const [frame, functions] of counts) for (const [line, [self, inclusive]] of functions) print(`prof\t${frame}\t${line}\t${self}\t${inclusive}`);
  for (const line of result.lines) print(`journey: ${line}`);
  return result.problems;
}
