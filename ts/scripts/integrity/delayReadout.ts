import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { type Distribution, distribution, integer, integrityHeader, integrityRows } from "./reconcile";

// #396: the quantities are defined in smashcraft:docs/commands/integrity.md ("Delay readout").

interface ClientPages {
  readonly client: string;
  readonly pages: readonly string[];
}

interface ClientDelay {
  readonly client: string;
  readonly dropped: Dropped;
  readonly delay: Distribution;
  readonly pressesWithoutPrediction: number;
  readonly ownEcho: Distribution;
  readonly lateness: Distribution;
  readonly rollbackDepth: Distribution;
  readonly agreed: readonly string[];
  readonly halts: number;
  readonly cursor: readonly number[];
  readonly cursorOffset: Distribution | undefined;
}

interface Dropped {
  readonly integrity: number;
  readonly transport: number;
  readonly edges: number;
}

function headerCount(page: string, pattern: RegExp): number {
  const match = pattern.exec(page);
  return match === null ? 0 : Number(match[1]);
}

const CURSOR_ROW = /Preload\( "A (\d+)(?: \S+){8} (-?\d+)/g;

export function clientDelay({ client, pages }: ClientPages): ClientDelay {
  const first = pages[0] ?? "";
  const header = integrityHeader(first);
  if (header === undefined) throw new Error(`${client}: integrity header absent`);
  const local = headerCount(first, / local=(\d+)/);
  const captures = new Map<string, number>();
  const captureFrontiers = new Map<string, number>();
  const actions = new Map<string, number>();
  const depths: number[] = [];
  const echoes: number[] = [];
  const lateness: number[] = [];
  const agreed: string[] = [];
  let halts = 0;
  for (const row of integrityRows(pages, client)) {
    const serial = integer(row[0], `${client} integrity row`);
    const stage = row[1];
    const what = `${client} integrity row ${serial}`;
    if (stage === "rollback") depths.push(integer(row[3], what));
    if (stage === "stall") halts++;
    if (stage === "delay") agreed.push(`${integer(row[2], what)}:${integer(row[3], what)} (${row[4] ?? "-"})`);
    if (stage !== "capture" && stage !== "action" && stage !== "receive") continue;
    const slot = integer(row[3], what);
    const frame = integer(row[4], what);
    const key = `${integer(row[2], what)}:${slot}:${frame}`;
    if (stage === "receive") {
      const frontier = integer(row[8], what);
      if (slot !== local) lateness.push(frontier - frame);
      else {
        const captured = captureFrontiers.get(key);
        if (captured !== undefined) echoes.push(frontier - captured);
      }
      continue;
    }
    if (stage === "capture" && !captureFrontiers.has(key)) captureFrontiers.set(key, integer(row[8], what));
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
  const cursor: number[] = [];
  for (const [, row, after] of pages.join("\n").matchAll(CURSOR_ROW)) cursor[Number(row)] = Number(after);
  return {
    client,
    dropped: { integrity: header.dropped, transport: headerCount(first, / dropped_from_export=(\d+)/), edges: headerCount(first, / edge_dropped=(\d+)/) },
    delay: distribution(delays), pressesWithoutPrediction: missing, ownEcho: distribution(echoes), lateness: distribution(lateness),
    rollbackDepth: distribution(depths), agreed, halts, cursor, cursorOffset: undefined,
  };
}

export function withCursorOffsets(clients: readonly ClientDelay[]): ClientDelay[] {
  const directory = (c: ClientDelay) => c.client.slice(0, c.client.lastIndexOf(" p"));
  return clients.map((client) => {
    const others = clients.filter((other) => other !== client && directory(other) === directory(client));
    const other = others.length === 1 ? others[0] : undefined;
    if (other === undefined) return client;
    const offsets: number[] = [];
    client.cursor.forEach((after, row) => {
      const theirs = other.cursor[row];
      if (theirs !== undefined && after >= 0 && theirs >= 0) offsets.push(after - theirs);
    });
    return { ...client, cursorOffset: distribution(offsets) };
  });
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
    "| Client | Agreed delay (epoch:D (requests)) | Input delay, frames: p50 / p95 / max | Presses without prediction | Own echo, frames | Edge-row lateness, frames | Rollback depth, frames | Cursor offset, frames | Window halts | Dropped: integrity / transport / edges |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...clients.map((c) => `| ${c.client} | ${c.agreed.join(", ") || "None"} | ${brief(c.delay)} | ${c.pressesWithoutPrediction} | ${brief(c.ownEcho)} | ${brief(c.lateness)} | ${brief(c.rollbackDepth)} | ${c.cursorOffset === undefined ? "None" : brief(c.cursorOffset)} | ${c.halts} | ${c.dropped.integrity} / ${c.dropped.transport} / ${c.dropped.edges} |`),
  ];
}
