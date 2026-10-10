# CI

| Workflow | Runs | Does |
| --- | --- | --- |
| CI (smashcraft:.github/workflows/ci.yml) | every push except `farm/**` and `claude/**`, pull requests, dispatch | development loop, perf gate, Lua32 suites, and the sweeps the suites skip (Sweeps (Bun), Lua32 (sweeps)); Autoland's dispatch after a landing runs only the smoke job (perf compare and commit metrics), because the farm test already ran every check on that commit |
| Main is red (smashcraft:.github/workflows/main-red.yml) | after each CI run on main | the sheriff reverts a landing that turned green main red, then opens, updates or closes the "main is red" issue (smashcraft:AGENTS.md) |
| Farm test (smashcraft:.github/workflows/farm-test.yml) | `bun wisp farm test`, autoland | every check CI runs: full Bun and Lua32 suites with their sweeps, sharded (wisp:docs/farm.md), and the stack trace, parity corpus, tapes and numeric, perf compare, effect-kit, clean room, benchmark and computer coverage checks. Its summary, uploaded even when the run fails or times out, names each failing test (a Lua test with its module), failing check, Lua budget overrun and missing shard |
| Playtest (smashcraft:.github/workflows/playtest.yml) | nightly, dispatch with `matches` | plays computer-versus-computer matches across every fighter, stage and computer level on the newest green main, each seed twice to compare state hashes, and opens or updates one issue per finding kind (smashcraft:docs/commands/soak.md) |
| Autoland (smashcraft:.github/workflows/autoland.yml) | push to `claude/**`, `safe-push --to main`, dispatch with `branch` | main's one landing queue: tests each waiting tip alone at once, lands trains of tips that passed |
| Effect upgrade (smashcraft:.github/workflows/effect-upgrade.yml) | Mondays, dispatch | `effect-kit upgrade` and `effect-kit check`; a clean upgrade goes to Autoland, findings to the "Weekly Effect upgrade" issue |

## Autoland

Autoland is main's one landing queue. Cloud workers push to `claude/NAME`;
`safe-push --to main` checks a local lane, pushes it to
`claude/land-LANE-SHA` and waits for its verdict (the repository's
.safe-push sets `landing.queue = autoland`). Nobody else pushes main, so no
landing restarts another's suites.

1. **Queue.** A push marks the branch tip with a pending `autoland` commit
   status ("queued") and starts a plan run.
2. **Test alone, at once.** A plan run gives every waiting tip its own test
   run: the tip rebased onto main, the pre-push gate
   (smashcraft:ts/scripts/prePush.ts) on a scratch `farm/autoland-SHA`
   branch and the farm test workflow, which runs every check main's CI runs.
   Tests run in two slots of one farm run each, outside the landing queue, so
   a red tip gets its failed status and issue comment within minutes. A
   conflicting tip, or one that changes `.github/workflows/` (the workflow
   token can't push those), is refused. A green tip becomes "passed alone on
   MAIN as tree TREE".
3. **Train.** One train at a time takes up to 4 tips that passed alone, first
   passed first, and rebases them onto main. A leader whose rebase is the
   very tree it passed alone lands by itself without another suite; any other
   train runs the gate and farm test once as one merged candidate.
4. **Land.** Only when the suites pass on that exact candidate, main's known
   failures included (#394), main is fast-forwarded to it, each branch's
   status becomes "landed as SHA" and its branch is deleted. Pushes made with
   the workflow token start no workflows, so the run dispatches main's CI,
   which runs only its smoke job for a landed commit.
5. **Red.** A red lone tip gets a failed status and every issue its commits
   reference (`Refs smashcraft#N`) gets a comment naming the files or tests
   and linking the run. The branch stays; push a fix to it and it queues
   again. A red train of several tips sends each back to testing alone; the
   first to pass again on main leads the next train and lands without a
   suite.

Every dispatched run ends with a plan, cancelled runs too, and a plan tests
again any pending tip that no unfinished run holds, so a cancelled run never
strands a tip. The scheduling decisions are a pure function, checked on the
queue recorded at 2026-10-10T03:35Z and generated queues
(smashcraft:ts/scripts/autolandCore.ts, ts/scripts/autoland.tests.ts). The
run's own status is red whenever a suite shard fails; its `land` job and
summary say what landed. To test a refused branch again without a new
commit: `gh workflow run autoland.yml -f branch=claude/NAME`.

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
