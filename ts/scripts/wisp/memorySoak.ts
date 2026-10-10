







interface ClientSample {
  readonly slot: number;
  readonly tables: number;
  readonly functions: number;

  readonly live: Readonly<Record<string, number>>;
}

interface MemorySample {

  readonly kind: string;
  readonly frame: number;
  readonly heapKb: number;
  readonly fields: Readonly<Record<string, string>>;
  readonly clients: readonly ClientSample[];
}

interface MemoryRun {
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


function fit(points: readonly (readonly [x: number, y: number])[]): { readonly slope: number; readonly error: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, error: 0 };
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const [x, y] of points) {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  }
  if (denominator === 0) return { slope: 0, error: 0 };
  const slope = numerator / denominator;
  const residuals = points.reduce((sum, [x, y]) => sum + (y - meanY - slope * (x - meanX)) ** 2, 0);
  return { slope, error: n > 2 ? Math.sqrt(residuals / (n - 2) / denominator) : 0 };
}

const slope = (points: readonly (readonly [x: number, y: number])[]) => fit(points).slope;

// A count is flat unless its fitted line rises `limit` or more across the window and the slope is over three standard
// errors: what is alive at a sample varies with the lineup just played (each fighter pools its own effects), so a
// higher single sample is not growth.
function flat(points: readonly (readonly [x: number, y: number])[], limit: number) {
  const { slope, error } = fit(points);
  const xs = points.map(([x]) => x);
  const rise = points.length < 2 ? 0 : slope * (Math.max(...xs) - Math.min(...xs));
  return { slope, error, rise, grows: rise >= limit && slope > 3 * error };
}

interface MemoryLimits {

  readonly warmupMinutes: number;

  readonly heapKbPer10Minutes: number;

  readonly heapKbPerMatch: number;

  readonly handlesPerWindow: number;
}


export const MEMORY_LIMITS: MemoryLimits = { warmupMinutes: 10, heapKbPer10Minutes: 1024, heapKbPerMatch: 1, handlesPerWindow: 1 };

interface MemoryVerdict {
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
    const of = (samples: readonly MemorySample[]) => samples.flatMap((sample) => sample.clients.filter((client) => client.slot === slot).map((client) => [minutes(sample.frame), counts(client)] as const));
    const warmCounts = of(warm);
    const afterCounts = of(after);
    const names = [...new Set([...warmCounts, ...afterCounts].flatMap(([, values]) => Object.keys(values)))].sort();
    const parts: string[] = [];
    for (const name of names) {
      const ceiling = Math.max(0, ...warmCounts.map(([, values]) => values[name] ?? 0));
      const trend = flat(afterCounts.map(([x, values]) => [x, values[name] ?? 0]), limits.handlesPerWindow);
      const highest = Math.max(0, ...afterCounts.map(([, values]) => values[name] ?? 0));
      parts.push(`${name} ${ceiling}${highest > ceiling ? ` -> ${highest}` : ""}${trend.slope === 0 ? "" : ` (${(trend.slope * 10).toFixed(1)} ± ${(trend.error * 10).toFixed(1)} per 10 min)`}`);
      if (trend.grows) failures.push(`p${slot} ${name} at fighter selection grows ${(trend.slope * 10).toFixed(1)} ± ${(trend.error * 10).toFixed(1)} per 10 min after warm-up (${trend.rise.toFixed(1)} over the window)`);
    }
    lines.push(`p${slot} at fighter selection (warm-up high, then any higher sample and the slope after warm-up): ${parts.join(", ")}`);
  }
  const slopes = matchSlopes(run, limits);
  return { lines: [...lines, ...slopes.lines], failures: [...failures, ...slopes.failures] };
}


// The slope test after each match: least squares over the samples taken on the result screen after warm-up, x the match
// number. The heap must grow under heapKbPerMatch per match and each live handle kind (effects are the `effect` kind)
// must be flat.
function matchSlopes(run: MemoryRun, limits: MemoryLimits): MemoryVerdict {
  const after = run.samples.filter((sample) => sample.kind === "match" && minutes(sample.frame) >= limits.warmupMinutes);
  const match = (sample: MemorySample) => Number(sample.fields.match);
  const [head] = after;
  const tail = after.at(-1);
  if (after.length < 3 || head === undefined || tail === undefined) return { lines: [], failures: [`only ${after.length} matches after warm-up: play longer`] };
  const first = match(head);
  const last = match(tail);
  const failures: string[] = [];
  const heap = fit(after.map((sample) => [match(sample), sample.heapKb]));
  const heapSlope = heap.slope;
  const heaps = after.map((sample) => sample.heapKb);
  const lines = [`after each match ${first}-${last}: Lua heap ${Math.min(...heaps)}-${Math.max(...heaps)} KB, slope ${heapSlope.toFixed(2)} ± ${heap.error.toFixed(2)} KB per match (limit ${limits.heapKbPerMatch})`];
  if (heapSlope >= limits.heapKbPerMatch) failures.push(`Lua heap grows ${heapSlope.toFixed(2)} KB per match after warm-up`);
  const slots = [...new Set(after.flatMap((sample) => sample.clients.map((client) => client.slot)))].sort((a, b) => a - b);
  for (const slot of slots) {
    const series = after.flatMap((sample) => sample.clients.filter((client) => client.slot === slot).map((client) => [match(sample), client.live] as const));
    const kinds = [...new Set(series.flatMap(([, live]) => Object.keys(live)))].sort();
    const parts: string[] = [];
    for (const kind of kinds) {
      const points = series.map(([x, live]) => [x, live[kind] ?? 0] as const);
      const { slope: perMatch, error, rise, grows } = flat(points, limits.handlesPerWindow);
      const values = points.map(([, y]) => y);
      parts.push(`${kind} ${Math.min(...values)}-${Math.max(...values)} slope ${perMatch.toFixed(3)} ± ${error.toFixed(3)}`);
      if (grows) failures.push(`p${slot} live ${kind} grows ${perMatch.toFixed(3)} per match (${rise.toFixed(1)} over matches ${first}-${last})`);
    }
    lines.push(`p${slot} live handles after each match (range, slope per match): ${parts.join(", ")}`);
  }
  return { lines, failures };
}
