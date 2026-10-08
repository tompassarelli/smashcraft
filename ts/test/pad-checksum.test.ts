import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { checkHeadlessRun, REPRO_NAME, TRACE_FILE } from "../scripts/integrity/padParity";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { readReplay } from "../scripts/wisp/replayFiles";
import { install as installDev, start as startDev } from "../src/platform/devMain";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { install, start } from "../src/platform/nativeDriverMain";

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(runtime.restore);
const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n${lines.map(line => `\tcall Preload( "${line}" )\n`).join("")}endfunction\n`;

test("headless checksum replay checks every real exported moment and refuses a changed checksum or broken export [native]", () => {
  const clients = runtime.clients({ install, start }, [0, 1]);
  clients.start();
  clients.frames(3);
  const script = "#! chat -dev quick hero archer\n15 a tap A 2\n40 b tap B 8\n120 a capture\n";
  clients.everywhere(() => nativeDriverCommand(script));
  clients.everywhere(() => nativeDriverCommand("resume 120"));
  clients.frames(150);
  const root = mkdtempSync(join(tmpdir(), "pad-checksum-"));
  try {
    writeFileSync(join(root, "result.json"), JSON.stringify({ off_frame: 0, helpers_stopped: [] }));
    const saved: [string, readonly string[]][] = [];
    for (const client of clients.clients) {
      for (const [name, lines] of client.files) {
        if (!REPRO_NAME.test(name)) continue;
        writeFileSync(join(root, name), preload(lines));
        saved.push([name, lines]);
      }
    }
    writeFileSync(join(root, "trace-a.txt"), preload(clients.client(0).files.get(TRACE_FILE) ?? []));
    expect(saved.length).toBeGreaterThanOrEqual(2);
    const report = checkHeadlessRun(root, script);
    expect(report.passed).toBe(true);
    expect(report.lines).toContain(`checksums: ${saved.length}/${saved.length} exported moments replay equal (${saved.length * 120} frames)`);
    const [name, lines] = saved[saved.length - 1] ?? ["", []];
    writeFileSync(join(root, name), preload(lines.map(line => line.startsWith("checksum ") ? "checksum changed" : line)));
    expect(checkHeadlessRun(root, script).lines.some(line => line.startsWith(`FAIL checksum replay ${name}:`))).toBe(true);
    writeFileSync(join(root, name), "broken export");
    expect(checkHeadlessRun(root, script).lines.some(line => line.startsWith(`FAIL checksum replay ${name}: not a repro`))).toBe(true);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("a match ending before the View hold completes checks its full replay, including the final checksum [invariant]", () => {
  const clients = runtime.clients({ install: installDev, start: startDev }, [0, 1]);
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev pain middle large beastmaster");
  clients.frames(300);
  const root = mkdtempSync(join(tmpdir(), "pad-ended-checksum-"));
  try {
    writeFileSync(join(root, "result.json"), JSON.stringify({ off_frame: 0, helpers_stopped: [] }));
    writeFileSync(join(root, "trace-a.txt"), preload([]));
    const matches: string[] = [];
    for (const client of clients.clients) {
      expect(client.errors).toEqual([]);
      const data = join(root, `client-${client.slot}`, "CustomMapData");
      mkdirSync(data, { recursive: true });
      for (const [name, lines] of client.files) if (/^smashcraft-replay-/.test(name)) writeFileSync(join(data, name), preload(lines));
      const manifest = [...client.files.keys()].find(name => /^smashcraft-replay-\d+\.txt$/.test(name));
      expect(manifest).toBeDefined();
      const saved = readReplay(join(data, manifest ?? ""));
      if (typeof saved === "string") throw new Error(saved);
      const name = `smashcraft-replay-p${client.slot}-1.txt`;
      writeFileSync(join(root, name), `${saved.join("\n")}\n`);
      matches.push(name);
    }
    const report = checkHeadlessRun(root, "");
    expect(report.passed).toBe(true);
    expect(report.lines.some(line => line.startsWith("checksums: 2/2 exported full matches replay equal"))).toBe(true);
    const name = matches[1] ?? "";
    const saved = readReplay(join(root, name));
    if (typeof saved === "string") throw new Error(saved);
    writeFileSync(join(root, name), saved.map(line => line.startsWith("checksum ") ? "checksum changed" : line).join("\n"));
    expect(checkHeadlessRun(root, "").passed).toBe(false);
    writeFileSync(join(root, name), "broken export");
    expect(checkHeadlessRun(root, "").passed).toBe(false);
  } finally {
    rmSync(root, { recursive: true });
  }
});
