import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { keyboardPadPlan } from "../scripts/nativeKeyboardPad";
import { frameWriteNs } from "../scripts/integrity/padScript";

test("keyboard timing retains all original pause pad edges and the three-second Start gap", () => {
  const plan = keyboardPadPlan(readFileSync(`${import.meta.dir}/native/pads/206/pause-dash.pad`, "utf8"));
  expect(plan).toHaveLength(10);
  expect(plan.map(item => item.frame)).toEqual([160, 160, 168, 169, 348, 349, 350, 350, 390, 460]);
  expect(plan.map(item => item.command)).toEqual(["axis leftx 32767", "axis lefty 0", "button start 1", "button start 0", "button start 1", "button start 0", "axis leftx 0", "axis lefty 0", "button back 1", "button back 0"]);
  expect(frameWriteNs(0, 348) - frameWriteNs(0, 168)).toBe(3_000_000_000);
});
