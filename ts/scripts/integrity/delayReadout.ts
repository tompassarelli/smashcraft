import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { type Distribution, distribution, integer, integrityHeader, integrityRows } from "./reconcile";

// #396: input delay and rollback depth per client, read from the integrity rows a run saves.
// Delay is reconcile's local-start measure taken over every press: service callbacks from a
// press's `capture` row to the first forward `action` prediction of the same slot and frame.
// Rollback depth is each `rollback <epoch> <depth>` row's depth.

export interface ClientPages {
  readonly client: string;
  readonly pages: readonly string[];
}

export interface ClientDelay {
  readonly client: string;
  readonly dropped: number;
  readonly delay: Distribution;
  readonly pressesWithoutPrediction: number;
  readonly rollbackDepth: Distribution;
}

export function clientDelay({ client, pages }: ClientPages): ClientDelay {
  const header = integrityHeader(pages[0] ?? "");
  if (header === undefined) throw new Error(`${client}: integrity header absent`);
  const captures = new Map<string, number>();
  const actions = new Map<string, number>();
  const depths: number[] = [];
  for (const row of integrityRows(pages, client)) {
    const serial = integer(row[0], `${client} integrity row`);
    const stage = row[1];
    const what = `${client} integrity row ${serial}`;
    if (stage === "rollback") depths.push(integer(row[3], what));
    if (stage !== "capture" && stage !== "action") continue;
    const key = `${integer(row[2], what)}:${integer(row[3], what)}:${integer(row[4], what)}`;
    // capture rows log releases too; only presses start an action
    if (stage === "capture" && integer(row[6], what) !== 0 && !captures.has(key)) captures.set(key, serial);
    if (stage === "action" && !actions.has(key)) actions.set(key, serial);
  }
  const delays: number[] = [];
  let missing = 0;
  for (const [key, captured] of captures) {
    const predicted = actions.get(key);
    if (predicted === undefined) missing++;
    else delays.push(predicted - captured);
  }
  return { client, dropped: header.dropped, delay: distribution(delays), pressesWithoutPrediction: missing, rollbackDepth: distribution(depths) };
}

const PAGE = /^(?:.*-)?smashcraft-response-p(\d+)-run(\d+)-page(\d+)\.txt$/;

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? pageFiles(path) : PAGE.test(entry.name) ? [path] : [];
  });
}

// One client per directory and slot under ROOT, its latest probe run's pages in order, as reconcile reads them.
export function savedClients(root: string): ClientPages[] {
  const groups = new Map<string, { run: number; page: number; path: string }[]>();
  for (const path of pageFiles(root)) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const [, slot, run, page] = PAGE.exec(name) ?? [];
    const client = `${relative(root, path.slice(0, path.lastIndexOf("/"))) || "."} p${slot}`;
    groups.set(client, [...(groups.get(client) ?? []), { run: Number(run), page: Number(page), path }]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([client, pages]) => {
    const latest = Math.max(...pages.map((page) => page.run));
    return {
      client: `${client} run${latest}`,
      pages: pages.filter((page) => page.run === latest).sort((a, b) => a.page - b.page).map(({ path }) => readFileSync(path, "utf8")),
    };
  });
}

const shown = (value: number | undefined) => (value === undefined ? "None" : String(value));
const brief = (d: Distribution) => `${shown(d.p50)} / ${shown(d.p95)} / ${shown(d.max)} (n=${d.n})`;

export function delayTable(clients: readonly ClientDelay[]): string[] {
  return [
    "| Client | Input delay, frames: p50 / p95 / max | Presses without prediction | Rollback depth, frames: p50 / p95 / max | Rows dropped |",
    "|---|---|---|---|---|",
    ...clients.map((c) => `| ${c.client} | ${brief(c.delay)} | ${c.pressesWithoutPrediction} | ${brief(c.rollbackDepth)} | ${c.dropped} |`),
  ];
}
