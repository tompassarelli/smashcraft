# Farm

- Compute farm: `bun wisp farm test [--ref REF] [--wait]` runs the full Bun
  and 32-bit Lua suites, sharded by measured time
  (smashcraft:.github/workflows/farm-test.yml). It refuses a commit already
  on main (main's CI runs these suites) or queued in Autoland (the train runs
  them).
  Balance, Playtest and memory soaks run only on a commit on main or on a lane
  tip named with `--lane NAME` (pushed to `claude/NAME`), never on a scratch
  branch; perf, pads and difficulty runs may also use a `farm/` scratch branch.
  A newer run of the same shape on the same line (main, the lane or the
  scratch commit) cancels the older one, and every job first cancels its run
  when the commit has left main (or main reverted it) and its lane
  (smashcraft:ts/scripts/farmGuard.ts). Job timeouts sit about 1.5 times above
  the longest measured job.
  `bun wisp farm balance [--ref REF] [--lane NAME] [--wait]` plays the
  balance gate's computer field (Wren Expert, 400 a pair; `--opponent`, `--tier`,
  `--per-pair`, `--seeds`) on GitHub's free hosted runners, a `cpuField
  --pairs` process a core, eight pairs a job and at most 8 jobs at once (the
  account runs 20 jobs at once; wisp:docs/ci.md, "Runner capacity and
  waiting"), then each fighter's spam probe (its top damage move only,
  `--probe N` matches a pair, 40 by default, 0 to skip), and with `--wait`
  prints the verdicts, the field table and the damage-by-move, play-style,
  openings-per-kill and balance-score tables (smashcraft:docs/design/balance.md).
  Local saved fields use `bun scripts/cpuField.ts --merge FILE`;
  `--seed-offset N` starts a fresh seed range for optimizer holdouts.
  A Wren Expert run with at least 400 matches per pair fails when the win-rate
  gate or the balanced gate fails, after publishing the report artifact;
  lower-tier or smaller exploratory fields remain reports.
  `--matchups rifleman:chen-stormstout,lich:chen-stormstout` runs only those
  named pairs for a repair comparison; its report is not a full-roster gate.
  `bun wisp farm pads [--ref REF] [--only PATH]... [--wait]` plays
  every top-level smashcraft:ts/test/native/pads/ script (or each issue
  file or folder named by `--only`, such as `--only 151 --only rifleman-cues.pad`) headless through the
  real helper against its own `#!` expectations, for a change that moves hit
  timing or a new issue script on a loaded host; each job uploads its traces
  (`gh run download RUN`), the source of a new script's `#! expect` lines;
  `bun wisp farm perf ["RUN ARGS" ...] [--out DIR]` runs each
  `bun wisp perf RUN ARGS` in its own job (default `playable-bot-four`),
  prints each summary and writes each run to DIR. Predictions come from
  counts, so a runner predicts what this machine would; use it instead of a
  local perf run; `bun wisp farm memory [--minutes N] [--wait]` runs the
  30-minute memory soak (also nightly). Without `--ref` it measures the checkout's HEAD (a commit not on
  main goes to a scratch `farm/` branch, deleted after the run).
  `bun wisp farm memory --matches 50 --ref FULL_SHA --wait` runs the playable
  Lua build in two clients per job through 50 all-computer matches across at most
  four jobs, including rematches,
  and fails on a crash or desync. `bun wisp soak memory --matches N --bundle FILE`
  checks an extracted playable Lua bundle locally; its report names every match.
  Use the farm instead of a local cpuField or pad run: the repository is public, so the
  runners cost nothing, and this machine stays free.
