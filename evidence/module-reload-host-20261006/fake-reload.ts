// Save -> both acknowledgements for `bun wisp hot --watch` with two fake
// clients: each polls its hot folder every 2 ms for the next manifest, reads
// the payload files the manifest names (the delta when its installed state is
// the manifest's base, else the full payload), and writes its acknowledgement.
// Host-side latency only: the fake clients do no Lua work and answer at once.
// Usage (from smashcraft ts/): bun ../evidence/module-reload-host-20261006/fake-reload.ts EDITS
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const edits = Number(process.argv[2] ?? "10");
const ts = process.cwd();
const root = mkdtempSync(join(tmpdir(), "fake-reload-"));
const prefix = "smashcraft";
const clients = ["a", "b"].map((name) => ({ name, data: join(root, name, "CustomMapData"), next: 1, state: "", read: 0 }));
for (const client of clients) mkdirSync(join(client.data, `${prefix}-hot`), { recursive: true });

const ack = (version: number) => `function PreloadFiles takes nothing returns nothing\n\tcall Preload( "applied ${version} at 0" )\nendfunction\n`;
const manifestLine = (text: string) => /BlzSetAbilityTooltip\('\$wsl', "([^"]*)", 0\)/.exec(text)?.[1];
const key = (sum: string) => sum.replace(":", "-");
const poll = setInterval(() => {
  for (const client of clients) {
    const folder = join(client.data, `${prefix}-hot`);
    const manifest = join(folder, `manifest-${client.next}.pld`);
    if (!existsSync(manifest)) continue;
    const line = manifestLine(readFileSync(manifest, "utf8"));
    if (line === undefined) continue;
    const fields = line.split(" ");
    let names: string[];
    if (fields.length === 3) {
      const [, files, sum] = fields;
      names = Array.from({ length: Number(files) }, (_, i) => `${key(sum!)}-${i}.pld`);
    } else {
      const [, state, files, base, changes] = fields;
      const delta = base !== "-" && base === client.state;
      names = delta
        ? Array.from({ length: Number(changes) }, (_, i) => `${key(state!)}-${key(base!)}-${i}.pld`)
        : Array.from({ length: Number(files) }, (_, i) => `${key(state!)}-${i}.pld`);
      client.state = state!;
    }
    let bytes = 0;
    for (const name of names) bytes += readFileSync(join(folder, name)).length;
    client.read = bytes;
    writeFileSync(join(client.data, `${prefix}-hot-ack-p${clients.indexOf(client)}.txt`), ack(client.next));
    client.next++;
  }
}, 2);

const watcher = Bun.spawn(["bun", "wisp", "hot", ...clients.flatMap((client) => ["--data", client.data]), "--watch"], { cwd: ts, stdout: "pipe", stderr: "pipe" });
const lines: string[] = [];
const waiters: ((line: string) => void)[] = [];
async function pump(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const chunk of stream) {
    pending += decoder.decode(chunk);
    let at;
    while ((at = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, at);
      pending = pending.slice(at + 1);
      lines.push(line);
      for (const waiter of waiters.splice(0)) waiter(line);
    }
  }
}
void pump(watcher.stdout);
void pump(watcher.stderr);
const until = (match: (line: string) => boolean, timeout = 60_000) => new Promise<string>((resolve, reject) => {
  const found = lines.find(match);
  if (found !== undefined) return resolve(found);
  const timer = setTimeout(() => reject(new Error(`timed out; output:\n${lines.join("\n")}`)), timeout);
  const check = (line: string) => {
    if (match(line)) {
      clearTimeout(timer);
      resolve(line);
    } else waiters.push(check);
  };
  waiters.push(check);
});

const file = join(ts, "src/platform/shell/diagnostics.ts");
const original = readFileSync(file, "utf8");
const samples: { version: number; saveToAcks: number; step: string; publish: string; clientBytes: number }[] = [];
try {
  await until((line) => line.startsWith("watching "));
  for (let edit = 1; edit <= edits; edit++) {
    await Bun.sleep(300);
    const version = edit + 1;
    const marker = lines.length;
    const saved = performance.now();
    writeFileSync(file, original.replace("`confirmed frame ", `\`confirmed frame fake-${edit} `));
    const report = await until((line) => line.includes(`v${version} running in 2 client(s)`));
    const saveToAcks = performance.now() - saved;
    const publish = lines.slice(marker).find((line) => line.includes(`publish v${version}`)) ?? "";
    samples.push({ version, saveToAcks, step: report.trim(), publish: publish.trim(), clientBytes: clients[0]!.read });
  }
} finally {
  writeFileSync(file, original);
  watcher.kill("SIGINT");
  clearInterval(poll);
}
await watcher.exited;
for (const sample of samples) console.log(`v${sample.version} ${sample.saveToAcks.toFixed(0)} ms | ${sample.step} | ${sample.publish} | client read ${sample.clientBytes} bytes`);
const sorted = samples.map((sample) => sample.saveToAcks).sort((a, b) => a - b);
console.log(`median save -> both acks ${((sorted[4]! + sorted[5]!) / 2).toFixed(0)} ms (n=${sorted.length}, min ${sorted[0]!.toFixed(0)}, max ${sorted.at(-1)!.toFixed(0)})`);
console.log(lines.filter((line) => /^\s+[\d.]+ s /.test(line)).join("\n"));
