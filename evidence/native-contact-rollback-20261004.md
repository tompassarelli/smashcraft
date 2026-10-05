# Native contact rollback probe 0.0.10

Candidate `Smashcraft 0.0.10` is a terrain-only diagnostic map with the exact
production simulation, shadow input schedule/playback, replay history, and
contact rules from source commit
`62b1a88ae077935b73cdbb457a7f12d86b4421db`. It does not copy fighter models or
claim presentation or physical-controller acceptance.

Build using the pinned compiler/stdlib and the private physics terrain fixture:
The builder reads simulation source from the exact commit above, not the current
map source. The standalone entry point is
wc3-melee:tools/netcode-probe/NativeContactRollbackProbe.wurst; it is deliberately
outside wc3-melee:wurst so ordinary map builds do not import its pending-branch
dependencies. Retain that commit locally when reproducing the historical probe.

```sh
smashcraft:tools/netcode-probe/build-native-contact-rollback.sh \
  /home/tom/.local/share/smashcraft-build-inputs/physics-base.w3m
```

The built candidate from this source is
`/home/tom/.local/share/smashcraft-build-inputs/native-contact-rollback-20261004/build.pnIop0/Smashcraft 0.0.10.w3x`,
SHA-256 `bf71b2ba4923cce99dcb73236ba9dc49ba35a4b24eed768164e9f655a508c4c6`.
Compiler output was zero errors and four unused-import warnings; the Lua syntax
and packaged-script round-trip checks passed.

## Two-client procedure

Use the retained online clients in player slots 0 and 1. Load this exact map in
one online custom game. Each client writes
`smashcraft-contact-rollback-20261004-p{0,1}-ready.txt` on setup. On player 0,
send `-start` in game chat. That executes speculative F1–F8 in both native game
processes with the P0 jab row and predicted neutral P1. It records the transient
speculative damage before the input corpus exists.

After the F8 status appears, append the following exact 208-character string
to player 1's focused editbox. Its records are externally authored and encode
event ID, synthetic elapsed microseconds, intended simulation frame, and shield
held state; elapsed values are not synchronized with Warcraft timer values or
used to choose frames.

```text
V1|900001|000000|000001|0;V1|900002|016667|000002|0;V1|900003|033334|000003|0;V1|900004|050001|000004|0;V1|900005|066668|000005|1;V1|900006|083335|000006|1;V1|900007|100002|000007|0;V1|900008|116669|000008|0;
```

The native timer polls the append-only editbox and sends each unchanged record
through `BlzSendSyncData`. Both clients buffer the received records by original
frame. Once all eight arrive, the probe derives shield press/release edges from
neighboring tagged frame states, accepts remote F8 through F1 at the post-F8
F9 service boundary, adds P0's original local rows, and invokes production
reconciliation. This avoids interpreting input according to callback order.

Each observer exports
`Warcraft III/CustomMapData/smashcraft-contact-rollback-20261004-p{0,1}.txt`.
The export includes the original event wires and observer-local receipt timer
values; transient F8 damage; reconciliation frame; corrected, direct-canonical,
and confirmed F8 damage, checksums, attempted full snapshots and first-difference
comparisons; original F5 row equality; and a direct counterfactual with shield
first pressed at F9. Expected diagnostic indicators are a correction beginning
at F5, temporary speculative damage removed by correction, empty corrected to
canonical and corrected to confirmed F8 differences, a preserved original F5
row, and damage in the F9-shield counterfactual. The native run must verify
these indicators; building the map does not.

In the completed native run, Preload truncated long serialized snapshots. Those
export lines are incomplete; only the full in-memory comparisons and checksums
are accepted. See wc3-melee:evidence/native-contact-rollback-result-20261004.md.

This scenario executes production simulation code inside Warcraft and carries
actual native sync callbacks. It deliberately applies an externally authored
corpus after speculative F8 to create an F9 service boundary. It does not
measure natural network delay, local wall-clock/frame alignment, physical input
capture, rendered correction, audio suppression, or fighter-animation
recovery. Warcraft timer receipt values are per-observer and must not be
subtracted across machines.
