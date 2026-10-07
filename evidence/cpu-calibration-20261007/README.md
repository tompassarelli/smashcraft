# Named opponent calibration, 7 October 2026

Measured [f0ebc35d](https://github.com/tompassarelli/smashcraft/commit/f0ebc35d7380e211e9efe203b199d1bcea924905)
with `bun scripts/cpuCalibration.ts --revision f0ebc35d7380e211e9efe203b199d1bcea924905 --out build/cpu-calibration/report.md --json build/cpu-calibration/report.json`
on [hosted run 37616030754](https://github.com/tompassarelli/smashcraft/actions/runs/37616030754).
The Markdown and JSON files preserve that run's values. All 30 rows use seeds
0–9 and ten decisions per seed per measure. Collection passes all 14 measures
at 100 eligible decisions each; 3,000 restored replays have 0 differences,
3,000 surprise traces have 0 early reactions, and 27,000 requested direction
reversals have 0 reversals inside five frames. Focused Bun fixtures: 31/31.
The unchanged production policy's earlier 46/46 emitted-Lua32 checks remain
the relevant Lua evidence; this report does not claim a new Lua run.

Rook's queued close punishes grow from 20/100 to 100/100 and initiative from
89/100 to 99/100. Ember's legal techs grow from 61/100 to 97/100 and learned
guard forecasts from 0/100 to 70/100. Vale's initiative grows from 86/100 to
98/100. Kite's techs grow from 53/100 to 95/100 and queued close punishes from
10/100 to 100/100. Wren's initiative grows from 91/100 to 100/100 and learned
guard forecasts from 0/100 to 70/100. These are controlled policy choices,
not human win-rate claims or completion of the enduring-flaw fixtures.

Flint reveals a real counterexample: after twenty strikes followed by shield
events, Rookie first switches its forecast after 14–15 observed events,
while Expert takes 21–22. Expert's larger history retains the old pattern.
The report therefore does not yet establish all six developmental paths.

Reuse [difficulty run 37612429463](https://github.com/tompassarelli/smashcraft/actions/runs/37612429463)
on production policy b35a5e61: Expert beats Rookie 98/100 (95 required);
pooled rates strictly rise 11%, 39%, 49%, 70%, 81% (20 matches per pair).
The dated field table comes from [run 37612438157](https://github.com/tompassarelli/smashcraft/actions/runs/37612438157)
on b35a5e61: 31,200 matches, 400 per pair, 100 seeds. The original 40–60%
fighter band fails: Archer 35%, Rifleman 73%, Blademaster 64%, Mountain King
22%, Warden just below 40%, Dreadlord 78%, Beastmaster 33%. No thresholds or
fighter stats changed. Rifleman's existing mirror top-eight assertion also
remains failed (down-tilt ninth, 24 starts; eighth has 39).

Owning scope: [#186](https://github.com/tompassarelli/smashcraft/issues/186).
Individual growth/flaw fixtures, calibrated rows and the original balance/
kit gates remain open. Native evidence is owned separately by the existing
CPU issues. Measurements describe authored Smashcraft opponents only.
