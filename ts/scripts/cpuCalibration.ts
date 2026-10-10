import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";
import { collectDashCalibration, collectTechnicalCalibration, dashPercentile } from "../src/game/match/botDashCalibration";
import { parseArgs } from "node:util";
import { CALIBRATION_SEEDS, calibrationFailures, collectCalibrationRow, type CalibrationMeasure, type CalibrationRow } from "../src/game/match/cpuCalibration";
import { CPU_PROFILES, CPU_TIERS, type CpuOpponentId } from "../src/game/match/cpuProfiles";

function calibrationGrowthFailures(rows: readonly CalibrationRow[]): string[] {
  const failures: string[] = [];
  const growth: readonly [CpuOpponentId, CalibrationMeasure, string][] = [
    ["rook", "conversion", "close punish connected"], ["rook", "proactive", "took initiative"],
    ["ember", "execution", "tech press in landing window"], ["ember", "reads", "learned strike blocked"],
    ["flint", "execution", "tech press in landing window"], ["flint", "judgment", "context value"],
    ["vale", "proactive", "took initiative"], ["vale", "conversion", "close punish connected"],
    ["kite", "execution", "tech press in landing window"], ["kite", "conversion", "close punish connected"],
    ["wren", "proactive", "took initiative"], ["wren", "reads", "learned strike blocked"],
  ];
  for (const [opponent, measure, outcome] of growth) {
    let previous = -1;
    let first = -1;
    for (const tier of CPU_TIERS) {
      const row = rows.find(row => row.opponent === opponent && row.tier === tier);
      if (row === undefined) { failures.push(`${opponent}/${tier}: missing developmental row`); continue; }
      const count = row.samples[measure].outcomes[outcome] ?? 0;
      if (first < 0) first = count;
      if (count < previous) failures.push(`${opponent}/${tier}: ${outcome} fell from ${previous} to ${count}`);
      previous = count;
    }
    if (previous <= first) failures.push(`${opponent}: ${outcome} did not improve from Rookie to Expert`);
  }
  let previous = -1;
  for (const tier of CPU_TIERS) {
    const row = rows.find(row => row.opponent === "flint" && row.tier === tier);
    if (row === undefined) continue;
    const events = Object.entries(row.samples.adaptation.outcomes).reduce((total, [outcome, count]) =>
      total + (outcome === "no switch in 80 events" ? 81 : Number(outcome.split(" ")[0])) * count, 0);
    if (previous >= 0 && events >= previous) failures.push(`flint/${tier}: adaptation did not improve (${events} versus ${previous} total observed events)`);
    previous = events;
  }
  return failures;
}

function calibrationReport(revision: string, trials = 10) {
  const rows = CPU_PROFILES.map(profile => collectCalibrationRow(profile, trials));
  const collectionFailures = rows.flatMap(row => calibrationFailures(row).map(failure => `${row.opponent}/${row.tier}: ${failure}`));
  const growthFailures = calibrationGrowthFailures(rows);
  const flawFailures = rows.filter(row => !Object.keys(row.samples.exploit.outcomes).some(outcome => outcome.includes("caught by")))
    .map(row => `${row.opponent}/${row.tier}: controlled counterplay did not expose the enduring flaw`);
  const failures = [...collectionFailures, ...growthFailures, ...flawFailures];
  const lines = ["# Named opponent calibration", "", `Revision: ${revision}. Seeds: ${CALIBRATION_SEEDS.join(", ")}. ${trials} controlled decisions per seed and measure.`,
    "Authored Smashcraft strength; no human rating, real-player imitation or matchmaking-rank claim.", "",
    "Counts are actual policy calls in controlled eligible situations. A declined action is counted separately. Collection fails below 100 eligible decisions per measure/row.",
    "Read forecasts face the learned strike or a switched grab in the real simulation; outcomes count blocked strikes, hits and punished wrong reads. Close conversions play the queued punish for 60 simulation frames and count actual connections. Adaptation counts new observed shield events after 20 repeated strikes, including held-read expiry. Spacing checks queued normals against authored reach. Risk reports the actual move value under a public lead/stock-clock deficit.", "",
    "| Opponent | Tier | Measure | Eligible | Distribution |", "| --- | --- | --- | ---: | --- |"];
  for (const row of rows) for (const [name, measure] of Object.entries(row.samples)) {
    lines.push(`| ${row.opponent} | ${row.tier} | ${name} | ${measure.eligible} | ${Object.entries(measure.outcomes).map(([outcome, count]) => `${outcome}: ${count}`).join("; ")} |`);
  }
  lines.push("", "| Opponent | Tier | Early reactions | Reversals | Early reversals | Replay cases | Replay differences |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of rows) lines.push(`| ${row.opponent} | ${row.tier} | ${row.earlyReactions} | ${row.reversals} | ${row.earlyReversals} | ${row.replayCases} | ${row.replayDifferences} |`);
  lines.push("", `Collection/fairness/replay: ${collectionFailures.length === 0 ? "PASS" : "FAIL"}.`, ...collectionFailures.map(failure => `- ${failure}`), "",
    `Developmental paths: ${growthFailures.length === 0 ? "PASS" : "FAIL"}.`,
    "Rook: close conversions and initiative. Ember: defensive techs and learned reads. Flint: execution, judgment and faster pattern switches. Vale: initiative and conversions. Kite: execution and conversions. Wren: pressure and conditioned reads.",
    ...growthFailures.map(failure => `- ${failure}`), "",
    `Enduring flaws: ${flawFailures.length === 0 ? "PASS" : "FAIL"}.`,
    "Rook faces a jab after passing a speculative opening; Ember faces a shield counter after extending pressure; Flint faces a shield counter to the conditioned forward tilt; Vale faces a jab after a feint; Kite faces a guarded ledge escape; Wren faces a chased uncertain neutral reset. Counters play for 60 simulation frames and count damage or a caught grab, without requiring a player win.",
    ...flawFailures.map(failure => `- ${failure}`), "",
    "Difficulty, whole-roster kit use and fighter balance use their existing acceptance commands and thresholds. This controlled report does not substitute for those results.");
  lines.push("", "| Tier | Reversals | Min | P10 | Median | P90 | Unintended runs/minute |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const tier of CPU_TIERS) {
    const dash = collectDashCalibration(tier);
    lines.push(`| ${tier} | ${dash.intervals.length} | ${dashPercentile(dash, 0)} | ${dashPercentile(dash, 1)} | ${dashPercentile(dash, 5)} | ${dashPercentile(dash, 9)} | ${(dash.runs * 3600 / dash.frames).toFixed(2)} |`);
  }
  const technical = collectTechnicalCalibration("expert");
  lines.push("", `Expert frame-tight technical inputs: ${technical.inputs}; slips: ${technical.slips} (${(technical.slips * 100 / technical.inputs).toFixed(2)}%); wrong options: ${technical.wrongOptions}.`,
    "Turns use repeated legal opposite-side spacing situations through produceComputerInput and actual ground motion; runs count entries into the simulation's run action per minute of those frames. Frame-tight inputs are repeated wavedash air dodges through the production execution step.");
  return { rows, failures, text: lines.join("\n") + "\n" };
}

const main = Effect.gen(function*() {
  const { values } = yield* Effect.try(() => parseArgs({ args: process.argv.slice(2), options: { revision: { type: "string" }, out: { type: "string" }, json: { type: "string" }, "trials-per-seed": { type: "string" } }, strict: true }));
  const trials = yield* Schema.decodeEffect(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })))(Number(values["trials-per-seed"] ?? 10));
  const revision = values.revision ?? (yield* runProcess(ChildProcess.make("git", ["rev-parse", "HEAD"])));
  const report = calibrationReport(revision, trials);
  console.log(report.text);
  if (values.out !== undefined) {
    const out = values.out;
    yield* Effect.tryPromise(() => Bun.write(out, report.text));
  }
  if (values.json !== undefined) {
    const json = values.json;
    yield* Effect.tryPromise(() => Bun.write(json, JSON.stringify({ revision, seeds: CALIBRATION_SEEDS, trialsPerSeed: trials, rows: report.rows, failures: report.failures }, null, 2) + "\n"));
  }
  if (report.failures.length > 0) process.exitCode = 1;
});

if (import.meta.main) BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
