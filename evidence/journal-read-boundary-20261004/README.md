# One-packet preload boundary

Both clients received the first real I4 packet and advanced to confirmed frame
2 when further reads were stopped. Submission-to-own-receipt took 801.025 ms
and 817.627 ms. The failure is therefore not permanent loss of the sync
registration in this bounded Lua check. It does not establish eventual receipt
for every packet in the earlier native JASS59 workload.

The same two retained Battle.net clients ran the same compiled Lua map in both
trials, using slots 0/1, Archer/Rifleman and the production SC_GP receiver.
Each received both J4 startup markers before a packet was published. The
packet is the unchanged first seven-byte I4 wire from journal59, encoded in
seven symbol files plus its length marker. After reading it, the map submitted
a fixed J5 marker and the packet, then a J6 marker on the next callback, and
performed no further journal reads. All four markers and both packets arrived
on both clients. Their final confirmed-frame-2 checksum was 401279:850203.

Adding `PreloadStart()` and `PreloadEnd(0.)` around the same tooltip assignment
in every generated file did not repair the delay: own-receipt ages were
631.836 ms and 698.486 ms. This was a separate map load with the same map bytes;
the original fixture files were archived while the map was unloaded. The small
sequential timing difference is not a demonstrated improvement. The late
markers and real input arrived together within each sender's observed callback
in both trials. Moving the send to the next callback is therefore insufficient.

These are native game-clock transport ages, not physical controller-to-screen
latencies. Each trial published one neutral packet per client, so neither
establishes sustained controller throughput. Fresh complete trace exports were
collected about 4.3 and 4.7 host seconds after publication. Startup/selection
and read/receipt were observed in the native clients; no helper or controller
device was needed for this file-ingestion counterexample.

Map: ~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/journal-read-boundary.w3x

SHA256: 7c3a650ae6742d7709229d06cbb8b4b4fb3bd9ff43c664655cd9948ffd7aa32d.
Build ID: journal-read-boundary-20261004. Player release numbering was unchanged.
Paired traces and publication times are under
wc3-melee:evidence/journal-read-boundary-20261004/original/ and
wc3-melee:evidence/journal-read-boundary-20261004/lifecycle/.

The selected implementation now replaces repeated preload ingestion with a
local keyboard-state mailbox for the existing timestamped controller records.
The game acknowledges consumed chunks through file output; the helper retains
unacknowledged records. The existing I4 decoder, original-frame admission,
network synchronization and rollback remain the consumers. Native viability of
this replacement is unproved. This does not claim a repair to Warcraft's
preloader internals or to the rejected file-ingestion implementation.
