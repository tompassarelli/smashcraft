





import type { ClientScope } from "wisp/src/headless/client";
import { luaLockstep, readFile } from "wisp/src/headless/lua";
import type { LuaHeadlessMap } from "wisp/src/headless/lua";
import type { Lockstep, SyncDelivery } from "wisp/src/headless/lockstep";
import type { PerfMeasure } from "wisp/src/headless/luaPerf";


const SAMPLE_STEP = 1000;

export function profileRun(
  map: LuaHeadlessMap,
  bundlePath: string,
  declarationsPath: string,
  frames: ReadonlySet<number>,
  play: (this: void, clients: Lockstep, measure: PerfMeasure) => { readonly problems: number; readonly lines: readonly string[] },
  delivery?: SyncDelivery,
  phases = false,
): number {
  const bundle = readFile(bundlePath);
  const names = new Map<number, string>();
  let module = "";
  let number = 0;
  for (const text of bundle.split("\n")) {
    number++;
    if (text.startsWith('["')) module = text.substring(2, text.indexOf('"', 2));
    names.set(number, `${module} ${text.trim()}`);
  }
  const phaseCounts = new Map<number, Map<number, number[]>>();
  let phaseRow: number[] | undefined;
  const breakdowns = new Map<number, Map<number, number[]>>();
  let breakdown: number[] | undefined;

  const stack = (first: number): [number, boolean] => {
    let phase = 4;
    let simulation = false;
    for (let level = first; ; level++) {
      const info = debug.getinfo(level, "S");
      if (info === undefined) break;
      if (info.short_src !== "map") continue;
      const name = names.get(info.linedefined ?? 0) ?? "";
      if (name.startsWith("game.match.step ") && name.includes("stepMatch(")) simulation = true;
      if (name.startsWith("game.replay.history ") && name.includes(".repair(")) phase = 0;
      else if (phase !== 0 && name.startsWith("platform.shell.rollback ") && name.includes("stepConfirmed(")) phase = 1;
      else if (phase > 1 && name.startsWith("game.replay.shadowPlayback ") && (name.includes(".advanceSpeculative(") || name.includes(".catchUpSpeculative("))) phase = 2;
      else if (phase > 2 && (name.startsWith("platform.shell.view ") || name.startsWith("game.render.") || name.startsWith("game.ui.") || name.startsWith("game.presentation."))) phase = 3;
    }
    return [phase, simulation];
  };

  const counts = new Map<number, Map<number, [number, number]>>();
  let current: Map<number, [number, number]> | undefined;
  const sample = (event: string) => {
    const top = debug.getinfo(2, "S");
    if (top === undefined || top.short_src !== "map" || current === undefined) return;
    if (phases && phaseRow !== undefined) {
      const name = names.get(top.linedefined ?? 0) ?? "";
      if (event !== "count") {
        if (name.startsWith("game.match.step ") && name.includes("stepMatch(")) {
          const [phase] = stack(3);
          phaseRow[6] = (phaseRow[6] ?? 0) + 1;
          if (phase === 0) phaseRow[7] = (phaseRow[7] ?? 0) + 1;
        }
        return;
      }
      const [phase, simulation] = stack(3);
      phaseRow[phase] = (phaseRow[phase] ?? 0) + 1;
      if (simulation) phaseRow[5] = (phaseRow[5] ?? 0) + 1;
    }
    const seen = new Set<number>();
    const trace: string[] = [];
    for (let level = 2; ; level++) {
      const info = debug.getinfo(level, "S");
      if (info === undefined) break;
      if (info.short_src !== "map") continue;
      const line = info.linedefined ?? 0;
      trace.push(names.get(line) ?? "");
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
    if (event === "count" && breakdown !== undefined) {
      const has = (value: string) => trace.some(name => name.includes(value));
      const category = has(".copySnapshot(") || has(".saveRow(") ? 0
        : has(".copyReplayState(") ? 1
        : has("game.match.botPlay ") || has(".repeatedComputers(") ? 3
        : has("game.match.step ") && has("stepMatch(") && has(".repair(") ? 2
        : has("platform.shell.view function ____exports.renderUi(") || has("game.ui.matchHud ") ? 6
        : has("game.render.modelSound") || has("game.presentation.matchAudio ") ? 5
        : trace.some(name => name.startsWith("game.presentation.") || name.startsWith("game.render.")) ? 4 : 7;
      breakdown[category] = (breakdown[category] ?? 0) + 1;
    }
  };
  let clients: Lockstep | undefined;
  const scope: ClientScope = {
    enter: (client) => {
      const frame = clients?.frame ?? 0;
      if (!frames.has(frame)) return;
      current = counts.get(frame) ?? new Map();
      counts.set(frame, current);
      const breakdownSlots = breakdowns.get(frame) ?? new Map<number, number[]>();
      breakdowns.set(frame, breakdownSlots);
      breakdown = breakdownSlots.get(client.slot) ?? [0, 0, 0, 0, 0, 0, 0, 0];
      breakdownSlots.set(client.slot, breakdown);
      if (phases) {
        const slots = phaseCounts.get(frame) ?? new Map<number, number[]>();
        phaseCounts.set(frame, slots);
        phaseRow = slots.get(client.slot) ?? [0, 0, 0, 0, 0, 0, 0, 0];
        slots.set(client.slot, phaseRow);
      }
      debug.sethook(sample, phases ? "c" : "", SAMPLE_STEP);
    },
    leave: () => {
      debug.sethook();
      current = undefined;
      phaseRow = undefined;
      breakdown = undefined;
    },
  };
  const lockstep = luaLockstep(map, bundle, readFile(declarationsPath), scope, delivery);
  clients = lockstep;
  const result = play(lockstep, { begin: () => undefined, typed: () => undefined });
  for (const [frame, functions] of counts) for (const [line, [self, inclusive]] of functions) print(`prof\t${frame}\t${line}\t${self}\t${inclusive}`);
  for (const [frame, slots] of phaseCounts) for (const [slot, row] of slots) print(`phase\t${frame}\t${slot}\t${row.join("\t")}`);
  for (const [frame, slots] of breakdowns) for (const [slot, row] of slots) print(`breakdown\t${frame}\t${slot}\t${row.join("\t")}`);
  for (const line of result.lines) print(`journey: ${line}`);
  return result.problems;
}
