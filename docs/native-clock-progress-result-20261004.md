# Native timer progress catches up after a client stop

Smashcraft 0.0.17 build 20261003T212333969582051, SHA256
a2e80ce4fb06b9c512a42609e8b7cffcf5f5a5c7ee4be0cb37409d2cae7d8df1,
ran on the two retained Warcraft III 3.0.0.24268 Linux/GE-Proton clients in
online custom game sc-clock-0017. No restart or sign-in was needed.

The probe starts a native timer and a recurring nominal 60 Hz callback. Every
six callbacks it writes a unique marker with callback count, TimerGetElapsed
milliseconds and the previous native-marker delta. A host observer records
first file visibility, read brackets and previous scan time using one Linux
monotonic clock. After both marker-10 receipts are visible, it stops B, verifies
process state T, and resumes it in a finally-protected path. Observed stop to
resume request was 250.637 ms (15.038 nominal 60 Hz frames). This is a process
stall, not a network latency or physical input measurement.

## Result

All 102 receipts were read: one ready plus fifty markers per client. Both
completed 300 callbacks and 4999.756 ms of native timer progress. Every marker
sequence is present, callback index equals six times marker index, and native
marker deltas range from 99.854 to 100.098 ms on both clients.

Host first-observed times below share the same host clock. Native times remain
observer-local; no native clock is subtracted from another client's clock.

| Marker | A host ms relative to observed stop | A native ms | B host ms relative to observed stop | B native ms |
|---|---:|---:|---:|---:|
| 10 | -2.802 | 1000.000 | -2.341 | 1000.000 |
| 11 | 75.290 | 1100.098 | 256.494 | 1100.098 |
| 12 | 235.684 | 1200.195 | 259.529 | 1200.195 |
| 13 | 284.844 | 1300.049 | 262.354 | 1300.049 |
| 14 | 444.960 | 1400.146 | 436.542 | 1400.146 |

A continued writing markers while B was stopped. B's marker 10→11 host
visibility spacing was 258.835 ms, while native time progressed 100.098 ms.
B's next two native 100 ms intervals appeared only 3.035 and 2.824 ms apart
on the host. Their visibility brackets were 3.798 and 3.306 ms. Thus the record
supports queued/catch-up native progress, rather than a permanently missing
marker or a one-to-one mapping from native timer to elapsed host time.

The first markers also arrive in compressed groups during startup. Across
fifty intervals per client, host first-observed spacing medians are 96.903 ms
for A and 99.510 ms for B, with maxima 160.394 and 258.835 ms respectively.
These are ten-Hz marker-visibility intervals, not frame-render times or input
latency percentiles. The native instrumentation writes files and can influence
service cost. This one five-second-native-time run proves neither a sustained
rate nor a universal scheduling bound. Continuous callback timestamps and
physical presentation remain unmeasured.

## Consequence for the playable input path

Do not derive the original input frame from a recovery callback or assume
TimerGetElapsed is a live wall clock. A helper's continuous clock must have a
defined mapping into the agreed logical fighting timeline, including startup,
pacing, stalls and explicit pauses. This observation does not establish that
Warcraft necessarily changes final input frames: immutable original tags and
production correction already passed the separate 0.0.16 combat test.

Conventional rollback also needs pacing rather than merely clock arithmetic.
GGPO's guide at revision 7ddadef8546a7d99ff0b3530c6056bc8ee4b9c0a instructs
capture at the top of a logical game frame and no advancement when its prediction
limit rejects synchronization. Slippi Netplay at revision
60f7b63496fb6ec7b9180a04f16f3edc0ad89fe2 estimates peer lead from frame numbers,
local send timing and half the measured round trip. The latter is an estimate
whose path-symmetry assumption is not a guaranteed clock bound. These are
factual references, with no implementation code copied or adapted.

The next implementation must retain captured edges and assigned frame identity,
choose and measure a pacing/clock/pause contract, and then connect the journal
to playable simulation. A globally synchronized wall clock is one candidate,
not a requirement established by GGPO or Slippi. Competitive HOLD remains.

## Reproduction

Build wc3-melee:tools/netcode-probe/build-native-clock-progress.sh with the
private base map; the tested compile passed with zero errors/warnings, Lua
syntax and packaged-script equality. Install only the exact versioned map.
Start wc3-melee:docs/native-clock-progress-20261004/observe.py before online
map entry. Adapt and verify its exact process/prefix paths and build ID first;
never signal an unverified process. Host/join using retained distinct accounts.
The observer waits for both marker 10 files before stopping B and requires
both marker 50 files with phase=complete before finishing. Compare every
sequence and callback index, then inspect intervals across the signal brackets.

Raw receipt text, host observations, signals and interval calculations are in
wc3-melee:docs/native-clock-progress-20261004. File visibility bounds observation,
not exact callback execution or disk-write start. Both clients remain in the
completed probe and Maps/00-Smashcraft contains only 0.0.17.
