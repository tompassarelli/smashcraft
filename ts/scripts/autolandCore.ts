export const TEST_SLOTS = 2;
export const TRAIN_CAP = 4;

export interface Status { readonly state: string; readonly description: string; readonly at: string }
export interface Lane { readonly branch: string; readonly tip: string; readonly status: Status | null }
export interface Run { readonly title: string; readonly status: string }

export const QUEUED = "queued";
export const WAITING = "waiting to test alone";
export const TRAIN_TITLE = "Autoland train";
export const testTitle = (slot: number, branch: string, tip: string): string => `Autoland test ${slot} ${branch} ${tip}`;
export const passedDescription = (base: string, tree: string): string => `passed alone on ${base} as tree ${tree}`;

const TEST_TITLE = /^Autoland test (\d+) (\S+) ([0-9a-f]{40})$/;
const PASSED = /^passed alone on ([0-9a-f]{40}) as tree ([0-9a-f]{40})$/;
// Runs started before the parallel queue name the branches they hold: "Autoland claude/a claude/b".
const LEGACY_TITLE = /^Autoland (claude\/\S+(?: claude\/\S+)*)$/;

type LaneState = "test" | "testing" | "passed" | "held" | "done";

export function passedAlone(lane: Lane): { readonly base: string; readonly tree: string } | undefined {
  const [, base, tree] = (lane.status?.state === "pending" ? PASSED.exec(lane.status.description) : null) ?? [];
  return base === undefined || tree === undefined ? undefined : { base, tree };
}

export function laneState(lane: Lane, runs: readonly Run[], retry: ReadonlySet<string> = new Set()): LaneState {
  if (lane.status !== null && lane.status.state !== "pending") return retry.has(lane.branch) ? "test" : "done";
  if (passedAlone(lane) !== undefined) return "passed";
  if (runs.some((run) => { const match = TEST_TITLE.exec(run.title); return match?.[2] === lane.branch && match[3] === lane.tip; })) return "testing";
  if (lane.status?.description === "bisect" && runs.some((run) => LEGACY_TITLE.exec(run.title)?.[1]?.split(" ").includes(lane.branch) === true)) return "held";
  return "test";
}

const byArrival = (lanes: readonly Lane[]): Lane[] => lanes.toSorted((a, b) => (a.status?.at ?? "").localeCompare(b.status?.at ?? "") || a.branch.localeCompare(b.branch));

interface TestOrder { readonly branch: string; readonly tip: string; readonly slot: number }
interface Plan { readonly test: readonly TestOrder[]; readonly train: boolean }

export function plan(lanes: readonly Lane[], runs: readonly Run[], retry: readonly string[] = []): Plan {
  const retried = new Set(retry);
  const load = Array.from({ length: TEST_SLOTS }, (_, slot) => runs.filter((run) => TEST_TITLE.exec(run.title)?.[1] === String(slot)).length);
  const test: TestOrder[] = [];
  let passed = false;
  for (const lane of byArrival(lanes)) {
    const state = laneState(lane, runs, retried);
    passed ||= state === "passed";
    if (state !== "test") continue;
    const slot = load.indexOf(Math.min(...load));
    load[slot] = (load[slot] ?? 0) + 1;
    test.push({ branch: lane.branch, tip: lane.tip, slot });
  }
  const trainWaiting = runs.some((run) => run.title === TRAIN_TITLE && run.status !== "in_progress");
  return { test, train: passed && !trainWaiting };
}

interface TrainLane { readonly branch: string; readonly tip: string; readonly base: string; readonly tree: string }

export function train(lanes: readonly Lane[]): TrainLane[] {
  return byArrival(lanes).flatMap((lane) => {
    const passed = passedAlone(lane);
    return passed === undefined ? [] : [{ branch: lane.branch, tip: lane.tip, ...passed }];
  }).slice(0, TRAIN_CAP);
}

type Verdict = "land" | "fail" | "retest";

export function judge(lanes: number, green: boolean): Verdict {
  if (green) return "land";
  return lanes === 1 ? "fail" : "retest";
}
