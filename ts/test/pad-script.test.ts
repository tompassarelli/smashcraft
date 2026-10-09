import { expect, test } from "bun:test";
import { BTN_SELECT } from "../scripts/integrity/linuxInput";
import { parsePadScript } from "../scripts/integrity/padScript";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseExpectations, parseTrace, scriptChat, unmetExpectations } from "../scripts/integrity/padParity";

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

  expect(events.map((event) => [event.slot, event.frame])).toEqual([[0, 60], [1, 118]]);
  const expectations = parseExpectations("60 a tap X 2\n#! expect a 60 special 13\n#! absent b 100-110 recovery\n#! expect b 118 special");
  expect(unmetExpectations({ checksums, events }, expectations, "native")).toEqual([
    "native script line 4 (expect b 118 special): no such line; nearby: 118 phase 2 recovery down 0 actionable 0 hitlag 5 hitstun 13 damage 6.000",
  ]);
  expect(() => parseExpectations("#! expects a 1 x")).toThrow("line 1");
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

    const view = steps.filter((step) => step.kind === "edge" && step.edges.some((edge) => edge.code === BTN_SELECT));
    expect([name, view.length >= 2 && view.length % 2 === 0 && view.every((press, index) => index % 2 === 1 || (view[index + 1]?.frame ?? 0) - press.frame >= 60)]).toEqual([name, true]);
    expect([name, parseExpectations(script).length > 0]).toEqual([name, true]);
  }
});
