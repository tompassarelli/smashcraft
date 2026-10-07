import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { checkHeadlessRun, REPRO_NAME, TRACE_FILE } from "../scripts/integrity/padParity";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { nativeDriverCommand } from "../src/platform/nativeDriver";
import { install, start } from "../src/platform/nativeDriverMain";

const runtime = installHeadless(SMASHCRAFT_HEADLESS);
afterAll(runtime.restore);
const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n${lines.map(line => `\tcall Preload( "${line}" )\n`).join("")}endfunction\n`;

test("headless checksum replay checks every real exported moment and refuses a changed checksum or broken export", () => {
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
