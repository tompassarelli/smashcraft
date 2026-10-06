// `bun scripts/integrity/pressResult.ts OUT.json CAPTURE_DIR ...`: #60's claim
// over integrity-build captures (#26's capture and `parity capture --bot` on a
// diagnostic build): every scripted press counted against both clients'
// confirmed rows, the share applied on the frame its injection time implies,
// and each legal press's local start (callbacks from capture to the presser's
// first prediction). Presses made while a capture had stopped the presser's
// own game or helper are reported apart from the gate, and presses made while
// the other player's process was stopped apart from presses with no stall.
import { writeFileSync } from "node:fs";
import { Effect } from "effect";
import { readEvidence, readMetadata } from "./evidence";
import { type LocalStart, type StallSide, capturePair, distribution, integrityResult } from "./reconcile";

const [out, ...directories] = process.argv.slice(2);
if (out === undefined || directories.length === 0) throw new Error("usage: bun scripts/integrity/pressResult.ts OUT.json CAPTURE_DIR ...");

const MIN_PRESSES = 1000;
/** #60's actions, each satisfied by any of these workload binding names. */
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
const gated = all.filter((start) => start.stall !== "own");
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
    reconciler_failures: result.failures,
  })),
  presses,
  missing_actions: missingActions,
  lost,
  extra,
  on_frame: { correct, total, percent: total > 0 ? (100 * correct) / total : undefined },
  local_start_callbacks: { all: distribution(measured(all)), by_stall: bySide(all) },
  gated_local_start: { n: gatedDelays.length, max: gatedMax, missing_first_prediction: gatedMissing },
  worst_gated_presses: [...gated].sort((a, b) => (b.delay ?? Infinity) - (a.delay ?? Infinity)).slice(0, 20),
  gate,
  passed: Object.values(gate).every(Boolean),
};
writeFileSync(out, `${JSON.stringify(summary, undefined, 2)}\n`);
console.log(JSON.stringify({ presses, missing_actions: missingActions, lost, extra, on_frame: summary.on_frame, gated_local_start: summary.gated_local_start, by_stall: summary.local_start_callbacks.by_stall, gate, passed: summary.passed }, undefined, 2));
