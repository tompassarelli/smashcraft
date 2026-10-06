import { expect, test } from "bun:test";
import { ABS_X, ABS_Y, ABS_Z, BTN_A, EV_ABS, EV_KEY } from "../scripts/integrity/linuxInput";
import { frameWriteNs, landEdges, matchStart, parsePadScript, publishedFrame, ruleFrame } from "../scripts/integrity/padScript";

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

test("edges land on the frames a fake helper journaled them on", () => {
  // The helper's log lines as wc3-journal writes them (bot-four capture, 7 Oct).
  const log = [
    "match_start epoch=1 epoch_ns=34282443282605 read_ns=34282443762949 uncertainty_ns=1100090",
    "event mono_ns=34285446238000 frame=181 held=32 pressed=32 released=0",
    "published_frame=181",
  ].join("\n");
  const start = matchStart(log);
  expect(start).toEqual({ epoch: 1, epochNs: 34282443282605 });
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
