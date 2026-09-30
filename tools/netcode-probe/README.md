# Native input/transport probe

Developer-only Phase 0 experiment. Contract and outstanding gates:
wc3-melee:SMASHCRAFT_NETCODE_PROPOSAL.md and
wc3-melee:native-capability-report.md.

Build each artifact through the pinned project compiler:

```bash
bash ~/code/wc3-melee/worktrees/test-loop/tools/netcode-probe/build.sh \
  '/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps/Melee_Prototype_Base.w3m' 1
bash ~/code/wc3-melee/worktrees/test-loop/tools/netcode-probe/build.sh \
  '/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps/Melee_Prototype_Base.w3m' 2
```

Generated maps are wc3-melee:build/netcode-probe/Smashcraft_Input_Probe_1.w3x
and wc3-melee:build/netcode-probe/Smashcraft_Input_Probe_2.w3x. The script does
not overwrite the installed gameplay map. It validates compiler/stdlib pins,
compiles Wurst to Lua, retains the terrain initialization, omits melee victory
triggers and verifies the packaged script. No fighter assets are needed.

Variant 1 sends one sampled row every service tick; variant 2 sends two exact
rows every second tick. Each packet is 180 ASCII bytes including explicit
padding. Both request a 1/60 game-second service timer; actual wall-clock rates
must be measured. This is probe framing, not the production epoch/input-edge
protocol. No prediction, rollback, combat or transport reliability layer exists
here. A rejected native send is counted, never silently retried or re-framed.

The display separates local polling, synchronized key callbacks, and received
sync records. Test N, I, A and modifiers; masks encode N/I/A then shift/control/
alt/meta in the native's bit order. Key-event counters distinguish raw callbacks
from state-changing edges. For a valid pressure/focus test, also inspect the raw
trace rather than treating a counter difference as a missed physical input.
Poll and event state remain visible when they disagree.

The service counter S always progresses with its native callback. The separate
empty R=0 counter advances at most once per service, only through contiguous
accepted rows for every actual human slot. It is not the fighting simulation.
Input ledger rows are preallocated (256 per competitor); invalid/ring-overrun
records, conflicting/identical duplicates, reordering and maximum service-tick
age are counted. Counter age is not physical latency. Native queue contents
are not inspectable; outstanding rows are an observable proxy, not a queue-size
API. Spectators do not send or gate progress.

F8 writes this client's bounded trace to Warcraft's CustomMapData filename
`smashcraft-native-input-probe.txt`. Readiness is written once to
`smashcraft-input-probe-ready.txt`. These files are diagnostics only, not an IPC
input channel. Trace capacity is 2048 rows, after which a drop count is retained;
an overflowed trace is not complete evidence. Dumps are deliberately excluded
from latency measurement windows because file output itself can perturb timing.
Ctrl+R is the existing developer map-restart chord.

For Gate A, record physical input and all three visual indicators externally.
Repeat on two clients and under induced network delay. Include short taps,
repeats, opposite/simultaneous keys, modifiers, chat/menu focus, Alt-Tab,
minimization and the actual controller mapper. This probe samples state once
per native tick; it cannot assert capture of every shorter tap.

For Gate B, compare variants on the same clients/configuration. Record service
bursts/stalls, wall-clock send and receive rates, rejected sends, contiguous
frontier lag, ring overruns, reordering and duplicates. Run with real controlled
network impairment separately from any future application-delivery injection.
Same-room Battle.net is not a LAN test. Keep per-client logs and exact runtime,
graphics, game-speed, route and device settings with each observation.

Build the separate pose probe with the same command and variant `pose` instead
of `1` or `2`. Output: wc3-melee:build/netcode-probe/Smashcraft_Pose_Probe.w3x.
It preallocates four stock Rifleman effects, then compares a naturally played
and frozen Attack with seconds/milliseconds seeks and a live Walk reference.
The displayed phases run automatically every 180 service callbacks. Phase 6
compares clip selection plus immediate seek against an additional seek one
callback later. N restarts the sequence; Ctrl+R reloads the map.

Inspect the actual pose and any embedded particles, not merely the displayed
phase counter. Initial single-client findings and the unresolved clip-change
recovery failure are in wc3-melee:native-capability-report.md. The per-client
yaw difference is intentional for a future two-client local-mutation check;
that check has not been performed. No input/pose probe establishes rollback
feasibility or native unit prediction safety by itself.
