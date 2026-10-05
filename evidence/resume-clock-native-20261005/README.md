# Resume timestamps survive delayed helper service

The two-client native trial passed on 5 October 2026. Helper B was stopped for
528.948 ms across resume and read its completed RESUME command 361.307 ms after
the publication-derived capture boundary. The fresh 5 ms Attack tap during that
stop retained its expected frame 98 and applied once for each fighter on both
clients. All 600 original frames per player arrived; both clients ended at
frame 600 / checksum `101166:468220`, with zero trace drops or input failures.

The pre-pause and later recovery taps applied at frames 19 and 137. The paused
tap and Attack held through resume generated no gameplay attack. Fourteen
produced key transitions matched fourteen independently observed kernel events.
All twelve eligible Attack edges across the two helpers matched the independent
timestamp-to-frame oracle. See wc3-melee:evidence/resume-clock-native-20261005/summary.json.

## What changed

Source `4d15414` repairs wc3-melee:companion/src/bin/journal.rs. Previously it
classified queued events as paused before reading RESUME, then used the reader's
current time as the new frame origin. Delayed service could discard a new tap
and shift the resumed frame grid.

The helper now reads stable metadata from the same complete native control file
and translates its last content-modification time from realtime to monotonic
time. It retains queued input while publication is incomplete, applies the
capture boundary before replaying that input, and rearms from physical state
at the boundary. A held control still requires release; a genuinely new press
after the boundary keeps its kernel timestamp.

For this Linux candidate, frame assignment is
`S + floor((t - E) * 60 / 1_000_000_000)` for `t >= E`.
`t` is the original kernel monotonic timestamp; `E` is the explicit initial
epoch or local RESUME publication-derived epoch; `S` is the segment's first
frame, already including configured intentional delay. This trial used D=0.
The common paused next-frame barrier was 86. Input before the resumed boundary
is paused input, not a late new action.

The native command begins capture; the map resumes simulation only after both
RESUME acknowledgments reach the common barrier. Capture, map admission,
prediction, visible response and confirmation remain distinct boundaries.

## Clock limits

The clock relation is sampled independently of helper service time. This run
reported 1 ms kernel coarse-clock resolution and approximately 1.100 ms timestamp
uncertainty, including clock sampling and a 100 microsecond relation tolerance.
Stored nanoseconds do not imply nanosecond publication accuracy. Detected clock
relation changes or future publication timestamps stop capture. A clock change
that reverses between samples is not detected.

The supported timestamp-storage contract currently covers btrfs, XFS and tmpfs;
other filesystems are explicitly rejected. Incomplete publication retains at
most 65,536 events, then stops explicitly rather than dropping them. Kernel
SYN_DROPPED also remains a failure, not reconstructed input.

This fixes dependence on helper dequeue time. It does **not** synchronize
separate machines. A and B's local publication anchors still differed by
3.134 ms. The short tap's release therefore belonged to frame 99 on A and 98
on B; each matched its declared local grid. No event was retagged to hide that
difference. Clock uncertainty can affect events close to a frame boundary.
Cross-machine alignment, initial production epoch agreement, rematch and
physical response remain open in #25–#27. Exact playable 0.0.40 is unchanged.

## Candidate and reproduction

- Helper source: `4d15414`; SHA256
  `978f7e2b1f92c906f86b92d8960cd4e0eef05e2a51a929fa6e52775fd3ca1fa4`.
- Existing native diagnostic map: `text-selective-20261005`; SHA256
  `892202f4ec537a4be232579860e652c3fe7a7b0429448ca32293db74d8cbd336`.
  The map was reused unchanged: journal/editbox, shadow-d0-r24, pool-predicted,
  two same-host online clients. No new player release is declared.
- Driver: wc3-melee:tools/journal-resume-capture.py. It consumes retained
  session settings, starts from stage selection, records independent kernel
  events and control-file metadata, and stops only helper B across resume.
- Reconciliation: wc3-melee:tools/journal-resume-result.py against this
  evidence directory. Raw traces, helper logs, producer/kernel records and
  control publications are adjacent. Text copies normalize line endings and trailing
  whitespace; original native bytes remain in
  wc3-melee:build/native-resume-clock-20261005. Private maps stay outside the repository.

Focused Rust resume tests passed 7/7 and the helper built successfully. The
native reconciliation passed after correcting its producer timing assertion:
uinput timestamps the report at SYN_REPORT, which the existing emitter writes
after measuring the individual key write. The recorded kernel timestamp is
the oracle; key-write completion is not its upper bound. The same native corpus
was retained and reanalyzed; no game trial was repeated to obtain a pass.
