import { expect, test } from "bun:test";
import { DEFAULT_CONFIG, classify, type Combo, type MatchSpec, type Observation, type Run } from "./playtestCore";

const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MOVES = ["jab", "forward-tilt", "up-air", "grab", "side-special"];

function randomCombo(next: () => number): Combo {
  const hits = 2 + Math.floor(next() * 7);
  const moves: string[] = [], instances: number[] = [], damages: number[] = [], gaps: number[] = [];
  let instance = 0;
  for (let hit = 0; hit < hits; hit++) {
    if (hit === 0 || next() < 0.7) instance++;
    moves.push(MOVES[instance % MOVES.length] ?? "jab");
    instances.push(instance);
    damages.push(Math.floor(next() * 14));
    if (hit > 0) gaps.push(next() < 0.7 ? 0 : 1 + Math.floor(next() * 20));
  }
  return { victim: next() < 0.5 ? 0 : 1, frame: 100, start: [0, 40, 99, 100, 101, 120][Math.floor(next() * 6)] ?? 0, moves, instances, damages, gaps };
}

function randomRun(next: () => number, index: number): Run {
  const spec: MatchSpec = { index, seed: index, a: `f${index % 4}`, b: `f${(index + 1) % 4}`, stage: "s", tier: "expert" };
  const uses = [0, 1].flatMap((slot) => MOVES.map((move) => ({ fighter: slot === 0 ? spec.a : spec.b, move, count: Math.floor(next() * (next() < 0.1 ? 400 : 40)) })));
  const first: Observation = {
    frames: 5000, ended: true, winner: 0, timedOut: false, stockLosses: 1, strings: [], checksums: [], kos: [], uses,
    combos: Array.from({ length: Math.floor(next() * 3) }, () => randomCombo(next)),
    quiet: { from: 0, frames: Math.floor(next() * 3600) },
  };
  return { spec, first, second: undefined, wallMs: 0 };
}

// An independent reading of #83's table: some window of hits with no
// actionable frame between them holds 4 or more moves (a move is a run of one
// instance), or two or more moves dealing more than 30% that began below 100%.
function breaksByWindows(combo: Combo): boolean {
  for (let i = 0; i < combo.damages.length; i++) {
    let moves = 1, damage = 0;
    const percent = combo.start + combo.damages.slice(0, i).reduce((sum, d) => sum + d, 0);
    for (let j = i; j < combo.damages.length; j++) {
      if (j > i && (combo.gaps[j - 1] ?? 0) > 0) break;
      if (j > i && (combo.instances[j] !== combo.instances[j - 1] || combo.moves[j] !== combo.moves[j - 1])) moves++;
      damage += combo.damages[j] ?? 0;
      if (moves >= 4 || (moves >= 2 && damage > 30 && percent < 100)) return true;
    }
  }
  return false;
}

const key = (runs: readonly Run[]) => JSON.stringify(classify(runs).map(({ kind, subject, detail, frame }) => [kind, subject, detail, frame]).sort());

test("the playtester flags a string exactly when #83's true-combo rule breaks, a match as stuck exactly past 30 s with no damage or stock change, its findings ignore run order, and scaling move usage keeps every overused move [k3 measure docs/gameplay-design.md]", () => {
  const next = random(403);
  for (let trial = 0; trial < 300; trial++) {
    const runs = Array.from({ length: 1 + Math.floor(next() * 8) }, (_, index) => randomRun(next, index));
    const findings = classify(runs);
    for (const run of runs) {
      const id = (kind: string) => findings.filter((finding) => finding.kind === kind && finding.spec?.index === run.spec.index).length;
      expect(id("infinite-combo")).toBe(run.first.combos.filter(breaksByWindows).length);
      expect(id("stuck")).toBe(run.first.quiet.frames >= DEFAULT_CONFIG.stuckSeconds * 60 ? 1 : 0);
    }
    expect(key([...runs].reverse())).toBe(key(runs));
    const scaled = runs.map((run) => ({ ...run, first: { ...run.first, uses: run.first.uses.map((use) => ({ ...use, count: use.count * 3 })) } }));
    const subjects = (list: readonly Run[]) => classify(list).filter((finding) => finding.kind === "move-usage").map((finding) => finding.subject);
    for (const subject of subjects(runs)) expect(subjects(scaled)).toContain(subject);
  }
});
