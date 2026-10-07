import { mkdirSync, readFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { loadClients, windowPid, keys, typeText } from "wisp/scripts/warcraft/desktop";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { Phase } from "../src/game/match/rules";

const { values } = parseArgs({ options: {
  pair: { type: "string" }, "clients-file": { type: "string" }, helper: { type: "string" }, map: { type: "string" },
  out: { type: "string" }, "app-id": { type: "string", multiple: true }, plan: { type: "boolean" },
} });
const { pair, helper, map, out } = values;
const clientsFile = values["clients-file"];
if (pair === undefined || helper === undefined || map === undefined || clientsFile === undefined || out === undefined) {
  throw new Error("Use --pair N --clients-file FILE --helper WC3_CONTROLLER --map MAP --out DIR --app-id NAME=ID twice [--plan]");
}
const script = JSON.parse(readFileSync(join(import.meta.dir, "../test/native/pads/233/pad-cut.json"), "utf8")) as {
  setup: string; cut: { client: string; afterMilliseconds: number; milliseconds: number };
  combat: { beatMilliseconds: number; deadlineMilliseconds: number };
};
const appIds = new Map(values["app-id"]?.map(entry => {
  const split = entry.indexOf("=");
  if (split < 1) throw new Error("--app-id takes NAME=ID");
  return [entry.slice(0, split), entry.slice(split + 1)];
}));
const plan = { pair, clientsFile, helper, map, out, script, startsClients: false };
if (values.plan) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
mkdirSync(out, { recursive: true });
await Bun.write(join(out, "plan.json"), JSON.stringify(plan, null, 2));
async function command(args: readonly string[]) {
  const child = Bun.spawn([process.execPath, "scripts/wisp.ts", ...args], { cwd: join(import.meta.dir, ".."), stdout: "inherit", stderr: "inherit" });
  if (await child.exited !== 0) throw new Error(`Failed: bun wisp ${args.join(" ")}`);
}
await command(["client", "watch", "--once", "--clients-file", clientsFile]);
const hostedAt = Date.now();
await command(["lan", "fresh", map, "--pair", pair]);
const clients = await Effect.runPromise(loadClients(clientsFile));
if (clients.length !== 2 || clients.some(client => !/^lan\d+[ab]$/.test(client.name) || client.x11.DISPLAY === ":0")) {
  throw new Error("Use the assigned offline LAN pair on its private displays");
}
const data = clients.map(client => join(client.documents, "CustomMapData"));
const readyDeadline = Date.now() + 8000;
while (!data.every(directory => {
  try { return statSync(join(directory, "wc3-melee-ready.txt")).mtimeMs >= hostedAt; } catch { return false; }
})) {
  if (Date.now() >= readyDeadline) throw new Error("Both clients did not publish fresh keyboard readiness");
  await Bun.sleep(50);
}
const fresh = Date.now();
const baseline = data.map(directory => new Set(readdirSync(directory)));
const producers = await Promise.all(clients.map(async (client, slot) => {
  const appId = appIds.get(client.name);
  if (appId === undefined) throw new Error(`Missing --app-id ${client.name}=ID`);
  const pid = await Effect.runPromise(windowPid(client));
  const child = Bun.spawn([helper, "--emit", "--virtual-pad", "--display", client.x11.DISPLAY ?? "", "--x11-window", client.window,
    "--pid", String(pid), "--private-wlr-app-id", appId, "--watch-seconds", "300"], {
    env: { ...Bun.env, ...client.x11, ...client.wayland }, stdin: "pipe",
    stdout: Bun.file(join(out, `helper-p${slot}.tsv`)), stderr: Bun.file(join(out, `helper-p${slot}.log`)),
  });
  return { child, async write(line: string) { child.stdin.write(`${line}\n`); await child.stdin.flush(); } };
}));
const host = clients[0];
if (host === undefined) throw new Error("Missing LAN host");
const timeline: { event: string; hostMs: number; monotonicNs: string; frames?: (number | undefined)[] }[] = [];
const frame = (directory: string, slot: number) => {
  try {
    const lines = preloadLines(readFileSync(join(directory, `smashcraft-drawn-typescript-native-input-p${slot}.txt`), "utf8")) ?? [];
    return Number(lines.join(" ").match(/frame=(\d+)/)?.[1]);
  } catch { return undefined; }
};
const note = (event: string) => timeline.push({ event, hostMs: Date.now(), monotonicNs: process.hrtime.bigint().toString(), frames: data.map(frame) });
let stopped = false;
try {
  await Bun.sleep(300);
  for (const client of clients) await Effect.runPromise(keys(client, "ctrl+g"));
  await Effect.runPromise(keys(host, "Escape", "Return"));
  await Effect.runPromise(typeText(host, script.setup));
  await Effect.runPromise(keys(host, "Return"));
  await Bun.sleep(500);
  const started = Date.now();
  note("match-input-start");
  let cut = false;
  const records = new Map<number, { file: string; lines: readonly string[] }>();
  for (let beat = 0; Date.now() - started < script.combat.deadlineMilliseconds && records.size < 2; beat++) {
    if (!cut && Date.now() - started >= script.cut.afterMilliseconds) {
      const producer = producers[0];
      if (producer === undefined) throw new Error("Missing cut producer");
      note("pad-cut-start");
      producer.child.kill("SIGSTOP");
      stopped = true;
      await Bun.sleep(script.cut.milliseconds);
      producer.child.kill("SIGCONT");
      stopped = false;
      note("pad-cut-end");
      cut = true;
    }
    for (const [slot, producer] of producers.entries()) {
      if (producer.child.exitCode !== null) throw new Error(`Pad producer ${slot} exited early`);
      const direction = (slot === 0 ? 1 : -1) * (beat % 20 < 14 ? 1 : -1);
      for (const line of [`axis leftx ${direction * 32767}`, `axis lefty ${beat % 20 === 5 ? -16384 : 0}`,
        `button a ${beat % 2}`, `button b ${beat % 7 === 0 ? 1 : 0}`, `button x ${beat % 5 === 0 ? 1 : 0}`]) await producer.write(line);
    }
    for (const [slot, directory] of data.entries()) {
      const name = readdirSync(directory).find(name => /^smashcraft-match-\d+\.txt$/.test(name)
        && !baseline[slot]?.has(name) && statSync(join(directory, name)).mtimeMs >= fresh);
      if (name !== undefined) records.set(slot, { file: name, lines: preloadLines(readFileSync(join(directory, name), "utf8")) ?? [] });
    }
    await Bun.sleep(script.combat.beatMilliseconds);
  }
  if (!cut || records.size !== 2) throw new Error("The cut did not complete before both clients reached normal results");
  const cutStart = timeline.find(event => event.event === "pad-cut-start");
  const cutEnd = timeline.find(event => event.event === "pad-cut-end");
  if (cutStart === undefined || cutEnd === undefined) throw new Error("No recorded controller cut interval");
  const cutMilliseconds = Number(BigInt(cutEnd.monotonicNs) - BigInt(cutStart.monotonicNs)) / 1e6;
  if (cutMilliseconds < 1000 || cutMilliseconds >= 2000) throw new Error(`Controller cut was ${cutMilliseconds} ms, expected 1 s`);
  for (let slot = 0; slot < 2; slot++) {
    const before = cutStart.frames?.[slot];
    const after = cutEnd.frames?.[slot];
    if (before === undefined || after === undefined || !(after > before)) throw new Error(`Client ${slot} did not advance through the controller cut`);
  }
  for (const client of clients) await Effect.runPromise(keys(client, "ctrl+h"));
  await Bun.sleep(6000);
  const outcomes: string[] = [];
  let callbacks = 0;
  let ownWaiting = 0;
  let anyWaiting = 0;
  for (const [slot, directory] of data.entries()) {
    const record = records.get(slot);
    if (record === undefined) throw new Error(`Missing match record on client ${slot}`);
    const result = record.lines.find(line => line.startsWith("result ")) ?? "";
    if (!result.includes("interrupted=0")) throw new Error(`Client ${slot} match did not end normally: ${result}`);
    outcomes.push(result);
    copyFileSync(join(directory, record.file), join(out, `p${slot}-${record.file}`));
    const pages = readdirSync(directory).filter(name => /^smashcraft-response-p\d+-run\d+-page\d+\.txt$/.test(name)
      && statSync(join(directory, name)).mtimeMs >= fresh);
    if (pages.length === 0) throw new Error(`No callback export for client ${slot}`);
    const rows = new Map<number, { before?: number; after?: number; phase?: number }>();
    let measuredWaiting: { any: number; own: number } | undefined;
    for (const name of pages) {
      copyFileSync(join(directory, name), join(out, `p${slot}-${name}`));
      for (const line of preloadLines(readFileSync(join(directory, name), "utf8")) ?? []) {
        const waiting = /^waiting callbacks=(\d+) own_callbacks=(\d+)$/.exec(line);
        if (waiting !== null) measuredWaiting = { any: Number(waiting[1]), own: Number(waiting[2]) };
        const words = line.split(" ");
        const row = Number(words[1]);
        if (words[0] === "A") rows.set(row, { ...rows.get(row), before: Number(words[7]), after: Number(words[8]) });
        if (words[0] === "B") rows.set(row, { ...rows.get(row), phase: Number(words[6]) });
      }
    }
    if (measuredWaiting === undefined) throw new Error(`No actual HUD waiting count for client ${slot}`);
    ownWaiting += measuredWaiting.own;
    anyWaiting += measuredWaiting.any;
    let through = 0;
    for (const row of rows.values()) if (row.phase === Phase.match && row.before !== undefined && row.after !== undefined && row.after >= 0) {
      callbacks++;
      through = Math.max(through, row.after);
    }
    const ended = Number(result.match(/frames=(\d+)/)?.[1]);
    if (!(through >= ended)) throw new Error(`Client ${slot} callback recording ends at ${through}, before match frame ${ended}`);
  }
  if (outcomes[0] !== outcomes[1]) throw new Error("Clients disagree on the normal match result");
  if (callbacks < 60 || anyWaiting !== 0) throw new Error(`${anyWaiting} callbacks showed Waiting, ${ownWaiting} for the local player, out of ${callbacks}`);
  await Bun.write(join(out, "result.json"), JSON.stringify({ passed: true, cutMilliseconds, callbacks, ownWaiting, anyWaiting, outcomes, timeline }, null, 2));
  console.log(`PASS #233: ${callbacks} recorded callbacks, ${ownWaiting} waiting; both clients ended normally`);
} finally {
  if (stopped) producers[0]?.child.kill("SIGCONT");
  for (const producer of producers) producer.child.kill("SIGTERM");
  await Promise.all(producers.map(producer => producer.child.exited));
  await Bun.write(join(out, "timeline.json"), JSON.stringify(timeline, null, 2));
}
await command(["client", "watch", "--once", "--clients-file", clientsFile]);
