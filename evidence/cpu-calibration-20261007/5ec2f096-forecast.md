# Hero-special horizontal forecast, 7 October 2026

Measured source: `5ec2f09619f05fa74d5c387a8fae28b8751219d2`.

Mountain King's special reach compared a 12-frame-old horizontal position
against its current position. Across 52 grounded target trajectories (26
positions from 0 to 500 units and observed velocities of -12 or +12 units
per frame), the four special slots produced 76 mismatches out of 208 choices.
The delayed observation and the current-position reference share every
other target field. Advancing only the observed horizontal position through
the observation delay reduced these mismatches to 0/208.

The retained fixture repeats that comparison for all ten expansion heroes:
2,080 special choices, 0 differences. It also checks that the observed target
was not changed. Fighter data, difficulty rows and acceptance thresholds are
unchanged.

`GAME_TESTS=botHorizontalForecast bun test test/game.test.ts` passed 3/3.
The focused stock Lua 5.3.6 with `-DLUA_32BITS` bundle passed 23/23: the three
horizontal forecast fixtures, Rook Expert's 100-eligible-decision calibration
row, named-profile replay fixtures (150 profile/seed combinations), reaction,
direction-commitment, history, reads and move-value fixtures. The all-13-fighter
direction traces retained zero reversals inside five frames. Push type and
source-shape checks passed.

The exact calibration report from [run 37631769655](https://github.com/tompassarelli/smashcraft/actions/runs/37631769655)
is preserved in `5ec2f096-report.md` and `5ec2f096-report.json`: all 30
identity/tier rows over seeds 0–9, all six developmental paths and all 30
counterplays passed. Its aggregate checks measured 3,000 restored replays
with 0 differences, 3,000 surprise traces with 0 early responses and 27,000
direction requests with 0 reversals inside five frames.

The original field, difficulty and whole-roster kit checks are separate
measurements; this fixture and controlled report do not close their boxes.
