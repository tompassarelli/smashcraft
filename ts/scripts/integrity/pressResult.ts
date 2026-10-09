









import { writeFileSync } from "node:fs";
import { Effect } from "effect";
import { readEvidence, readMetadata } from "./evidence";
import { type LocalStart, type StallSide, capturePair, distribution, integrityResult } from "./reconcile";

const [out, ...directories] = process.argv.slice(2);
if (out === undefined || directories.length === 0) throw new Error("usage: bun scripts/integrity/pressResult.ts OUT.json CAPTURE_DIR ...");

const MIN_PRESSES = 1000;

const ACTIONS: Readonly<Record<string, readonly string[]>> = {
  attack: ["attack"],
  jump: ["jump", "jump-b", "jump-y"],
  special: ["special"],
  shield: ["shield", "shield-lt", "shield-rt"],
  dash: ["dash-left", "dash-right"],
  "c-stick": ["c-left", "c-right", "c-up", "c-down"],
  grab: ["grab"],
  move: ["move-left", "move-right", "move-down", "move-up"],
};
const SIDES: readonly StallSide[] = ["none", "opponent", "own"];

const RECOVERY_FRAMES = 60;

const measured = (starts: readonly LocalStart[]) => starts.flatMap((start) => (start.delay === undefined ? [] : [start.delay]));
const bySide = (starts: readonly LocalStart[]) =>
  Object.fromEntries(SIDES.map((side) => {
    const of = starts.filter((start) => start.stall === side);
    return [side, { ...distribution(measured(of)), missing_first_prediction: of.filter((start) => start.delay === undefined).length }];
  }));

const captures = await Effect.runPromise(Effect.forEach(directories, (directory) =>
  Effect.gen(function*() {
    const metadata = yield* readMetadata(directory);
    const pair = capturePair(metadata);
    const result = integrityResult(yield* readEvidence(directory, metadata), pair);
    return { directory, pair, result };
  })));

const all = captures.flatMap(({ directory, result }) => result.localStarts.map((start) => ({ capture: directory, ...start })));
const gated = all.filter((start) => start.stall !== "own" && !start.held);
const held = all.filter((start) => start.held && start.stall !== "own");
const presses = captures.reduce((sum, { result }) => sum + result.presses[0] + result.presses[1], 0);
const lost = captures.reduce((sum, { result }) => sum + result.lost, 0);
const extra = captures.reduce((sum, { result }) => sum + result.duplicated, 0);
const correct = captures.reduce((sum, { result }) => sum + result.expectedFrame.correct, 0);
const total = captures.reduce((sum, { result }) => sum + result.expectedFrame.total, 0);
const bindings = new Set(captures.flatMap(({ result }) => [...result.pressedBindings[0], ...result.pressedBindings[1]]));
const missingActions = Object.entries(ACTIONS).filter(([, names]) => !names.some((name) => bindings.has(name))).map(([action]) => action);
const gatedDelays = measured(gated);
const gatedMax = gatedDelays.length === 0 ? undefined : Math.max(...gatedDelays);
const gatedMissing = gated.filter((start) => start.delay === undefined).length;
const checksumsEqual = captures.every(({ result }) => result.gates.checksums);

const gate = {
  presses: presses >= MIN_PRESSES,
  every_action: missingActions.length === 0,
  lost_extra: lost === 0 && extra === 0,
  on_frame: total > 0 && correct === total,
  local_start: gatedDelays.length > 0 && gatedMissing === 0 && gatedMax !== undefined && gatedMax <= 1,
  checksums: checksumsEqual,
};
const summary = {
  claim: "#60: every press lands on its frame and shows on the presser's next local frame",
  captures: captures.map(({ directory, pair, result }) => ({
    directory,
    build: result.build,
    epochs: pair,
    presses: result.presses,
    pressed_bindings: result.pressedBindings,
    edges: result.injected,
    lost: result.lost,
    extra: result.duplicated,
    reordered: result.reordered,
    stuck: result.stuck,
    on_frame: result.expectedFrame,
    legal_presses: result.legalActionEdges,
    local_start: bySide(result.localStarts),
    checksums_equal: result.gates.checksums,
    mismatched_edges: result.mismatchedEdges,
    reconciler_failures: result.failures,
  })),
  presses,
  missing_actions: missingActions,
  lost,
  extra,
  on_frame: { correct, total, percent: total > 0 ? (100 * correct) / total : undefined },
  local_start_callbacks: {
    all: distribution(measured(all)),
    by_stall: bySide(all),
    prediction_held: { ...distribution(measured(held)), missing_first_prediction: held.filter((start) => start.delay === undefined).length },

    gated_within_1s_after_stop: distribution(measured(gated.filter((start) => start.afterStall !== undefined && start.afterStall <= RECOVERY_FRAMES))),
    gated_clear_of_stops: distribution(measured(gated.filter((start) => start.stall === "none" && (start.afterStall === undefined || start.afterStall > RECOVERY_FRAMES)))),
  },
  gated_local_start: { n: gatedDelays.length, max: gatedMax, missing_first_prediction: gatedMissing },

  gated_shown_only_when_confirmed: distribution(gated.flatMap((start) => (start.confirmedAfter === undefined ? [] : [start.confirmedAfter]))),
  worst_gated_presses: gated.filter((start) => start.delay !== undefined && start.delay > 1).sort((a, b) => (b.delay ?? 0) - (a.delay ?? 0)),
  gated_without_first_prediction: gated.filter((start) => start.delay === undefined),
  gate,
  passed: Object.values(gate).every(Boolean),
};
writeFileSync(out, `${JSON.stringify(summary, undefined, 2)}\n`);
process.exitCode = summary.passed ? 0 : 1;
console.log(JSON.stringify({ presses, missing_actions: missingActions, lost, extra, on_frame: summary.on_frame, gated_local_start: summary.gated_local_start, local_start_callbacks: summary.local_start_callbacks, gate, passed: summary.passed }, undefined, 2));
