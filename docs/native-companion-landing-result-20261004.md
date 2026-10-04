# Native controller and transport landing result — 4 October 2026

**Competitive verdict: HOLD. The full low-latency goal remains incomplete.**
The original 08:38:38 Taipei deadline and earlier playable checkpoints were missed.

## Observed candidate and transport

Two retained Warcraft III 3.0 clients, distinct Battle.net accounts and private
Linux desktops on one host, ran Smashcraft 0.0.22 / build `netcode-0022`.
Archive SHA256: `c8d1b24762a93f882fd0a583eac0e6eaf27e26fdf2cf60830755ea0ff0194404`.
Configuration: journal input, `shadow-d0-r24`, predicted pool presentation.

Canonical I4 packets shorten epoch/frame counters without changing complete
per-frame input state. Protocol tests passed 7/7, journal tests 3/3, corpus
roundtrips covered 2,400 singleton rows and 1,200 pairs; pinned map build passed
with zero errors and 16 existing warnings.

The native paired run still fails latency. These numbers measure successful
native submission to own synchronized receipt, on the native game clock:

| Client | Median | p95 | Maximum | Own frames received at export |
| --- | ---: | ---: | ---: | ---: |
| A | 3,413.368 ms | 6,070.066 ms | 6,320.008 ms | 600/600 |
| B | 4,814.087 ms | 5,572.127 ms | 7,777.078 ms | 594/600 |

Both exports contain 2,657 service rows and 600 submitted original frames.
Maximum submission is one sync call per callback. I4 corpus pairs range from
8 to 26 ASCII bytes. Both clients subsequently confirmed F600 with checksum
`132930:406073`; no rejects or speculative failures appeared in the retained
exhaustion trace. Convergence does not establish response-time acceptance.

Evidence: `wc3-melee:docs/native-journal-packet-comparison-20261004/probe0022-summary.json`
and the corresponding `a-probe0022-*` / `b-probe0022-*` raw pages.

## Actual companion-to-game path

The new Linux `wc3-journal` executable reads raw evdev events with the kernel's
CLOCK_MONOTONIC timestamps. It retains pressed/released edges and per-frame
analog state, seals completed 60 Hz intervals, and writes immutable canonical
paired preload files consumed by the production map. A readiness-parser defect
was found against the actual native quoted receipt and fixed; its focused Rust
check passed 1/1, and the executable was rebuilt with the pinned Rust toolchain.

After both clients were verified at confirmed F600, a declared shared-host
capture segment started at F601. The real companion ran against two virtual
controllers and each client's actual CustomMapData directory. Both helpers
exited successfully after publishing through F1200. Helper B and native client B
were each independently stopped and observed stopped for approximately 250 ms.

All 18 tested Attack edges per device matched the independent kernel timestamps
and the rule `601 + floor((event_ns - capture_epoch_ns) * 60 / 1e9)` exactly.
This includes B's press/release during the stopped-helper interval and its short
press during the stopped-game interval. The host stimulus is scripted; these
are not physical controller or cross-machine alignment measurements.

Both native clients reached match results, phase 3, at confirmed F1094 with
checksum `235781:758612`; the native interface showed “Player 2 wins!” and
0/2 ready. This verifies movement, stock loss and a scripted result through the
actual companion/production decoder/native transport/rollback path. Meaningful
combat contact and visual/audio correction are not established by the final
state alone. Capture files beyond the match end are not claimed as applied.

Evidence: `wc3-melee:docs/native-journal-packet-comparison-20261004/companion-live-segment/`.
The second response recording expired while the companion was being rebuilt,
before this segment began; `companion0022-summary.json` therefore contains zero
submitted frames and is not a latency measurement of this segment.

## Input guarantees and limits

The companion can assign captured events to every completed logical interval
without requiring Warcraft to poll during that interval. The cold stopped-helper
check retained ten Attack edges and their original timestamps; the live segment
above tests the native boundary. Neither establishes an unlimited buffer or an
unconditional every-frame hardware guarantee.

A poll-only path can miss a complete press/release between polls. The evdev
path retains queued captured events through the tested short stalls. Kernel
SYN_DROPPED, capture disconnects, a press never reported by the device, or an
event belonging to an already-published interval cannot be reconstructed; the
helper stops on detected loss instead of assigning a newer frame silently.

Rollback repairs late delivery of correctly captured and framed inputs. It
cannot infer uncaptured intention or correct an unknown clock offset. The
current pause policy is continuous-no-pause and experimental. Cross-machine
epoch alignment, drift, and pause/resume remain unfinished.

A confirmation plateau means the agreed frame stopped advancing while service
callbacks were still observed. It does not identify menus, OS scheduling,
garbage collection, or an unavoidable engine limit. Previous Linux runnable-wait
samples did not explain seconds of starvation, but sleeping/blocking and native
clock catch-up remain relevant possibilities. The earlier isolated 16-byte,
60-send/sec native success remains evidence against an unsupported blanket limit.

Alternative native hosting admission and a matched latency comparison remain
unproved; see `wc3-melee:docs/hosting-boundary-20261004.md`. Equalization delays
faster routes to balance timing. It cannot recover uncaptured events or repair
wrong frame assignment.

## Acceptance still open

Responsive two-human fights/rematches, 3–4 players, ten complete matches,
physical timing against 33 ms median / 50 ms p95 / 83 ms p99, presentation/audio
recovery, Windows/macOS journal capture, Xbox/GameCube/Steam hardware coverage,
and the native hosting comparison remain required. The existing physics result
is 627/628 with its known roll-entry failure retained. No gate was weakened.

## Rematch and control correction

Both native clients returned through rematch to stage selection and started
fresh journal epoch 2. Both rebuilt helpers then published F1–F600 successfully
with controlled helper/client stops. The clean recording retained 2,700 service
rows/client and reached confirmed F458 before recording expired: 522 own frames
were submitted and 458 received per client. Own-echo median was 5,386.596 ms on
A and 6,218.444 ms on B; p95 was 7,991.455/8,163.939 ms, maximum
8,080.260/8,297.240 ms. Native phase was MATCH throughout this recording.
These are internal game-clock transport numbers, not physical input-to-screen
latency. Evidence: `wc3-melee:docs/native-journal-packet-comparison-20261004/rematch0022-summary.json`
and its corresponding raw pages/capture directory.

The existing global Y latch suppressed the second player's overlapping RESULT
confirmation. RESULT now accepts each player's fresh confirmation while the
shared pause latch and cross-phase menu guard remain in force. All seven focused
MatchControls tests passed. The fix is intended for the next built candidate;
it is not contained in the frozen 0.0.22 archive tested above.

## Native 0.0.23 transport isolation

Both retained clients loaded exact 0.0.23 / `netcode-0023`, SHA256
`0294d0f452d81e3c84b5ffcf197bd724d11ef58e807a63e9786be00fcf08afb2`.
Its pinned build passed with zero errors and 16 existing warnings. Fresh paired
readiness files identified slots 0 and 1, epoch 1, zero input delay and rollback
window 24. Spare slots were closed. The clients were in the started match.

The host's Ctrl+B diagnostic sent 60 unique 16-byte messages per player per arm
at 30 Hz through `SC_GP`. No journal files existed for this build at that time.
The first arm performed 240 missing-file reads per client, returning zero bytes;
the production journal cursor stayed at sequence 1. The second arm skipped reads
and production input. No production I4 packets were offered in either arm.

| Client | Missing-file reads: mean / maximum echo | Reads skipped: mean / maximum echo |
| --- | --- | --- |
| A | 111 / 166 ms | 97 / 124 ms |
| B | 105 / 166 ms | 91 / 124 ms |

All 60 messages arrived in each arm on each client, with zero duplicates,
missing messages or unexpected diagnostic packets. The paired build-specific
exports became observable approximately 14 wall seconds after polling began.
Aggregate timing uses the native game clock; there are no per-sequence latency
rows. Recorded native read duration was zero at its displayed precision and
does not measure blocking wall time inside a callback.

This excludes repeated missing-file reads alone as the cause of seconds-long
delay under these tested conditions. It does not establish the cost of loading
populated files, advancing filenames, production decoding/reconciliation, or
physical controller response. Arms ran sequentially, rather than randomly.
Evidence: `wc3-melee:docs/native-journal-packet-comparison-20261004/isolation0023/`.

After isolation ended, the same clients consumed the canonical paired I4 corpus
and the actual helper's F601–F1200 segment. The response recorder uses a fresh
run number on each start; held developer keys can repeat and increment that
number. The retained production exports are runs 2 and 9, not run 1. Both were
in MATCH throughout. Run 2 contains 2,683 service rows and 586 submitted frames
per client; A received 552 and B 522 at export. Own-echo median/p95/max was
A 3,920.867/5,490.769/5,685.453 ms and
B 5,041.930/6,570.725/6,787.338 ms. The trace later confirmed F600 with checksum
`132930:406073`.

Run 9 contains 2,066 service rows and 420 submitted frames (F601–F1020) per
client at cutoff. A received 402 and B 400. Own-echo median/p95/max was
A 5,114.440/6,872.131/7,038.758 ms and
B 5,131.531/7,444.427/7,611.053 ms. Both helpers exited successfully after
publishing through F1200; later frames are not claimed as applied at this
recording cutoff. Maximum submission was one sync call per service callback
in both recordings. Production delay remains unresolved.
