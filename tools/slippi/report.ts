// Pools extract.ts events per rank group and prints the measured tables as Markdown.
// Usage: bun report.ts > report.md
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RANKS, ROOT } from "./fetch.ts";

const DI_DEADZONE = 0.2875;
const KILL_SPEED = 3.0; // launch speed of knockback 100 (speed = 0.03 x knockback)
const KILL_PERCENT = 100;
const pct = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]!; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "-");
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "-");
const share = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");
const dist = (xs: number[]) => `${pct(xs, 0)} / ${pct(xs, 0.1)} / ${pct(xs, 0.5)} / ${pct(xs, 0.9)} / ${pct(xs, 1)}`;

type Row = Record<string, string>;
const out: Record<string, Row> = {};
const counts: Record<string, { games: number; players: number; minutes: number }> = {};

for (const rank of RANKS) {
  const lines: any[] = [];
  for (const f of readdirSync(join(ROOT, "events")).filter((n) => n.startsWith(rank + ".")))
    for (const l of readFileSync(join(ROOT, "events", f), "utf8").split("\n")) if (l) lines.push(JSON.parse(l));
  if (!lines.length) continue;
  const r: Row = (out[rank] = {});
  counts[rank] = { games: new Set(lines.map((l) => l.file)).size, players: lines.length, minutes: lines.reduce((a, l) => a + l.minutes, 0) };
  const minutes = counts[rank]!.minutes;

  // 1. Dash dance.
  const dd = lines.flatMap((l) => l.ddIntervals);
  r.dd = dist(dd); r.ddN = `${dd.length}`; r.ddMeanSd = `${f1(mean(dd))} ± ${f1(sd(dd))}`;
  r.ddUnder4 = share(dd.filter((x) => x < 4).length, dd.length); r.ddP1 = `${pct(dd, 0.01)} / ${pct(dd, 0.05)}`;
  // 2. Unintended runs.
  const runs = lines.reduce((a, l) => a + l.runs, 0), regrets = lines.reduce((a, l) => a + l.runRegrets, 0);
  r.runRegretsPerMin = f2(regrets / minutes); r.runRegretShare = share(regrets, runs); r.runsPerMin = f2(runs / minutes);

  // 3. DI.
  const di = lines.flatMap((l) => l.di).filter((h: number[]) => h[0]! >= 1.0);
  const cls = { none: 0, in: 0, away: 0, perp: 0 };
  let killN = 0, killNone = 0, killWrong = 0, killFlat = 0, diedN = 0, diedSlip = 0;
  for (const [speed, ang, sx, sy, died, percent] of di) {
    const mag = Math.hypot(sx, sy);
    const lx = Math.cos(ang), ly = Math.sin(ang);
    let kind: keyof typeof cls = "none";
    if (mag >= DI_DEADZONE) {
      const cos = (lx * sx + ly * sy) / mag;
      kind = cos > Math.SQRT1_2 ? "away" : cos < -Math.SQRT1_2 ? "in" : "perp";
    }
    cls[kind]++;
    if (speed >= KILL_SPEED && percent >= KILL_PERCENT && ly > 0) {
      killN++;
      // Survival DI proxy: launches below 60 deg want rotation toward vertical,
      // steeper ones toward horizontal. perp > 0 rotates the launch counter-clockwise.
      const perp = mag >= DI_DEADZONE ? (lx * sy - ly * sx) : 0;
      const folded = Math.atan2(ly, Math.abs(lx)) * 180 / Math.PI;
      const up = perp * Math.sign(lx || 1); // > 0 rotates toward vertical
      let slip = false;
      if (mag < DI_DEADZONE) { killNone++; slip = true; }
      else if (Math.abs(perp) < 0.3) killFlat++;
      else if (folded < 60 ? up < 0 : folded < 80 ? up > 0 : false) { killWrong++; slip = true; }
      if (died) { diedN++; if (slip) diedSlip++; }
    }
  }
  const diN = di.length;
  r.diN = `${diN}`; r.diNone = share(cls.none, diN); r.diIn = share(cls.in, diN); r.diAway = share(cls.away, diN); r.diPerp = share(cls.perp, diN);
  r.killN = `${killN}`; r.killSlip = share(killNone + killWrong, killN); r.killNone = share(killNone, killN); r.killWrong = share(killWrong, killN); r.killFlat = share(killFlat, killN);
  r.diedSlip = `${share(diedSlip, diedN)} of ${diedN}`;

  // 4. SDI.
  const sdi = lines.flatMap((l) => l.sdi);
  const strong = sdi.filter((h: number[]) => h[0]! >= 9), multi = sdi.filter((h: number[]) => h[1] === 1 && h[0]! >= 3);
  r.sdiStrong = `${share(strong.filter((h: number[]) => h[2]! > 0).length, strong.length)} of ${strong.length}`;
  r.sdiMulti = `${share(multi.filter((h: number[]) => h[2]! > 0).length, multi.length)} of ${multi.length}`;
  r.sdiStrongMean = f2(mean(strong.map((h: number[]) => h[2]!)));

  // 5. Hops: [hold, deadline, aerialDelay, aerialId].
  const hops = lines.flatMap((l) => l.hops);
  const sh = hops.filter((h: number[]) => h[0]! < h[1]!);
  r.hopN = `${hops.length}`; r.shShare = share(sh.length, hops.length);
  r.shHold = dist(sh.map((h: number[]) => h[0]!));
  const margins = sh.map((h: number[]) => h[1]! - h[0]!);
  r.shMargin = `${f1(mean(margins))} ± ${f1(sd(margins))}`;
  const fh = hops.filter((h: number[]) => h[0]! >= h[1]!);
  r.fhHoldOver = dist(fh.map((h: number[]) => Math.min(h[0]! - h[1]!, 39)));
  const quickAerial = hops.filter((h: number[]) => h[2]! >= 0 && h[2]! <= 12);
  const over = (k: number) => quickAerial.filter((h: number[]) => h[0]! - h[1]! === k).length;
  const excess = Math.max(0, over(0) - (over(1) + over(2)) / 2);
  r.accFh = `${share(excess, quickAerial.length)} of ${quickAerial.length}`;

  // 6a. L-cancel: [status, framesBeforeLanding of last press or -1].
  const lc = lines.flatMap((l) => l.lcancel).filter((x: number[]) => x[0] === 1 || x[0] === 2);
  const lcOk = lc.filter((x: number[]) => x[0] === 1).length;
  r.lcN = `${lc.length}`; r.lcRate = share(lcOk, lc.length);
  const pressed = lc.filter((x: number[]) => x[1]! >= 0).map((x: number[]) => x[1]!);
  r.lcNoPress = share(lc.length - pressed.length, lc.length);
  r.lcTiming = `${f1(mean(pressed))} ± ${f1(sd(pressed))}`;
  r.lcEarly = share(lc.filter((x: number[]) => x[0] === 2 && x[1]! >= 7).length, lc.length);

  // 6b. Late aerials against the player's own median per aerial.
  const devs: number[] = [];
  for (const l of lines) for (const xs of Object.values(l.aerialDelays) as number[][]) {
    if (xs.length < 5) continue; const m = pct(xs, 0.5); for (const x of xs) devs.push(x - m);
  }
  r.aerN = `${devs.length}`; r.aerLate3 = share(devs.filter((d) => d >= 3).length, devs.length); r.aerSd = f2(sd(devs));
  r.aerAbs1 = share(devs.filter((d) => Math.abs(d) <= 1).length, devs.length);

  // 6c. Out-of-shield rolls among players who usually wavedash out of shield.
  let wdUsers = 0, ooRoll = 0, ooWd = 0;
  for (const l of lines) { const { roll, wd } = l.oos; if (wd >= 3 && wd / (wd + roll) >= 0.6) { wdUsers++; ooRoll += roll; ooWd += wd; } }
  r.oosSub = `${share(ooRoll, ooRoll + ooWd)} of ${ooRoll + ooWd} (${wdUsers} players)`;

  // Wavedash: [delayFromTakeoff, x, y, outOfShield].
  const wd = lines.flatMap((l) => l.wavedash);
  const delays = wd.map((w: number[]) => w[0]!);
  r.wdN = `${wd.length}`; r.wdPerfect = share(delays.filter((d) => d <= 0).length, delays.length);
  r.wd1 = share(delays.filter((d) => d === 1).length, delays.length); r.wd2 = share(delays.filter((d) => d >= 2).length, delays.length);
  r.wdDelay = `${f2(mean(delays))} ± ${f2(sd(delays))}`;
  const angleOf = (w: number[]) => (Math.atan2(-w[2]!, Math.abs(w[1]!)) * 180) / Math.PI;
  const directional = wd.filter((w: number[]) => Math.abs(w[1]!) >= 0.3 && w[2]! < 0);
  const angles = directional.map(angleOf);
  r.wdAngle = `${f1(pct(angles, 0.1))} / ${f1(pct(angles, 0.5))} / ${f1(pct(angles, 0.9))}`;
  const playerSds: number[] = [];
  for (const l of lines) { const a = l.wavedash.filter((w: number[]) => Math.abs(w[1]!) >= 0.3 && w[2]! < 0).map(angleOf); if (a.length >= 5) playerSds.push(sd(a)); }
  r.wdAngleSd = `${f1(pct(playerSds, 0.5))} (${playerSds.length} players)`;

  // Tech on landing from hitstun or tumble.
  const tech = lines.flatMap((l) => l.tech ?? []);
  const techPress = tech.filter((t: number[]) => t[1]! >= 0).map((t: number[]) => t[1]!);
  r.techN = `${tech.length}`; r.techRate = share(tech.filter((t: number[]) => t[0] === 1).length, tech.length);
  r.techTiming = `${f1(mean(techPress))} ± ${f1(sd(techPress))}`;
  r.techNoPress = share(tech.length - techPress.length, tech.length);

  // 7. Tech-chase reactions. Responses under 12 frames come before the roll could be seen.
  const tc = lines.flatMap((l) => l.techChase);
  const tcCens = lines.reduce((a, l) => a + l.techChaseCensored, 0);
  const seen = tc.filter((x) => x >= 12);
  r.tcN = `${tc.length} (+${tcCens} with no response in 40)`;
  r.tcGuess = share(tc.length - seen.length, tc.length);
  r.tc = `${pct(seen, 0.05)} / ${pct(seen, 0.1)} / ${pct(seen, 0.25)} / ${pct(seen, 0.5)} / ${pct(seen, 0.9)}`;
  r.tcMeanSd = `${f1(mean(seen))} ± ${f1(sd(seen))}`;
}

const ranks = Object.keys(out);
const head = `| Measure | ${ranks.join(" | ")} |\n|---|${ranks.map(() => "---").join("|")}|`;
const rows: [string, string][] = [
  ["Games / player-games / minutes", ""],
  ["1. Dash-dance reversal interval, frames: min / p10 / median / p90 / max", "dd"],
  ["1. Reversals measured", "ddN"], ["1. Mean ± sd", "ddMeanSd"], ["1. Share under 4 frames", "ddUnder4"], ["1. p1 / p5", "ddP1"],
  ["2. Dash-to-run entries per minute", "runsPerMin"], ["2. Unintended runs per minute (braked or turned within 6 frames)", "runRegretsPerMin"],
  ["2. Share of runs that are unintended", "runRegretShare"],
  ["3. Hits with knockback (speed ≥ 1.0)", "diN"], ["3. DI none", "diNone"], ["3. DI in (against launch)", "diIn"],
  ["3. DI away (along launch)", "diAway"], ["3. DI perpendicular", "diPerp"],
  ["3. Kill-percent hits (≥ 100% after the hit, launch speed ≥ 3.0, upward)", "killN"], ["3. Kill-percent slip (no DI or survival-shortening DI)", "killSlip"],
  ["3. … of which no DI", "killNone"], ["3. … of which wrong way", "killWrong"], ["3. Kill-percent DI with no angle change (along or against)", "killFlat"],
  ["3. Slip on hits that took the stock", "diedSlip"],
  ["4. Strong hits (hitlag ≥ 9) with any SDI input", "sdiStrong"], ["4. SDI inputs per strong hit", "sdiStrongMean"],
  ["4. Multi-hit follow-ups with any SDI input", "sdiMulti"],
  ["5. Button jumps measured", "hopN"], ["5. Short-hop share", "shShare"],
  ["5. Short-hop hold, frames: min / p10 / median / p90 / max", "shHold"], ["5. Short-hop release, frames before deadline: mean ± sd", "shMargin"],
  ["5. Full-hop hold past deadline, frames: min / p10 / median / p90 / max", "fhHoldOver"],
  ["5. Accidental full hop proxy: excess full hops released exactly at the deadline (of jumps with an aerial within 12 frames)", "accFh"],
  ["6. Aerial landings with L-cancel status", "lcN"], ["6. L-cancel success", "lcRate"], ["6. No L/R/Z press in 30 frames before landing", "lcNoPress"],
  ["6. Last press, frames before landing: mean ± sd", "lcTiming"], ["6. Missed by pressing too early (≥ 7 frames before)", "lcEarly"],
  ["6. Short-hop aerials vs own median", "aerN"], ["6. Aerial ≥ 3 frames later than own median", "aerLate3"],
  ["6. Aerial within ±1 frame of own median", "aerAbs1"], ["6. Aerial timing deviation sd, frames", "aerSd"],
  ["6. Roll out of shield by players who usually wavedash out of shield", "oosSub"],
  ["Wavedashes measured", "wdN"], ["Wavedash airdodge on the earliest frame", "wdPerfect"],
  ["Wavedash airdodge 1 frame late", "wd1"], ["Wavedash airdodge ≥ 2 frames late", "wd2"], ["Wavedash delay mean ± sd, frames", "wdDelay"],
  ["Wavedash angle below horizontal, deg: p10 / median / p90", "wdAngle"], ["Wavedash angle sd within a player, deg (median player)", "wdAngleSd"],
  ["Tech attempts on landing from hitstun or tumble", "techN"], ["Tech success", "techRate"],
  ["Tech: no L/R press in 40 frames before contact", "techNoPress"], ["Tech: last press, frames before contact: mean ± sd", "techTiming"],
  ["7. Tech rolls chased (opponent within 60 units, chaser idle)", "tcN"], ["7. Stick toward the roll under 12 frames (guess, not reaction)", "tcGuess"],
  ["7. Reaction, frames ≥ 12: p5 / p10 / p25 / median / p90", "tc"], ["7. Reaction, frames ≥ 12: mean ± sd", "tcMeanSd"],
];
console.log(head);
for (const [label, key] of rows) {
  if (!key) { console.log(`| ${label} | ${ranks.map((k) => `${counts[k]!.games} / ${counts[k]!.players} / ${counts[k]!.minutes.toFixed(0)}`).join(" | ")} |`); continue; }
  console.log(`| ${label} | ${ranks.map((k) => out[k]![key] ?? "-").join(" | ")} |`);
}
