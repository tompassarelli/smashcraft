import { expect, test } from "bun:test";
import { ABS_X, ABS_Y, ABS_Z, BTN_A, BTN_SELECT, EV_ABS, EV_KEY } from "../scripts/integrity/linuxInput";
import { deadlineOrder, frameWriteNs, landEdges, matchStart, parsePadScript, publishedFrame, ruleFrame } from "../scripts/integrity/padScript";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkHeadlessRun, compareRuns, comparisonSteps, parseExpectations, parseTrace, scriptChat, unmetExpectations } from "../scripts/integrity/padParity";

test("comparison preflight requires the consumer's View export without changing action or capture steps", () => {
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
    ...["archer", "illidan", "rifleman"].map((name) => join(pads, "156", `${name}.pad`)),
    ...readdirSync(join(pads, "163")).filter((name) => name.endsWith(".pad")).map((name) => join(pads, "163", name)),
  ];
  for (const path of scripts) {
    const script = readFileSync(path, "utf8");
    const steps = comparisonSteps(script);
    expect(steps).toEqual(parsePadScript(script));
    expect(steps.at(-2)?.frame).toBeGreaterThan(Math.max(...steps.filter((step) => step.kind === "capture").map((step) => step.frame)));
  }
});

test("a pad script becomes frame-ordered edges, a tap a press and its release", () => {
  const steps = parsePadScript(`
    # Lich: Frost Nova, then the burst
    181 a tap A 2
    +45 a stick -1 0.5   # left, half up
    226 b shield 1
    230 b capture
  `);
  expect(steps.map((step) => [step.frame, step.slot, step.kind])).toEqual([[181, 0, "edge"], [183, 0, "edge"], [226, 0, "edge"], [226, 1, "edge"], [230, 1, "capture"]]);
  const [press, release, stick, shield] = steps;
  expect(press?.kind === "edge" ? press.edges : []).toEqual([{ type: EV_KEY, code: BTN_A, value: 1 }]);
  expect(release?.kind === "edge" ? release.edges : []).toEqual([{ type: EV_KEY, code: BTN_A, value: 0 }]);
  // Up is positive in a script and negative on the pad's Y axis.
  expect(stick?.kind === "edge" ? stick.edges : []).toEqual([{ type: EV_ABS, code: ABS_X, value: -32767 }, { type: EV_ABS, code: ABS_Y, value: -16383 }]);
  expect(shield?.kind === "edge" ? shield.edges : []).toEqual([{ type: EV_ABS, code: ABS_Z, value: 32767 }]);
});

test("a malformed pad script line names itself", () => {
  expect(() => parsePadScript("10 c press A")).toThrow("line 1");
  expect(() => parsePadScript("10 a press Q")).toThrow("unknown button Q");
  expect(() => parsePadScript("20 a press A\n10 a release A")).toThrow("comes before");
});

test("two-client pad steps follow actual deadlines when B starts 58.678 ms before A", () => {
  const epochs = [75573308340758, 75573249662704] as const;
  const steps = parsePadScript("60 a press A\n60 b press A\n61 a release A\n61 b release A\n62 a capture\n62 b capture");
  const ordered = deadlineOrder(steps, epochs);
  expect(ordered.map((item) => [item.frame, item.slot])).toEqual([[60, 1], [61, 1], [62, 1], [60, 0], [61, 0], [62, 0]]);
  const deadlines = ordered.map((item) => frameWriteNs(epochs[item.slot], item.frame));
  expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));
});

test("edges land on the frames a fake helper journaled them on", () => {
  // The helper's log lines as wc3-journal writes them (bot-four capture, 7 Oct).
  const log = [
    "match_start epoch=1 epoch_ns=34282443282605 first_frame=1 read_ns=34282443762949 uncertainty_ns=1100090",
    "event mono_ns=34285446238000 frame=181 held=32 pressed=32 released=0",
    "published_frame=181",
  ].join("\n");
  const start = matchStart(log);
  expect(start).toEqual({ epoch: 1, epochNs: 34282443282605, firstFrame: 1, frameOneNs: 34282443282605 });
  expect(publishedFrame(log)).toBe(181);
  const epochNs = start?.epochNs ?? 0;
  // The write time of a frame falls on that frame by the helper's rule.
  for (const frame of [1, 181, 1309]) expect(ruleFrame(epochNs, frameWriteNs(epochNs, frame))).toBe(frame);
  const landed = landEdges([
    { line: 1, text: "181 a press X", slot: 0, planned: 181, injectedNs: 34285446238000 },
    { line: 2, text: "190 a stick 1 0", slot: 0, planned: 190, injectedNs: 34285600000000 },
  ], [log, ""]);
  expect(landed.map((edge) => edge.landed)).toEqual([181, undefined]);
});

test("D2 pad deadlines retain the helper publication's frame-three clock and exact-frame gate", () => {
  const epochNs = 34282443282605;
  const start = matchStart(`match_start epoch=1 epoch_ns=${epochNs} first_frame=3 read_ns=34282443762949 uncertainty_ns=1100090`);
  expect(start?.epochNs).toBe(epochNs);
  expect(start?.firstFrame).toBe(3);
  if (start === undefined) throw new Error("missing match start");
  for (const planned of [15, 200, 1309]) {
    const injectedNs = frameWriteNs(start.frameOneNs, planned);
    const actual = start.firstFrame + Math.floor((injectedNs - start.epochNs) * 60 / 1e9);
    expect(actual).toBe(planned);
    expect(ruleFrame(start.frameOneNs, injectedNs)).toBe(planned);
  }
  // The old origin injects two frames late; correcting an observation cannot
  // make that late stimulus pass the original planned-frame comparison.
  expect(start.firstFrame + Math.floor((frameWriteNs(epochNs, 200) - epochNs) * 60 / 1e9)).toBe(202);
  expect(matchStart(`match_start epoch=1 epoch_ns=${epochNs} read_ns=34282443762949 uncertainty_ns=1100090`)).toBeUndefined();
});

test("a pad parity check reads the input trace's checksums and fighter lines and holds the script's expectations", () => {
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

test("shield tilt is a compared fighter event and can satisfy cardinal pad expectations", () => {
  const trace = parseTrace(["80 1.333 participant 0 frame 70 phase 2 shield tilt x 0.000 z 0.650 raised 1 grounded 1 roll 0 jump 0"]);
  const expectations = parseExpectations("#! expect a 70 shield tilt x 0.000 z 0.650 raised 1 grounded 1 roll 0 jump 0");
  expect(unmetExpectations(trace, expectations, "headless")).toEqual([]);
  expect(trace.events).toHaveLength(1);
});

test("a native pad run that desynced, crashed or ended early is invalid, neither pass nor fail", () => {
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


test("a headless pad run alone passes when its edges landed and the script's expectations hold in its trace", () => {
  const root = mkdtempSync(join(tmpdir(), "pad-headless-"));
  writeFileSync(join(root, "result.json"), JSON.stringify({ off_frame: 0, helpers_stopped: [] }));
  // The trace is a Warcraft Preload file, as the integrity build writes it.
  const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n${lines.map((line) => `\tcall Preload( "${line}" )\n`).join("")}endfunction\n`;
  writeFileSync(join(root, "trace-a.txt"), preload([
    "72 1.200 participant 0 frame 60 phase 2 special 13 action-frame 1 x -240.000 z 0.000",
    "165 2.750 confirmed frame 110 state 196331:389408",
  ]));
  expect(checkHeadlessRun(root, "60 a tap X 2\n#! expect a 60 special 13").passed).toBe(true);
  const failed = checkHeadlessRun(root, "60 a tap X 2\n#! expect b 60 special 13");
  expect([failed.passed, failed.lines.at(-1)]).toEqual([false, "FAIL: 1 problem"]);
  rmSync(root, { recursive: true });
});
test("every native check script parses, names its match, starts after the helpers see it and saves a moment", () => {
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
