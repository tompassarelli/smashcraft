# Timestamped text survives a verified process stall

Two distinct-account online clients loaded isolated Smashcraft 0.0.8, build
20261003T174305492238305, SHA256
ea79c4cba40dbd848aad5f2c4b32dd7c799d9c1889cb5186f1816a6205d00284.
Both wrote the correct readiness receipt. Source commit
17f4a821356a752c207f14c335c87b3fe73a32dd is retained in
~/code/wc3-melee/worktrees/timestamp-bridge-probe-20261004.

Each participant received three externally generated ASCII id:timestamp records
in the focused native editbox. Timestamps use this host's CLOCK_MONOTONIC in ns;
they are synthetic payload creation times, not physical device timestamps.
The first two records were injected after SIGSTOP request without explicitly
observing stopped state. For the third record, /proc/PID/status verified T both
before and after injection, then the same process was resumed in finally.
A's verified stopped injection interval was about 9 ms; B's was about 9 ms.
This is a short controlled process stop, not a realistic network-outage test.

Both LOCAL_FINAL strings exactly equal the concatenated externally retained
payloads (57 ASCII characters per client). Both observers exported 116 callbacks,
58 from each player, overflow=0. The final synchronized text for each player
also exactly equals its expected payload on both observers. Callback game time
is not aligned with host monotonic time; no end-to-end latency is calculated.

Measured conclusion: this supported native text path can preserve externally
supplied event IDs/timestamps across a verified process stop and synchronize
the complete strings in this small online trial. This is a candidate bridge,
not a selected production input implementation. Focus ownership, text limits,
throughput, rollover/acknowledgment, common-clock mapping, analog/release encoding,
and visible fighter response remain unverified. Competitive verdict remains HOLD.

Reproduction: load the exact probe with humans slots0/1, verify ready files and
Recording; inject short unique ASCII records; STOP only owned Warcraft PID,
observe T, inject another record, verify T, CONT in finally; click Save / stop;
compare LOCAL_FINAL and final C text by player against independent payloads.
Use a fresh map run or Start to avoid mixing trials. Never subtract game timer
values from host timestamps.

Private stimulus and signal timestamps:
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-command-20261004/timestamp-stimulus.json.
Exports: each prefix's Warcraft III/CustomMapData/
smashcraft-timestamp-20261003T174305492238305-p{0,1}-run1.txt.
