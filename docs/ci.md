# CI

| Workflow | Runs | Does |
| --- | --- | --- |
| CI (smashcraft:.github/workflows/ci.yml) | every push except `farm/**`, pull requests, dispatch | development loop, perf gate, Lua32 suites, and the sweeps the suites skip (Sweeps (Bun), Lua32 (sweeps)) |
| Main is red (smashcraft:.github/workflows/main-red.yml) | after each CI run on main | the sheriff reverts a landing that turned green main red, then opens, updates or closes the "main is red" issue (smashcraft:AGENTS.md) |
| Farm test (smashcraft:.github/workflows/farm-test.yml) | `bun wisp farm test`, autoland | full Bun and Lua32 suites, sharded (wisp:docs/farm.md) |
| Autoland (smashcraft:.github/workflows/autoland.yml) | push to `claude/**`, dispatch with `branch` | lands the branch on main when it passes |

## Autoland

Cloud workers can push only to `claude/` branches. A push to `claude/NAME`
lands it on main by itself when it passes; nobody has to fetch, rebase or
test it locally.

1. **Rebase.** The branch's commits are rebased onto main. A conflict stops
   the run and names the conflicting files.
2. **Checks.** The rebased commit is pushed to a scratch `farm/autoland-SHA`
   branch, which runs the pre-push gate (type check, source shapes, model
   facts; smashcraft:ts/scripts/prePush.ts).
3. **Suites.** The farm test workflow runs the full Bun and Lua32 suites for
   the rebased commit inside the autoland run.
4. **Land.** Only when the suites pass on that exact rebased commit, main's
   known failures included (#394), and main hasn't moved meanwhile, the
   commit is pushed to main (a plain fast-forward) and the branch is
   deleted. If main moved, the branch is queued again, so the commit that
   lands is always the one tested. Pushes made with the workflow token start
   no workflows, so the run dispatches main's CI for the landed commit. A
   dispatched run starts no `workflow_run` either, so that CI run's last job
   dispatches "Main is red" with its own run ID.
5. **Refuse.** On a conflict, a failed check or any failing test, the branch
   stays and every issue the commits reference (`Refs smashcraft#N`) gets a
   comment naming the files or tests and linking the run. Push a fix to the
   same branch and it tries again.

The push itself only queues a run of main's copy of the workflow, so a
branch made from an older main still lands with the current rules. Runs
share one concurrency group with a queue, so branches land one at a
time in push order and never race main. The run's own status is red
whenever a suite shard fails, main's known failures included; its `land`
job and summary say whether it landed. To retry a branch without a new
commit: `gh workflow run autoland.yml -f branch=claude/NAME`.

Everything runs on GitHub's hosted runners from source: no private build
inputs, no `.w3x` build. A commit that changes `.github/workflows/` can't
land this way (the workflow token may not push workflow changes); the run
says so on the issue, and it lands through a normal `safe-push`.

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
