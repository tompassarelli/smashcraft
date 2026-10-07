import { mkdirSync, readFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { loadClients, windowPid } from "wisp/scripts/warcraft/desktop";
import { preloadLines } from "wisp/scripts/wisp/boundary";

const { values } = parseArgs({ options: {
  pair: { type: "string" }, "clients-file": { type: "string" }, helper: { type: "string" }, map: { type: "string" },
  route: { type: "string" }, out: { type: "string" }, grid: { type: "string", default: "100,100,508,508,1280,720" },
  "app-id": { type: "string", multiple: true }, matches: { type: "string", default: "20" }, plan: { type: "boolean" },
} });
const { pair, helper, map, route, out, grid } = values;
const clientsFile = values["clients-file"];
const matches = Number(values.matches);
if (pair === undefined || helper === undefined || map === undefined || clientsFile === undefined || out === undefined
  || (route !== "keys" && route !== "cursor") || !Number.isInteger(matches) || matches < 1) {
  throw new Error("Use --pair N --clients-file FILE --helper WC3_CONTROLLER --map MAP --route keys|cursor --out DIR --app-id NAME=ID twice [--matches 20] [--plan]");
}
const appIds = new Map(values["app-id"]?.map(entry => {
  const [name, id] = entry.split("=");
  if (name === undefined || id === undefined) throw new Error("--app-id takes NAME=ID");
  return [name, id];
}));
const plan = { pair, clientsFile, helper, map, route, grid, matches, out, calibration: ["start", "end"], startsClients: false };
if (values.plan) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
mkdirSync(out, { recursive: true });
await Bun.write(join(out, "plan.json"), JSON.stringify(plan, null, 2));

async function command(args: readonly string[]): Promise<void> {
  const child = Bun.spawn([process.execPath, "scripts/wisp.ts", ...args], { cwd: join(import.meta.dir, ".."), stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Failed: bun wisp ${args.join(" ")}`);
}

// Only the assigned pair's existing clients are used; their owner admits this run.
await command(["client", "watch", "--once", "--clients-file", clientsFile]);
await command(["lan", "fresh", map, "--pair", pair]);
const clients = await Effect.runPromise(loadClients(clientsFile));
if (clients.length !== 2) throw new Error("The assigned clients file must contain exactly two clients");
const data = clients.map(client => join(client.documents, "CustomMapData"));
const targets = await Promise.all(clients.map(async client => {
  const appId = appIds.get(client.name);
  if (appId === undefined) throw new Error(`Missing --app-id ${client.name}=ID`);
  const pid = await Effect.runPromise(windowPid(client));
  return { client, args: [helper, "--emit", "--display", client.x11.DISPLAY ?? "", "--x11-window", client.window,
    "--pid", `${pid}`, "--private-wlr-app-id", appId, "--watch-seconds", "900", "--cursor-grid", grid ?? ""] };
}));

// Receipts anchor each client's native clock to its own file publication time.
const anchors: { slot: number; nativeSeconds: number; hostPublicationMs: number }[] = [];
for (const [slot, target] of targets.entries()) {
  for (const corner of ["start", "end"]) {
    const path = join(data[slot] ?? "", `smashcraft-pad-calibration-p${slot}.txt`);
    const before = Date.now();
    const calibration = Bun.spawn([...target.args, "--cursor-calibrate", corner], {
      env: { ...Bun.env, ...target.client.x11, ...target.client.wayland }, stdout: "ignore", stderr: Bun.file(join(out, `calibration-${slot}-${corner}.log`)),
    });
    try {
      const deadline = before + 15000;
      let observed = false;
      while (Date.now() < deadline && calibration.exitCode === null) {
        try {
          const stat = statSync(path);
          const line = preloadLines(readFileSync(path, "utf8"))?.find(line => line.startsWith(`corner ${corner} `));
          const clock = line?.match(/native-seconds ([\d.]+)/)?.[1];
          if (stat.mtimeMs >= before && clock !== undefined) {
            anchors.push({ slot, nativeSeconds: Number(clock), hostPublicationMs: stat.mtimeMs });
            observed = true;
            break;
          }
        } catch {}
        await Bun.sleep(20);
      }
      if (!observed) throw new Error(`Client ${slot} did not observe the ${corner} cursor calibration`);
    } finally {
      calibration.kill("SIGTERM");
      await calibration.exited;
    }
  }
}
await Bun.write(join(out, "clock-anchors.json"), JSON.stringify(anchors, null, 2));

const startHelpers = (match: number) => targets.map((target, slot) => {
  const child = Bun.spawn([...target.args, "--virtual-pad", "--pad-ingress", route], {
    env: { ...Bun.env, ...target.client.x11, ...target.client.wayland }, stdin: "pipe",
    stdout: Bun.file(join(out, `helper-match-${match}-p${slot}.tsv`)), stderr: Bun.file(join(out, `helper-match-${match}-p${slot}.log`)),
  });
  return { child, async write(line: string) { child.stdin.write(`${line}\n`); await child.stdin.flush(); } };
});
let helpers: ReturnType<typeof startHelpers> = [];
const commands: { match: number; beat: number; slot: number; hostMs: number; lines: string[] }[] = [];
const records: { match: number; slot: number; file: string; seconds: number; networkEvents: number }[] = [];
try {
  for (let match = 1; match <= matches; match++) {
    await command(["client", "watch", "--once", "--clients-file", clientsFile]);
    if (match > 1) await command(["client", "chat", clients[0]?.name ?? "", "-dev reset", "--clients-file", clientsFile]);
    const started = Date.now();
    await command(["client", "chat", clients[0]?.name ?? "", "-dev quick", "--clients-file", clientsFile]);
    helpers = startHelpers(match);
    await Bun.sleep(500);
    const found = new Map<number, string>();
    for (let beat = 0; Date.now() - started < 240000 && found.size < 2; beat++) {
      for (const [slot, producer] of helpers.entries()) {
        if (producer.child.exitCode !== null) throw new Error(`Helper ${slot} exited before match ${match} finished`);
        const facing = slot === 0 ? 1 : -1;
        const toward = beat % 20 < 14 ? facing : -facing;
        const lines = [
          `axis leftx ${toward * (beat % 3 === 0 ? 16384 : 32767)}`,
          `axis lefty ${beat % 20 === 5 ? -16384 : beat % 20 === 6 ? 16384 : 0}`,
          `axis lefttrigger ${beat % 16 === 2 ? -7068 : beat % 16 === 3 ? 10000 : beat % 16 === 4 ? 32767 : -32768}`,
          `axis righttrigger ${beat % 16 === 6 ? 10000 : beat % 16 === 7 ? 32767 : -32768}`,
          `button a ${beat % 2}`, `button b ${beat % 7 === 0 ? 1 : 0}`, `button x ${beat % 5 === 0 ? 1 : 0}`,
        ];
        commands.push({ match, beat, slot, hostMs: Date.now(), lines });
        for (const line of lines) await producer.write(line);
      }
      for (const [slot, directory] of data.entries()) {
        const file = readdirSync(directory).find(file => file.startsWith(`smashcraft-pad-${route}-e`) && file.endsWith(`-p${slot}.txt`) && statSync(join(directory, file)).mtimeMs >= started);
        if (file !== undefined) found.set(slot, file);
      }
      await Bun.sleep(100);
    }
    if (found.size !== 2) throw new Error(`Match ${match} did not finish normally on both clients in four minutes`);
    for (const [slot, file] of found) {
      const source = join(data[slot] ?? "", file);
      const lines = preloadLines(readFileSync(source, "utf8")) ?? [];
      const header = lines[0] ?? "";
      const number = (field: string) => Number(header.match(new RegExp(`${field} ([\\d.]+)`))?.[1]);
      const seconds = number("finished") - number("started");
      copyFileSync(source, join(out, `match-${match}-p${slot}.txt`));
      records.push({ match, slot, file, seconds, networkEvents: number("mouse-events") + number("sync-events") });
    }
    await Bun.write(join(out, "commands.json"), JSON.stringify(commands));
    await Bun.write(join(out, "matches.json"), JSON.stringify(records, null, 2));
    for (const producer of helpers) producer.child.kill("SIGTERM");
    await Promise.all(helpers.map(producer => producer.child.exited));
    helpers = [];
    console.log(`Completed ${match}/${matches} ordinary one-stock matches (${route})`);
  }
} finally {
  for (const producer of helpers) producer.child.kill("SIGTERM");
  await Promise.all(helpers.map(producer => producer.child.exited));
  await Bun.write(join(out, "commands.json"), JSON.stringify(commands));
}
await command(["client", "watch", "--once", "--clients-file", clientsFile]);
console.log(`Raw comparison records: ${out}. Reconcile helper submissions, captured rows and native desync reports before choosing a route.`);
