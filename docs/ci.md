# CI

| Workflow | Runs | Does |
| --- | --- | --- |
| CI (smashcraft:.github/workflows/ci.yml) | every push except `farm/**`, pull requests, dispatch | development loop, perf gate, Lua32 suites, and the sweeps the suites skip (Sweeps (Bun), Lua32 (sweeps)) |
| Main is red (smashcraft:.github/workflows/main-red.yml) | after each CI run on main | the sheriff reverts a landing that turned green main red, then opens, updates or closes the "main is red" issue (smashcraft:AGENTS.md) |
| Farm test (smashcraft:.github/workflows/farm-test.yml) | `bun wisp farm test`, autoland | full Bun and Lua32 suites, sharded (wisp:docs/farm.md) |
| Playtest (smashcraft:.github/workflows/playtest.yml) | nightly, dispatch with `matches` | plays computer-versus-computer matches across every fighter, stage and computer level on the newest green main, each seed twice to compare state hashes, and opens or updates one issue per finding kind (smashcraft:docs/commands/soak.md) |
| Autoland (smashcraft:.github/workflows/autoland.yml) | push to `claude/**`, `safe-push --to main`, dispatch with `branch` | main's one landing queue: batches waiting branches, lands on green |
| Effect upgrade (smashcraft:.github/workflows/effect-upgrade.yml) | Mondays, dispatch | `effect-kit upgrade` and `effect-kit check`; a clean upgrade goes to Autoland, findings to the "Weekly Effect upgrade" issue |

## Autoland

Autoland is main's one landing queue. Cloud workers push to `claude/NAME`;
`safe-push --to main` checks a local lane, pushes it to
`claude/land-LANE-SHA` and waits for its verdict (the repository's
.safe-push sets `landing.queue = autoland`). Nobody else pushes main, so no
landing restarts another's suites.

1. **Queue.** A push marks the branch tip with a pending `autoland` commit
   status ("queued"; its time is the arrival order) and queues a run.
2. **Batch.** A run takes every queued branch in arrival order and rebases
   each onto main plus the branches ahead of it. A conflicting branch, or one
   that changes `.github/workflows/` (the workflow token can't push those),
   is refused and the rest go on.
3. **Checks and suites.** The candidate is pushed to a scratch
   `farm/autoland-SHA` branch, which runs the pre-push gate
   (smashcraft:ts/scripts/prePush.ts), and the farm test workflow runs the
   full Bun and Lua32 suites on it inside the run: one farm run per batch.
4. **Land.** Only when the suites pass on that exact candidate, main's known
   failures included (#394), main is fast-forwarded to it, each branch's
   status becomes "landed as SHA" and its branch is deleted. Pushes made with
   the workflow token start no workflows, so the run dispatches main's CI.
5. **Bisect.** A red batch of several branches marks them "bisect" and queues
   one run for each half. A lone red branch gets a failed status and every
   issue its commits reference (`Refs smashcraft#N`) gets a comment naming
   the files or tests and linking the run. The branch stays; push a fix to it
   and it queues again.

Runs share one concurrency group, so batches land one at a time and never
race main; a run that finds nothing queued ends in seconds. The run's own
status is red whenever a suite shard fails; its `land` job and summary say
what landed. To retry a refused branch without a new commit:
`gh workflow run autoland.yml -f branch=claude/NAME`.

Everything runs on GitHub's hosted runners from source: no private build
inputs, no `.w3x` build. A change to `.github/workflows/` lands through
`safe-push`'s direct path, which it takes by itself for such a lane.

## Sheriff

Main's last landing doesn't stay on main red. After each CI run on main,
"Main is red" first runs the sheriff (smashcraft:ts/scripts/sheriff.ts) on it:

- **Revert.** The run failed at a step after setup, and main's previous
  finished CI run was green on an ancestor. Every commit from that green
  commit to the run's commit (the landing, or the whole train) is reverted as
  one `github-actions[bot]` commit on main, carrying `Sheriff-Reverts: SHA...`
  and the commits' `Refs smashcraft#N`. The sheriff dispatches main's CI for
  it and reopens and comments on every issue the commits reference
  (`Refs smashcraft#N` or a subject's `(#N)`) with the failing step and the
  run. No "main is red" issue opens for the reverted run; the revert's own
  CI run reports.
- **Report only.** A cancelled or timed-out run or job, a job without a
  failing step (runner lost), a failing setup step (checkout, Bun, install),
  a red parent (whether the same first failing step or a different one), a
  landing that is itself a revert, one that changes `.github/workflows/`
  (the workflow token can't push those) or one that doesn't revert cleanly:
  the job summary says why and "main is red" reports as before.

The decision is a pure function, checked on main's recorded runs of
2026-10-09 (smashcraft:ts/test/sheriff.test.ts). Rerun it on a run:
`gh workflow run main-red.yml -f run=RUN_ID`.
