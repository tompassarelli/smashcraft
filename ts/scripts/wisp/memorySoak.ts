







export interface ClientSample {
  readonly slot: number;
  readonly tables: number;
  readonly functions: number;

  readonly live: Readonly<Record<string, number>>;
}

export interface MemorySample {

  readonly kind: string;
  readonly frame: number;
  readonly heapKb: number;
  readonly fields: Readonly<Record<string, string>>;
  readonly clients: readonly ClientSample[];
}

export interface MemoryRun {
  readonly samples: readonly MemorySample[];
  readonly problems: readonly string[];
  readonly frames: number;
  readonly matches: number;
}

const FRAMES_PER_MINUTE = 3600;

const pairs = (text: string, separator: string) => {
  const fields: Record<string, string> = {};
  for (const part of text.split(separator)) {
    const at = part.indexOf("=");
    if (at > 0) fields[part.slice(0, at)] = part.slice(at + 1);
  }
  return fields;
};

const whole = (text: string | undefined, what: string) => {
  const value = Number(text);
  if (text === undefined || !Number.isFinite(value)) throw new Error(`no ${what}`);
  return value;
};


export function parseMemoryRun(text: string): MemoryRun {
  const samples: MemorySample[] = [];
  const problems: string[] = [];
  let done: Record<string, string> | undefined;
  for (const line of text.split("\n")) {
    if (line.startsWith("problem ")) problems.push(line.slice("problem ".length));
    else if (line.startsWith("done ")) done = pairs(line.slice("done ".length), " ");
    else if (line.startsWith("sample ")) {
      const [head = "", ...clientParts] = line.slice("sample ".length).split(" | ");
      const fields = pairs(head, " ");
      const clients = clientParts.map((part) => {
        const values = pairs(part.trim(), " ");
        const slot = /^p(\d+)/.exec(part.trim())?.[1];
        const live: Record<string, number> = {};
        for (const [kind, count] of Object.entries(pairs(values.live ?? "", ","))) live[kind] = Number(count);
        return { slot: whole(slot, `client in ${line}`), tables: whole(values.tables, `tables in ${line}`), functions: whole(values.functions, `functions in ${line}`), live };
      });
      samples.push({ kind: fields.kind ?? "", frame: whole(fields.frame, `frame in ${line}`), heapKb: whole(fields["heap-kb"], `heap in ${line}`), fields, clients });
    }
  }
  if (done === undefined) throw new Error("the run didn't finish: no done line");
  return { samples, problems, frames: whole(done.frames, "frames"), matches: whole(done.matches, "matches") };
}


function slope(points: readonly (readonly [x: number, y: number])[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const [x, y] of points) {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

export interface MemoryLimits {

  readonly warmupMinutes: number;

  readonly heapKbPer10Minutes: number;
}


export const MEMORY_LIMITS: MemoryLimits = { warmupMinutes: 10, heapKbPer10Minutes: 1024 };

export interface MemoryVerdict {
  readonly lines: readonly string[];
  readonly failures: readonly string[];
}


const counts = (client: ClientSample): Record<string, number> => ({ ...client.live, tables: client.tables, functions: client.functions });

const minutes = (frame: number) => frame / FRAMES_PER_MINUTE;


export function checkMemory(run: MemoryRun, limits: MemoryLimits = MEMORY_LIMITS): MemoryVerdict {
  const failures: string[] = [...run.problems.map((problem) => `problem: ${problem}`)];
  const menus = run.samples.filter((sample) => sample.kind === "menu");
  const warm = menus.filter((sample) => minutes(sample.frame) < limits.warmupMinutes);
  const after = menus.filter((sample) => minutes(sample.frame) >= limits.warmupMinutes);
  const lines = [`${minutes(run.frames).toFixed(1)} game minutes, ${run.matches} matches, ${menus.length} returns to fighter selection (${after.length} after the ${limits.warmupMinutes}-minute warm-up)`];
  if (after.length < 3) failures.push(`only ${after.length} returns to fighter selection after warm-up: play longer`);
  const heapSlope = slope(after.map((sample) => [minutes(sample.frame), sample.heapKb])) * 10;
  const heapAll = slope(menus.map((sample) => [minutes(sample.frame), sample.heapKb])) * 10;
  const heaps = after.map((sample) => sample.heapKb);
  lines.push(`Lua heap at fighter selection: ${heaps.length > 0 ? `${Math.min(...heaps)}-${Math.max(...heaps)} KB` : "no samples"}, slope ${heapSlope.toFixed(0)} KB per 10 min after warm-up (limit ${limits.heapKbPer10Minutes}), ${heapAll.toFixed(0)} over the whole run`);
  if (heapSlope >= limits.heapKbPer10Minutes) failures.push(`Lua heap grows ${heapSlope.toFixed(0)} KB per 10 min after warm-up`);
  const slots = [...new Set(menus.flatMap((sample) => sample.clients.map((client) => client.slot)))].sort((a, b) => a - b);
  for (const slot of slots) {
    const of = (samples: readonly MemorySample[]) => samples.flatMap((sample) => sample.clients.filter((client) => client.slot === slot).map((client) => counts(client)));
    const warmCounts = of(warm);
    const afterCounts = of(after);
    const names = [...new Set([...warmCounts, ...afterCounts].flatMap((values) => Object.keys(values)))].sort();
    const parts: string[] = [];
    for (const name of names) {
      const ceiling = Math.max(0, ...warmCounts.map((values) => values[name] ?? 0));
      const series = afterCounts.map((values) => values[name] ?? 0);
      const highest = Math.max(0, ...series);
      parts.push(`${name} ${ceiling}${highest > ceiling ? ` -> ${highest}` : ""}`);
      if (highest > ceiling) failures.push(`p${slot} ${name} at fighter selection rose from ${ceiling} during warm-up to ${highest} after`);
    }
    lines.push(`p${slot} at fighter selection (warm-up high, then any rise): ${parts.join(", ")}`);
  }
  return { lines, failures };
}
