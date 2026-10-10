import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CPU_OPPONENT_IDS, type CpuOpponentId } from "../src/game/match/cpuProfiles";
import { AttackStyle } from "../src/game/sim/codes";
import { GameplanSpecial } from "../src/game/sim/gameplan";
import { CEILING_SPEC, DESIGN_DOCS, readProfiles } from "./balance";

type CeilingPath = "execution" | "decision" | "mixed";
interface CeilingPlan { readonly path: CeilingPath; readonly basicMoves: readonly number[] }
const moves: Readonly<Record<string, number>> = {
  jab: AttackStyle.jab, "forward-tilt": AttackStyle.forwardTilt, "down-tilt": AttackStyle.downTilt,
  "forward-smash": AttackStyle.forwardSmash, "neutral-air": AttackStyle.neutralAir,
  "forward-air": AttackStyle.forwardAir, grab: AttackStyle.grab,
  "neutral-special": GameplanSpecial.neutral, "side-special": GameplanSpecial.side,
};

export function readCeilingPlans(): Map<string, CeilingPlan> {
  const out = new Map<string, CeilingPlan>();
  for (const profile of readProfiles().values()) {
    const text = readFileSync(join(DESIGN_DOCS, "..", profile.doc.slice(5)), "utf8");
    for (const match of text.matchAll(/```ceiling-plan\nfighter: ([^\n]+)\npath: (execution|decision|mixed)\nbasic-moves: ([^\n]+)\n```/g)) {
      if (match[1] !== profile.fighter) continue;
      const path = match[2];
      if (path !== "execution" && path !== "decision" && path !== "mixed") throw new Error("Unknown ceiling path");
      const basicMoves = (match[3] ?? "").split(",").map(name => {
        const move = moves[name];
        if (move === undefined) throw new Error(`${profile.fighter}: unknown basic move ${name}`);
        return move;
      });
      out.set(profile.fighter, { path, basicMoves });
    }
    if (!out.has(profile.fighter)) throw new Error(`${profile.fighter}: missing ceiling-plan in ${profile.doc}`);
  }
  return out;
}

export interface CeilingRow {
  readonly fighter: string;
  readonly path: CeilingPath;
  readonly panel: Readonly<Record<CpuOpponentId, number>>;
  readonly expertVsBasic: number;
  readonly expert: number;
  readonly execution: number;
  readonly judgment: number;
  readonly ceilingVsExpert: number;
  readonly advancedVsExpert: number;
  readonly ceilingVsCeiling: number;
  readonly complete: boolean;
}
interface CeilingVerdict {
  readonly fighter: string;
  readonly panel: boolean;
  readonly depth: boolean;
  readonly path: boolean;
  readonly ceiling: boolean;
  readonly headroom: boolean;
  readonly gain: number;
  readonly executionGain: number;
  readonly judgmentGain: number;
  readonly panelAverage: number;
}
const inBand = (n: number, low: number, high: number) => Number.isFinite(n) && n >= low && n <= high;
function ceilingVerdicts(rows: readonly CeilingRow[]): { rows: CeilingVerdict[]; diversity: boolean; bestFits: Record<CpuOpponentId, number>; medianHeadroom: number } {
  const s = CEILING_SPEC;
  const sorted = rows.map(row => row.ceilingVsExpert - row.advancedVsExpert).sort((a,b) => a-b);
  const midpoint = Math.floor(sorted.length / 2);
  const medianHeadroom = sorted.length === 0 ? NaN : sorted.length % 2 === 0 ? ((sorted[midpoint - 1] ?? NaN) + (sorted[midpoint] ?? NaN)) / 2 : sorted[midpoint] ?? NaN;
  const bestFits: Record<CpuOpponentId, number> = { rook: 0, ember: 0, flint: 0, vale: 0, kite: 0, wren: 0 };
  const verdicts = rows.map(row => {
    const rates = CPU_OPPONENT_IDS.map(id => row.panel[id]);
    const best = Math.max(...rates);

    for (const id of CPU_OPPONENT_IDS) if (row.panel[id] === best) bestFits[id]++;
    const panelAverage = rates.reduce((a,b) => a+b, 0) / rates.length;
    const executionGain = row.execution - row.expert;
    const judgmentGain = row.judgment - row.expert;
    const axisTotal = Math.max(0, executionGain) + Math.max(0, judgmentGain);
    const gain = row.ceilingVsExpert - row.advancedVsExpert;
    const path = row.path === "mixed" ? executionGain > s.mixedGainMin && judgmentGain > s.mixedGainMin
      : axisTotal > 0 && (row.path === "execution" ? executionGain : judgmentGain) / axisTotal >= s.axisMajority;
    return { fighter: row.fighter, panelAverage, executionGain, judgmentGain, gain,
      panel: row.complete && inBand(panelAverage,s.panelLow,s.panelHigh) && rates.every(n=>inBand(n,s.personalityLow,s.personalityHigh)),
      depth: row.complete && row.expertVsBasic >= 0.5 + s.depthMargin,
      path: row.complete && path,
      ceiling: row.complete && inBand(row.ceilingVsCeiling,s.ceilingLow,s.ceilingHigh),
      headroom: row.complete && Number.isFinite(gain) && gain > 0 && Math.abs(gain-medianHeadroom) <= s.headroomTolerance,
    };
  });
  return { rows: verdicts, bestFits, medianHeadroom,
    diversity: rows.length > 0 && rows.every(row=>row.complete) && CPU_OPPONENT_IDS.every(id=>bestFits[id] >= s.bestFitMin && bestFits[id] <= rows.length * s.bestFitMaxShare) };
}

const pct = (n: number) => Number.isFinite(n) ? `${(100*n).toFixed(1)}%` : "not measured";
const result = (pass: boolean) => pass ? "pass" : "FAIL";
export function ceilingTable(rows: readonly CeilingRow[], cpuSeconds: number): string {
  const v = ceilingVerdicts(rows);
  const lines = ["## Player panel and skill ceiling (#358)", `Production match CPU: ${cpuSeconds.toFixed(2)} s (user + system; excludes setup).`,
    "Panel personalities have equal weight; Wren 400 a pair, other personalities 100. Final profiles 25 a pair, mirrors 100.",
    "| Fighter | Rook | Ember | Flint | Vale | Kite | Wren | Mean | Panel | Expert/basic | Depth | Execution gain | Judgment gain | Draft path | Path | Ceiling field | Ceiling | Advanced→ceiling | Headroom |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const row of rows) {
    const r = v.rows.find(r=>r.fighter===row.fighter);
    if (r === undefined) continue;
    lines.push(`| ${row.fighter} | ${CPU_OPPONENT_IDS.map(id=>pct(row.panel[id])).join(" | ")} | ${pct(r.panelAverage)} | ${result(r.panel)} | ${pct(row.expertVsBasic)} | ${result(r.depth)} | ${pct(r.executionGain)} | ${pct(r.judgmentGain)} | ${row.path} | ${result(r.path)} | ${pct(row.ceilingVsCeiling)} | ${result(r.ceiling)} | ${pct(r.gain)} | ${result(r.headroom)} |`);
  }
  lines.push(`Diversity: ${result(v.diversity)}; best fits ${CPU_OPPONENT_IDS.map(id=>`${id} ${v.bestFits[id]}`).join(", ")}.`, `Median headroom: ${pct(v.medianHeadroom)}; tolerance ${(100*CEILING_SPEC.headroomTolerance).toFixed(0)} percentage points.`,
    `Skill ceiling: ${result(v.diversity && v.rows.length > 0 && v.rows.every(r=>r.panel && r.depth && r.path && r.ceiling && r.headroom))}.`);
  return lines.join("\n");
}
