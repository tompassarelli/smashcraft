import { expect, test } from "bun:test";

const source = (path: string) => Bun.file(new URL(path, import.meta.url)).text();

test("optional pose and impact state use undefined, not Wurst's -1 sentinel", async () => {
  const [pose, impacts, probe, view] = await Promise.all([
    source("../src/game/presentation/fighterPose.ts"),
    source("../src/game/presentation/impactState.ts"),
    source("../src/platform/shell/responseProbe.ts"),
    source("../src/platform/shell/view.ts"),
  ]);

  expect(pose).toContain("clipIndex: number | undefined;");
  expect(pose).toContain('clipIndex: undefined, clipName: "stand"');
  expect(impacts).toContain("readonly ages: (number | undefined)[];");
  expect(impacts).toContain("ages: filled<number | undefined>(IMPACT_COUNT, undefined)");
  expect(probe).toContain("epoch: number | undefined;");
  expect(probe).toContain("sendMs: number | undefined;");
  expect(probe).toContain("receiveMs: number | undefined;");
  expect(view).toContain("pose.clipIndex !== undefined");
});
