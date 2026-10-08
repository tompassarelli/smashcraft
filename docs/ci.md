# CI

| Workflow | Runs | Does |
| --- | --- | --- |
| CI (smashcraft:.github/workflows/ci.yml) | every push except `farm/**`, pull requests, dispatch | development loop, perf gate, Lua32 suites, and the sweeps the suites skip (Sweeps (Bun), Lua32 (sweeps)) |
| Main is red (smashcraft:.github/workflows/main-red.yml) | after each CI run on main | opens, updates or closes the "main is red" issue (smashcraft:AGENTS.md) |
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
4. **Compare.** At the same time, main's own failures come from the newest
   farm result for the base or one of its last 30 main ancestors: the
   summary a previous landing saved (artifact `autoland-summary-SHA`, kept
   14 days) or a `bun wisp farm test` run's. Only when none exists does it
   run `bun wisp farm test --ref BASE`; an ancestor's result can miss what
   broke on main since, so before refusing on one it runs the base too. A test that fails on the branch but
   not in that result is a new failure; a shard that crashed without naming
   a test is new unless main's result also had one in that suite.
5. **Land.** With no new failures, the rebased commits are pushed to main
   (a plain fast-forward) and the branch is
   deleted. Pushes made with the workflow token start no workflows, so the
   run dispatches main's CI for the landed commit; "Main is red" follows that
   CI run as usual. If main moved during the run, the tested commits are
   replayed onto it, as a local landing would; only a conflict sends the
   branch through again.
6. **Refuse.** On a conflict, a failed check or new failures, the branch
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
