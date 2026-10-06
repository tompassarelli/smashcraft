import { installHeadless } from "wisp/scripts/wisp/headless";
import { playSoakMatch, readSoakRepro, type SoakGame } from "wisp/scripts/wisp/soak";
import project from "../scripts/wisp/soak";
import game from "../test/soak/game";
import { shell } from "../src/platform/shell/state";

const runtime = installHeadless(project.map);
try {
  for (const index of [46, 87]) {
    const repro = readSoakRepro(await Bun.file(`../evidence/frozen-throne-20261006/match-${index}.json`).text());
    const samples: { callback: number; wallMs: number; slot: number; confirmed: number; confirmedLag: number; predicted: number; predictedLag: number; over: boolean }[] = [];
    const traced: SoakGame = { ...game, begin(clients, match) {
      const driver = game.begin(clients, match);
      let callback = 0;
      let wallMs = 0;
      return { ...driver,
        input(step) { callback = step.frame; wallMs = step.wallMs; driver.input(step); },
        observe(client) {
          const seen = driver.observe(client);
          const s = shell();
          const predicted = (s.rollback?.schedule.speculativeFrame() ?? 1) - 1;
          if (seen.backlog !== undefined) samples.push({ callback, wallMs, slot: client.slot, confirmed: s.runtime.simulationFrame, confirmedLag: seen.backlog, predicted, predictedLag: seen.backlog + s.runtime.simulationFrame - predicted, over: seen.over });
          return seen;
        },
      };
    } };
    const result = playSoakMatch(runtime, traced, project, repro.match, repro.inputs);
    const intervals = index === 46 ? [[1, 740], [1041, 1100], [1101, 1260], [1261, 1400]] : [[1, 97], [98, 139], [140, 202], [203, 240]];
    const summary = intervals.map(([from = 0, through = 0]) => {
      const rows = samples.filter(x => x.callback >= from && x.callback <= through);
      return { from, through, count: rows.length, predictedLagMin: Math.min(...rows.map(x=>x.predictedLag)), predictedLagMax: Math.max(...rows.map(x=>x.predictedLag)), confirmedLagMax: Math.max(...rows.map(x=>x.confirmedLag)) };
    });
    await Bun.write(`build/catchup-trace-${index}.json`, JSON.stringify({ revision: "89abaf3c", summary, findings: result.findings, frames: result.frames, wallMs: result.wallMs, checksums: result.checksums, samples }, null, 2));
    console.log(JSON.stringify({ index, summary, landmarks: samples.filter(x => [97,98,103,139,140,202,203,204,210,240,740,1040,1041,1045,1050,1060,1080,1100,1221,1260].includes(x.callback)), findings: result.findings.filter(x=>x.kind === "catch-up"), checksums: result.checksums }));
  }
} finally { runtime.restore(); }
