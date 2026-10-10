import { expect, test } from "bun:test";
import { FARM_WORKFLOWS, MAIN_ONLY, admit, balanceTimeouts, liveness, revertedBy, type Facts } from "./farmGuard";

const sheriffRevert = {
  sha: "50cdde8af763923a4c3aa0e02bbabe36d06d57ae",
  message: "Revert the 4 commits landed in beb02b4038..343560f329\n\nRefs smashcraft#389\nSheriff-Reverts: 343560f329a66d6caa59fe91bb798dc303f6b306 728a9c18dbee386aea198bb060538866e8ca58a2 3603f3511da9edefe0b4f542d77bbd3156ba1a87 e3f8f299f9e775a024f0d2d5330e64ae8d4f4eeb\n",
};
const onMain = (sha: string): Facts => ({ workflow: "balance", sha, onMain: true, revertedBy: undefined, lane: undefined, onLane: false });

test("the farm's recorded runs of 2026-10-10: the orphaned Balance on a reverted commit stops, the lead's Balance on main runs, the scratch Balance is refused [spec docs/commands/farm.md]", () => {
  const orphan = "343560f329a66d6caa59fe91bb798dc303f6b306";
  const reverted = { ...onMain(orphan), revertedBy: revertedBy(orphan, [{ sha: "de818d65d6b60ccce99df93b8982d247bf5eb50e", message: "Fix strong hits (#389)" }, sheriffRevert]) };
  expect(liveness(reverted)).toEqual({ live: false, why: "343560f329a6 was reverted on main by 50cdde8af763" });
  expect(admit({ ...reverted, autoland: undefined }).kind).toBe("refuse");
  expect(liveness(onMain("de818d65d6b60ccce99df93b8982d247bf5eb50e")).live).toBe(true);
  const scratch: Facts = { ...onMain("9ff8890763640c0ddf50c14226b7060a9a7d0435"), onMain: false };
  expect(liveness(scratch).live).toBe(false);
  expect(admit({ ...scratch, autoland: undefined })).toEqual({ kind: "refuse", why: "9ff889076364 isn't on main: balance runs only on main or on a lane tip pushed to claude/NAME (--lane NAME)" });
  expect(admit({ ...scratch, lane: "claude/strong-hits", onLane: true, autoland: undefined })).toEqual({ kind: "dispatch", lane: "claude/strong-hits" });
  expect(admit({ ...scratch, workflow: "perf", autoland: undefined })).toEqual({ kind: "scratch" });
  expect(revertedBy("0a95238097b0", [{ sha: "x", message: "Revert \"Stage lights\"\n\nThis reverts commit 0a95238097b0f1e2.\n" }])).toBe("x");
});

test("farm test refuses a commit main's CI or Autoland already tests [spec docs/commands/farm.md]", () => {
  const unpushed: Facts = { workflow: "test", sha: "b67e02f60c2097de6f78addb8fbe796f4f4bfad3", onMain: false, revertedBy: undefined, lane: undefined, onLane: false };
  expect(admit({ ...unpushed, onMain: true, autoland: undefined }).kind).toBe("refuse");
  for (const description of ["queued", "bisect", "waiting to test alone", "testing alone on 1a2b3c4d", `passed alone on ${"a".repeat(40)} as tree ${"b".repeat(40)}`]) {
    expect(admit({ ...unpushed, autoland: { state: "pending", description } }).kind).toBe("refuse");
  }
  expect(admit({ ...unpushed, autoland: { state: "success", description: "landed as 1234567" } })).toEqual({ kind: "scratch" });
  expect(admit({ ...unpushed, autoland: { state: "failure", description: "failed alone on 1234567" } })).toEqual({ kind: "scratch" });
  expect(admit({ ...unpushed, autoland: undefined })).toEqual({ kind: "scratch" });
});

test("admission and the in-run guard agree: a dispatched run is live at its first job, and Balance, Playtest and soaks never go to a scratch branch [invariant]", () => {
  const lanes = [undefined, "claude/strong-hits", "farm/9ff889076364", "feature/x"];
  for (const workflow of FARM_WORKFLOWS) {
    for (const lane of lanes) {
      for (const bits of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const facts: Facts = { workflow, sha: "9ff8890763640c0ddf50c14226b7060a9a7d0435", onMain: (bits & 1) !== 0, revertedBy: (bits & 2) !== 0 ? "50cdde8af763" : undefined, lane, onLane: (bits & 4) !== 0 };
        for (const autoland of [undefined, { state: "pending", description: "queued" }]) {
          const admission = admit({ ...facts, autoland });
          if (admission.kind === "dispatch") expect(liveness({ ...facts, lane: admission.lane === "" ? undefined : admission.lane }).live).toBe(true);
          if (MAIN_ONLY.has(workflow)) expect(admission.kind).not.toBe("scratch");
          if (admission.kind === "refuse") expect(admission.why.length).toBeGreaterThan(0);
        }
      }
    }
  }
});

test("Balance job timeouts clear the longest measured jobs of 2026-10-08..10: shard 10.1 min at 400 a pair, probe 16.4 min at 40 [spec docs/commands/farm.md]", () => {
  const defaults = balanceTimeouts(400, 40);
  expect(defaults.shard).toBeGreaterThan(10.1);
  expect(defaults.probe).toBeGreaterThan(16.4);
  expect(balanceTimeouts(1000, 100).shard).toBeGreaterThan((10.1 * 1000) / 400);
  expect(balanceTimeouts(1000, 100).probe).toBeGreaterThan((16.4 * 100) / 40);
});
