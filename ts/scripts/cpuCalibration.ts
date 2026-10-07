import { parseArgs } from "node:util";
import { CALIBRATION_SEEDS, calibrationFailures, collectCalibrationRow } from "../src/game/match/cpuCalibration";
import { CPU_PROFILES } from "../src/game/match/cpuProfiles";

export function calibrationReport(revision: string, trials = 10) {
  const rows = CPU_PROFILES.map(profile => collectCalibrationRow(profile, trials));
  const failures = rows.flatMap(row => calibrationFailures(row).map(failure => `${row.opponent}/${row.tier}: ${failure}`));
  const lines = ["# Named opponent calibration", "", `Revision: ${revision}. Seeds: ${CALIBRATION_SEEDS.join(", ")}. ${trials} controlled decisions per seed and measure.`,
    "Authored Smashcraft strength; no human rating, real-player imitation or matchmaking-rank claim.", "",
    "Counts are actual policy calls in controlled eligible situations. A declined action is counted separately. Collection fails below 100 eligible decisions per measure/row.",
    "Read forecasts face the learned strike or a switched grab in the real simulation; outcomes count blocked strikes, hits and punished wrong reads. Adaptation counts new observed shield events after 20 repeated strikes, including held-read expiry. Spacing checks queued normals against authored reach. Risk reports the actual move value under a public lead/stock-clock deficit.", "",
    "| Opponent | Tier | Measure | Eligible | Distribution |", "| --- | --- | --- | ---: | --- |"];
  for (const row of rows) for (const [name, measure] of Object.entries(row.samples)) {
    lines.push(`| ${row.opponent} | ${row.tier} | ${name} | ${measure.eligible} | ${Object.entries(measure.outcomes).map(([outcome, count]) => `${outcome}: ${count}`).join("; ")} |`);
  }
  lines.push("", "| Opponent | Tier | Early reactions | Reversals | Early reversals | Replay cases | Replay differences |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of rows) lines.push(`| ${row.opponent} | ${row.tier} | ${row.earlyReactions} | ${row.reversals} | ${row.earlyReversals} | ${row.replayCases} | ${row.replayDifferences} |`);
  lines.push("", `Collection/fairness/replay: ${failures.length === 0 ? "PASS" : "FAIL"}.`, ...failures.map(failure => `- ${failure}`), "",
    "Difficulty, whole-roster kit use and fighter balance use their existing acceptance commands and thresholds. This controlled report does not substitute for those results.");
  return { rows, failures, text: lines.join("\n") + "\n" };
}

if (import.meta.main) {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { revision: { type: "string" }, out: { type: "string" }, json: { type: "string" }, "trials-per-seed": { type: "string" } }, strict: true });
  const trials = Number(values["trials-per-seed"] ?? 10);
  if (!Number.isSafeInteger(trials) || trials < 1 || trials > 100) throw new Error("trials-per-seed must be an integer from 1 to 100");
  const revision = values.revision ?? Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim();
  const report = calibrationReport(revision, trials);
  console.log(report.text);
  if (values.out !== undefined) await Bun.write(values.out, report.text);
  if (values.json !== undefined) await Bun.write(values.json, JSON.stringify({ revision, seeds: CALIBRATION_SEEDS, trialsPerSeed: trials, rows: report.rows, failures: report.failures }, null, 2) + "\n");
  if (report.failures.length > 0) process.exitCode = 1;
}
