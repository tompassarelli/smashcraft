# Native controller-tag transport candidate 0.0.11

Prepared while the SDL capture-clock source decision is pending. The standalone
tagged-history probe now accepts ten 26-byte records (260 bytes) in its 320-byte
editbox. Local and per-sender ledgers remain bounded at 16 events, with 32 log
rows. This is a transport diagnostic, not a playable match or a frame clock.

Private candidate:
~/.local/share/smashcraft-build-inputs/frame-tagged-history-probe-20261004/build.uILHcD/Smashcraft 0.0.11.w3x

SHA256: fb3b8011f0374751ec2d6d57c669d74092d74e23765628a5f8fb6000afa81a48.
Build ID: 20261003T192943016422291. Pinned compilation passed with zero errors
and warnings; Lua syntax and archive script round-trip checks passed. No native
loading or runtime acceptance is claimed. Both retained clients are still in
the completed 0.0.10 contact probe, with the same live processes.

Rebuild with wc3-melee:tools/netcode-probe/build-frame-tagged-history.sh,
the private physics-base.w3m fixture, and explicit second argument 0.0.11.
For a native trial, derive records from the retained helper event journal and
an independently declared experiment epoch; preserve event IDs and assigned
frames through the editbox/poll/sync path. Keep cold defective timestamps out
of assignment until their source is repaired. Compare each observer's exact
wire rows to the external corpus, and label source capture, replayed journal
delivery, frame derivation and presentation separately.

Existing 0.0.9 native measurements apply only to their original candidate/hash,
with the original 240-byte cap. This candidate's larger cap and controller-sourced
corpus require their own native check. Export filenames still use run/slot;
copy earlier exports before overwriting them during a new trial.


## Completed native journal replay

Both retained, distinct-account online clients loaded the exact candidate above
on Warcraft III 3.0.0.24268, Linux/GE-Proton. No client restart or login occurred.
Each appended the same ten Attack transitions from the first ten warm-helper
journal entries in wc3-melee:evidence/controller-event-history-20261004/virtual-test/warm-helper.tsv.
The declared epoch is the first selected SDL capture timestamp, 566824783 ns.
Frames are independently calculated as 1 + floor(elapsed_ns * 60 / 1000000000),
D=0. Serialized elapsed microseconds truncate the source nanoseconds; frame tags
use the original nanoseconds. This epoch is not aligned to either live game.

Both game processes were verified stopped before and after text delivery;
stop-request to resume-request measured 250.956681 ms (15.0574 nominal frames)
on the same host monotonic clock. Both resumed in finally. An initial stop-state
check ran before signal delivery was observed and aborted before typing; both
were resumed. The successful procedure polls actual stopped state, bounded by
one second, rather than assuming kill() means the stop already completed.

Each client exported ten local rows and twenty synchronized receipt rows.
Exact per-record comparison matches all ten source records locally and all ten
from each sender at each observer: zero lost, changed or reordered records.
All invalid/duplicate/conflict/rewrite/overflow counters are zero.
Evidence: wc3-melee:evidence/controller-journal-native-20261004/{corpus.json,
delivery.json,client-a.txt,client-b.txt,comparison.json}.
The combined LOCAL_FINAL export is truncated by native Preload; individually
exported wire rows are complete and are the comparison authority.

This proves preservation for a replayed controller journal through the tested
editbox/poll/sync path under this controlled process stop. It bypasses physical
capture and live controller-to-game delivery, does not apply inputs to combat,
and does not establish correct common-frame assignment, presentation latency,
a shared pause rule, or a competitive latency bound. There are ten unique
journal events replayed by two senders, not twenty independent physical samples.
No cross-clock latency is calculated. The SDL cold-start defect remains open.

Retained ending state: both clients in the completed 0.0.11 probe, saved/stopped
recording; both processes remain alive. Earlier 0.0.9 exports were copied privately
before overwrite. Maps/00-Smashcraft now contains only the installed 0.0.11;
0.0.10 is privately archived, not deleted from recovery storage.
