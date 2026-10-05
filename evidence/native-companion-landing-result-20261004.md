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

Evidence: `wc3-melee:evidence/native-journal-packet-comparison-20261004/probe0022-summary.json`
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

Evidence: `wc3-melee:evidence/native-journal-packet-comparison-20261004/companion-live-segment/`.
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
unproved; see `wc3-melee:evidence/hosting-boundary-20261004.md`. Equalization delays
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
latency. Evidence: `wc3-melee:evidence/native-journal-packet-comparison-20261004/rematch0022-summary.json`
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
Evidence: `wc3-melee:evidence/native-journal-packet-comparison-20261004/isolation0023/`.

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

## Native 0.0.24: populated-file path reproduces the backlog

The same retained clients ran exact Smashcraft 0.0.24 / `netcode-0024`, SHA256
`1aa3895cbc98919fe7c300d8e71863e79faae853322bcde3b027b0c05e4c6a0f`.
Fresh readiness receipts identified human/fighter mask 5, slots 0 and 2. Spare
slots were closed; both clients were in MATCH before the diagnostic began.

Each sequential arm offered 300 messages per client at 30 Hz through `SC_GP`.
A generated unique 16-byte strings. B loaded matching-size unique strings from
300 immutable populated preload files per client. C generated neutral canonical
two-row I4 packets and used the production decode/admit/send/receive path without
files. A/B each sent 4,800 payload bytes per client; C sent 2,384. C's different
payload sizes and neutral inputs limit its comparison with production combat.

| Client | Generated 16-byte: mean / max | Populated-file 16-byte: mean / max | Generated I4: mean / max |
| --- | --- | --- | --- |
| A | 95 / 215 ms | 3,989 / 7,555 ms | 100 / 229 ms |
| B | 87 / 215 ms | 4,146 / 7,789 ms | 97 / 213 ms |

All 300 messages arrived in every arm on both clients; reported missing,
duplicate, file-validation, failed-submission and unexpected counts were zero.
B's mean age increased from 809/778 ms in its first 30 messages to 6,745/7,025 ms
in its final 30 messages (A/B). Its drain required another 397/402 callbacks.
Generated A and C did not develop that backlog. Both complete exports appeared
about 37.25 host-wall seconds after the trigger; native spans were 36.79/36.81 s.
Per-message ages use the native game clock. File-read duration again displayed
zero and does not establish zero wall cost inside callbacks.

Under these tested conditions, populated-file loading reproduces the slow
behavior without production I4 decoding or fighting. The generated I4 path
works quickly for this neutral corpus. This narrows the owning failure to the
populated-file integration, but does not yet distinguish fresh preload execution,
the tooltip read/write mechanism, or another interaction. It does not prove
physical capture, ordinary combat responsiveness, or a universal engine quota.
Arm-ending simulation frames differ, so these exports are not paired terminal
checksum evidence. Raw exports, host observation and per-sequence statistics:
`wc3-melee:evidence/native-journal-packet-comparison-20261004/isolation0024/`.

Ctrl+O produced fresh native-order ready receipts on both clients. A subsequent
real XTEST Stop command produced no order receipts on either client, and the
native command panel did not expose a selected Footman. Carrier creation,
selection and command usability remain unproved. This is a failed probe setup,
not a native-order latency or reliability result. Evidence:
`wc3-melee:evidence/native-journal-packet-comparison-20261004/order0024/`.

## Native 0.0.28 FileIO discriminator

Exact candidate SHA256: `38d3fd123d2818d0e16e14b58b23cebb467b0ef1cc79067d8ea8f78077646fae`.
Pinned build passed with zero errors and 19 warnings. Separate measurement and
driver timers corrected an earlier diagnostic defect; Ctrl+P avoids the existing
Ctrl+T trace shortcut. Both retained clients were in MATCH, slots 0/2, other
slots closed. Each arm sent 100 22-byte messages/client at 30 Hz.

Repeated populated paths averaged 97/94 ms; fresh populated paths 132/139 ms;
tooltip-only set/get/clear 108/105 ms (A/B). All 100/100 arrived per arm/client,
with zero reported bad payloads, local read errors, failed sends or duplicates.
Host-observed complete receipts arrived after 10.577 seconds. Fixtures were
local to each client, all named for source slot 2, carrying identical 16-byte
content. Raw receipts and host observation are retained in
`wc3-melee:evidence/native-journal-packet-comparison-20261004/fileio0028/`.

Fresh filenames alone did not reproduce the 0.0.24 changing-content backlog
in this shorter, constant-content run. Changing contents and sustained duration
remain to isolate. This is native echo evidence, not physical response.

The same 0.0.28 session's 300-sample changing-file Ctrl+B reproduction averaged
2,730/2,884 ms (A/B), versus generated 93/86 ms and generated I4 88/95 ms. All
300/300 arrived per arm/client, with zero reported failures or duplicates.
Evidence is in `wc3-melee:evidence/native-journal-packet-comparison-20261004/isolation0028/`.
The corrected collection validates embedded build identity; initial watcher
filename mismatch prevents an exact host observation-latency claim.

The order probe again failed its first command boundary: Stop and a real UI
right-click produced no exact-carrier receipts. Immediate ready flags reported
existing owned Footmen, selection enabled, selected zero. Native details later
showed Footman. This establishes no transport verdict; evidence is in
`wc3-melee:evidence/native-journal-packet-comparison-20261004/order0028/`.

## Native 0.0.29 matched changing-content result

Exact SHA256: `c151677f5decc8172a27c61fc39a3268c323ff68f5d24e9453aa599e8fe2591b`.
Pinned build passed with zero errors/18 warnings. Both retained clients were
in MATCH, slots 0/2, spare slots closed. At 30 Hz, 300 changing values/client
per arm, identical 22-byte payload sizes and independent diagnostic driver:
generated mean 99/89 ms, tooltip-only mean 116/110 ms, fresh-file mean
3,101/3,195 ms. All 300/300 received per arm/client and reported error counters
zero. File maxima were 5,819/5,862 ms. Final host observations at
35.829/35.768 seconds. Raw evidence:
`wc3-melee:evidence/native-journal-packet-comparison-20261004/fileio0029/`.

Tooltip set/get/clear alone is insufficient to reproduce the populated-file
delay under this matched workload. Remaining distinction: Preloader execution
versus FileIO wrapper, and constant content at matched duration. Native timings
are own-echo, not physical response or competitive acceptance.

## Native 0.0.29 short transport comparison

Same two retained clients, slots 0/2, exact 0.0.29 artifact cited above.
Each arm injected 60 signed 32-bit values per client at 30 and 60 Hz, including
extremes and varying patterns. Each observer expected 120 values. Independent
game-clock timing measured own submission-to-receipt, not physical response.

| Rate / transport | A mean/max | B mean/max | Per-observer integrity |
|---|---:|---:|---|
| 30 Hz direct sync | 166/198 ms | 158/198 ms | 118/120 valid, two invalid |
| 30 Hz GameCache + selection marker | 162/199 ms | 155/198 ms | 120/120, zero reported errors |
| 30 Hz selection digits | 161/195 ms | 156/195 ms | 120/120, zero reported errors |
| 60 Hz direct sync | 158/199 ms | 150/169 ms | 118/120 valid, two invalid |
| 60 Hz GameCache + selection marker | 142/172 ms | 135/172 ms | 120/120, zero reported errors |
| 60 Hz selection digits | 141/172 ms | 135/172 ms | 120/120, zero reported errors |

All direct arms recorded 60 own echoes. Their 17.063/16.030-second phases
included the 15-second drain timeout because completion required valid values.
This is a payload-validation failure, not demonstrated message loss or backlog.
Raw receipts do not identify the invalid values; add per-value wire, expected
and actual diagnostics before naming a cause or ranking performance. Both
selection and direct paths parse strings using S2I, so signed conversion alone
is not yet a demonstrated cause.

GameCache used ntp.w3v, one-character sender missions and two-character sequence
keys, with values changed between rates to prevent stale-cache success. The
selection arm sent framed decimal symbols one at a time, avoiding the 12-unit
selection cap. It changes local selection and does not yet establish harmless
interaction with normal gameplay. Injection lasted two seconds at 30 Hz and
one second at 60 Hz; these trials do not prove sustained capacity, fairness or
a faster physical input path. No superior transport is established yet.

Raw exports and host collection evidence:
wc3-melee:evidence/native-journal-packet-comparison-20261004/transports0029/.

## Native 0.0.29 order-command failure

The improved probe confirmed carrier-selected=1 and stager-selected=0 on both
clients after the 0.5-second callback check; immediate ready selection was zero.
All 12 command buttons were explicitly shown and enabled. Real XTEST Stop
inputs were attempted on A and B. Neither observer exported any order receipt;
both Warcraft processes exited and B displayed an unexpected-error dialog.
Private crash reports identify Warcraft 3.0.0 build 24268 access violation
reading address 0x2C58 on both clients (instruction A: 0x6FFFEF2F1043;
B: 0x6FFFEF321043). This
association does not establish the exact cause or receipt timing. Native-order
transport remains unproved. Crash reports, dumps and replay remain private;
authored observation and numerical ready/selection exports are retained in
wc3-melee:evidence/native-journal-packet-comparison-20261004/order0029/.


## 0.0.31 deciding follow-up

The four-arm 300-sample/client comparison completed with all 16 begin/end
receipts and zero reported integrity errors. Generated changing content averaged
86/68 ms; fresh FileIO changing content 3,170/3,064 ms; direct Preloader changing
content 3,050/2,800 ms; fresh FileIO constant content 85/81 ms (A/B).
The wrapper is not necessary to reproduce the delay; matched duration alone
also does not reproduce it. The owning content-sensitive Preloader cause remains
unresolved. Evidence: wc3-melee:evidence/native-journal-packet-comparison-20261004/fileio0031/.

The subsequent 30/60 Hz short transport diagnostic completed all 12 receipts.
The two invalid direct values per observer/rate are minimum signed integers,
serialized as `-2.147484e+09` and parsed as `-2`. All 60 own echoes arrived.
Compiler root repair is in progress; selection extreme-value encoding also
requires correction before ranking. Generated map Lua emits `-2147483648` and
lowers I2S to tostring. Evidence and full timing table:
wc3-melee:docs/warcraft-api-netcode-findings.md and
wc3-melee:evidence/native-journal-packet-comparison-20261004/transports0031/.

Exact map SHA256 311214a2e6b4d1019be4f98c66e5cec2f8e136b3129f643b0f53de57ee88b9c9;
zero build errors, 18 warnings; native slots 0/2 in one MATCH, spare slots closed.
These are game-clock own-echo measurements. Competitive physical response,
human fights, fairness and full acceptance remain open. PR #22 is merged;
subsequent findings are a new publication checkpoint.
