import { expect, test } from "bun:test";
import { BTN_SELECT } from "../scripts/integrity/linuxInput";
import { parsePadScript } from "../scripts/integrity/padScript";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkHeadlessRun, compareRuns, comparisonSteps, parseExpectations, parseTrace, scriptChat, unmetExpectations } from "../scripts/integrity/padParity";

test("comparison preflight requires the consumer's View export without changing action or capture steps [spec AGENTS.md]", () => {
  const actions = "150 a tap A 2\n154 a capture\n";
  for (const missing of [actions, `${actions}160 a tap VIEW 59`, `${actions}160 a press VIEW\n230 b release VIEW`, `${actions}160 a press VIEW\n180 a release VIEW\n190 a press VIEW\n230 a release VIEW`]) {
    expect(() => comparisonSteps(missing)).toThrow("comparison requires a replay export");
  }
  for (const exportHold of ["180 a tap VIEW 70", "180 b press VIEW\n250 b release VIEW", "180 a press VIEW\n200 a press VIEW\n250 a release VIEW"]) {
    const steps = comparisonSteps(`${actions}${exportHold}`);
    expect(steps.slice(0, 3)).toEqual(parsePadScript(actions));
  }
  const pads = join(import.meta.dir, "native", "pads");
  const scripts = [
    ...["rifleman", "illidan", "rifleman"].map((name) => join(pads, "156", `${name}.pad`)),
    ...readdirSync(join(pads, "163")).filter((name) => name.endsWith(".pad")).map((name) => join(pads, "163", name)),
  ];
  for (const path of scripts) {
    const script = readFileSync(path, "utf8");
    const steps = comparisonSteps(script);
    expect(steps).toEqual(parsePadScript(script));
    expect(steps.at(-2)?.frame).toBeGreaterThan(Math.max(...steps.filter((step) => step.kind === "capture").map((step) => step.frame)));
  }
});

test("a pad parity check reads the input trace's checksums and fighter lines and holds the script's expectations [spec AGENTS.md]", () => {
  const { checksums, events } = parseTrace([
    "45 0.750 confirmed frame 0 state 461891:9677",
    "72 1.200 participant 0 frame 60 phase 2 special 13 action-frame 1 x -240.000 z 0.000",
    "73 1.217 participant 0 frame 60 phase 2 received down 12",
    "132 2.200 participant 1 frame 118 phase 2 recovery down 0 actionable 0 hitlag 5 hitstun 13 damage 6.000",
    "132 2.200 participant 1 frame 118 phase 2 damage pose 1 hitlag 5 hitstun 13 x 240.000 z 0.000 launch 5.098:3.570",
    "165 2.750 confirmed frame 110 state 196331:389408",
  ]);
  expect([...checksums]).toEqual([[0, "461891:9677"], [110, "196331:389408"]]);
  // Presentation and key lines are left out: only confirmed changes are compared.
  expect(events.map((event) => [event.slot, event.frame])).toEqual([[0, 60], [1, 118]]);
  const expectations = parseExpectations("60 a tap X 2\n#! expect a 60 special 13\n#! absent b 100-110 recovery\n#! expect b 118 special");
  expect(unmetExpectations({ checksums, events }, expectations, "native")).toEqual([
    "native script line 4 (expect b 118 special): no such line; nearby: 118 phase 2 recovery down 0 actionable 0 hitlag 5 hitstun 13 damage 6.000",
  ]);
  expect(() => parseExpectations("#! expects a 1 x")).toThrow("line 1");
});

test("a native pad run that desynced, crashed or ended early is invalid, neither pass nor fail [spec AGENTS.md]", () => {
  const root = mkdtempSync(join(tmpdir(), "pad-parity-"));
  const [native, headless] = [join(root, "native"), join(root, "headless")];
  mkdirSync(native);
  mkdirSync(headless);
  writeFileSync(join(native, "result.json"), JSON.stringify({ invalid: ["client a wrote a desync report (Errors/2026-10-07_064512)"] }));
  writeFileSync(join(headless, "result.json"), JSON.stringify({ off_frame: 0, helpers_stopped: [] }));
  const report = compareRuns(native, headless, "60 a tap X 2");
  expect(report).toEqual({ passed: false, invalid: true, lines: ["INVALID: desynced, rerun: client a wrote a desync report (Errors/2026-10-07_064512)"] });
  rmSync(root, { recursive: true });
});

test("headless pad checks require a saved checksum even when edges and event expectations match [spec AGENTS.md]", () => {
  const root = mkdtempSync(join(tmpdir(), "pad-headless-"));
  writeFileSync(join(root, "result.json"), JSON.stringify({ off_frame: 0, helpers_stopped: [] }));
  // The trace is a Warcraft Preload file, as the integrity build writes it.
  const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n${lines.map((line) => `\tcall Preload( "${line}" )\n`).join("")}endfunction\n`;
  writeFileSync(join(root, "trace-a.txt"), preload([
    "72 1.200 participant 0 frame 60 phase 2 special 13 action-frame 1 x -240.000 z 0.000",
    "165 2.750 confirmed frame 110 state 196331:389408",
  ]));
  expect(checkHeadlessRun(root, "60 a tap X 2\n#! expect a 60 special 13").lines).toContain("FAIL headless: no moment saved (hold View a second in the script)");
  const failed = checkHeadlessRun(root, "60 a tap X 2\n#! expect b 60 special 13");
  expect([failed.passed, failed.lines.at(-1)]).toEqual([false, "FAIL: 2 problems"]);
  rmSync(root, { recursive: true });
});
test("every native check script parses, names its match, starts after the helpers see it and saves a moment [spec AGENTS.md]", () => {
  const folder = join(import.meta.dir, "native", "pads");
  const scripts = readdirSync(folder).filter((name) => name.endsWith(".pad"));
  expect(scripts.length).toBeGreaterThan(0);
  for (const name of scripts) {
    const script = readFileSync(join(folder, name), "utf8");
    const steps = parsePadScript(script);
    expect([name, scriptChat(script)?.startsWith("-dev quick")]).toEqual([name, true]);
    expect([name, (steps.find((step) => step.kind === "edge")?.frame ?? 0) >= 15]).toEqual([name, true]);
    // View held a second asks for the moment the parity check replays.
    const view = steps.filter((step) => step.kind === "edge" && step.edges.some((edge) => edge.code === BTN_SELECT));
    expect([name, view.length >= 2 && view.length % 2 === 0 && view.every((press, index) => index % 2 === 1 || (view[index + 1]?.frame ?? 0) - press.frame >= 60)]).toEqual([name, true]);
    expect([name, parseExpectations(script).length > 0]).toEqual([name, true]);
  }
});
