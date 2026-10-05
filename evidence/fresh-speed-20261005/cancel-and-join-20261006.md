# Fresh-match follow-up: password prompt and ≤ 22 s gate — 6 October 2026

**The CANCEL fix works. The ≤ 22 s gate is not met.** With the fix, three
runs completed: 27.172, 27.190 and 25.233 s from rebuild start to both quick
receipts. Run 5 hit Battle.net's password prompt on the guest and cancelled
it automatically. The join phase is what keeps the time over 22 s. Two fixes
to it have now failed, so this gate is stopped and reported.

## Setup

- Source: integration HEAD `30381c4` (Wisp rename) plus the CANCEL change in
  this lane. Commands now run as `bun scripts/wisp.ts`; desktop timings are
  enabled with `WISP_DESKTOP_TIMINGS=1`.
- Map: the same private integrity diagnostic copy, rebuilt from `30381c4`
  (`--profile integrity`, cold compile 7.03 s, not counted; the stage deck
  path is present). Timed runs reused that compiled script.
- Command per run, in a 6-CPU capacity scope:
  `fresh MAP --rebuild --from-game --profile integrity`. Each run started
  from the previous run's quick match.

## Change

`fresh` now handles the password prompt that Battle.net sometimes shows
over a guest's joined lobby (the game has no password). While waiting for
the lobby, if the guest's lobby label is not readable and the prompt's
CANCEL/CONFIRM buttons are, `fresh` clicks CANCEL and keeps waiting.
smashcraft:ts/test/wisp.test.ts covers this with a fake prompt case. That
case times out if the CANCEL branch is disabled.

## Runs

Phase durations are the time automation observed each boundary, in seconds.
"Leave" is when the slower client reached Custom Games.

| Run | Join route | Wall | Rebuild | Leave | Host | Join | Lobby full | Start → selection | Quick | Prompt cancelled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | lane (name typed during hosting) + CANCEL | 27.172 | 0.186 | 5.037 | 6.714 | 4.239 | 0.232 | 10.181 | 0.304 | yes |
| 6 | same | 27.190 | 0.188 | 4.572 | 6.868 | 4.644 | 0.269 | 10.033 | 0.298 | no |
| 7 | same | 25.233 | 0.182 | 3.518 | 6.101 | 4.398 | 0.336 | 10.105 | 0.300 | no |
| **Median 5–7** | | **27.172** | 0.186 | 4.572 | 6.714 | 4.398 | 0.269 | 10.105 | 0.300 | |
| 8 | name typed after hosting, separate click/type/Join | 28.193 | 0.206 | 4.491 | 6.450 | 5.923 | 0.250 | 10.249 | 0.308 | no |
| 9 | same | 28.102 | 0.199 | 4.464 | 6.481 | 5.864 | 0.265 | 10.232 | 0.321 | no |
| 10 | same | 28.765 | 0.248 | 4.920 | 7.355 | 5.102 | 0.217 | 10.159 | 0.457 | no |

## Join phase: two failed fixes

1. 5 October, run 3: type the name only after hosting, batched with Join.
   The join took 6.548 s.
2. Today, runs 8–10: restore the earlier route that joined in 0.94, 0.95 and
   1.55 s on 5 October (name typed after hosting, separate actions). The
   join took 5.10–5.92 s.

Every join measured from 5 October 22:57 onward took 3.9–8.2 s on both
routes. The fast joins happened only before then, so the route does not
explain the difference. These measurements cannot tell whether the delay is
on Battle.net's side or in the guest client. Runs 8–10 were reverted; the
committed `fresh` is the code of runs 5–7.

## Recommendation

If #39 must reach 22 s, test a restart that skips the Battle.net round trip.
The map already has a Ctrl+R developer chord that calls `RestartGame(false)`
in the running game. That would remove the leave, host, join and countdown
phases (about 15 s per run). It is unverified whether a restart loads a
script rebuilt on disk on both clients, and it could desync. Cost: about
30 minutes plus a few native runs. Otherwise, set the box to this route's
measured result: ≤ 28 s over 3 runs. Runs 5–7 pass that.
