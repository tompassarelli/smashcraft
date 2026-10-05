# Native input/transport probe

Developer-only Phase 0 experiment. Contract and outstanding gates:
wc3-melee:docs/netcode-proposal.md and
wc3-melee:evidence/native-capability-report.md.

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
recovery failure are in wc3-melee:evidence/native-capability-report.md. The per-client
yaw difference is intentional for a future two-client local-mutation check;
that check has not been performed. No input/pose probe establishes rollback
feasibility or native unit prediction safety by itself.

Variant `fighter-playback` uses the current generated Archer model and the
gameplay unit definition to isolate Up Tilt from combat. Supply the original
terrain base map, as above, not an already wrapped gameplay map. Generated
fighter metadata and the Archer MDX must already exist. Output:
wc3-melee:build/netcode-probe/Smashcraft_Fighter_Playback_Probe.w3x.
The left unit runs at 1x and freezes after 15 callbacks; the middle runs at the
gameplay rate and freezes after six; the right plays the whole clip at the
gameplay rate. The cycle repeats after 180 callbacks. These freezes target
the authored sixth-frame contact at 24 source FPS; callback counts do not
prove the native animation clock reached an exact phase. No combat or input
automation runs in this probe.

Variant `pose-controlled` builds
wc3-melee:build/netcode-probe/Smashcraft_Controlled_Pose_Probe.w3x.
It uses original marker/ruler geometry with known Attack and Walk intervals;
ten automatic phases test seconds, model-timeline offsets, clip switching and
backward seeking. Details and observed results are recorded in
wc3-melee:evidence/native-capability-report.md. It requires the existing animation-tool
Bun dependency for MDL/MDX packaging, but no installed fighter assets.

Variant `pose-timeline` builds
wc3-melee:build/netcode-probe/Smashcraft_Timeline_Pose_Probe.w3x. The same known
marker motions now occupy one nonlooping Stand interval (0..5000ms). Models
remain frozen and selected once; phases seek between the two authored motion
segments, revisit earlier times, repeat a pose every tick, and apply multiple
seeks in one callback. The fixture generator writes content-addressed model
filenames and a generated Wurst path constant for both controlled variants.
A same-filename model change was not visible after warm restart; changing its
import identity made the expected timeline visible. Preserve this distinction
when interpreting native experiments.

## Scheduled gameplay diagnostic

Variant `scheduled` builds
wc3-melee:build/netcode-probe/Smashcraft_Scheduled_Input_Probe.w3x:

```bash
bash ~/code/wc3-melee/worktrees/test-loop/tools/netcode-probe/build.sh \
  '/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/Maps/Melee_Prototype_Base.w3m' scheduled
```

Variant `scheduled-5` builds the same source with D=5 instead of D=3, at
wc3-melee:build/netcode-probe/Smashcraft_Scheduled_Input_Probe_5.w3x.
Use separate native sessions and retain each exported trace before the next
run overwrites the diagnostic file. Neither variant changes combat tuning.

This isolated experiment joins the existing keyboard sampler, fixed schedule,
I2 protocol, direct native sync and full pure fighting simulation. It does not
change the installed gameplay map or establish Gate A, multiplayer fairness,
physical latency, or a production backend. It displays numerical fighter state;
there are no fighter models or predictive visuals in this diagnostic.

Both slots use the current default `KeyBindings(false)` preset: W/R left/right,
E down, Space up, I or 8 jump, N attack, U special, O grab, Q or 7 shield,
B or / C-stick left, M right, J up, H down, and P walk/tilt. P1 controls the
Archer and P2 the Rifleman, initially at x=-80/+80 on stage 0 with 99 stocks
and no time limit. Use R to approach the passive opponent, then N to attack;
the HUD shows position, attack/special frame, damage and stocks. Reload through
the native menus for a fresh run. The inherited P1 Ctrl+R callback invokes
`RestartGame(false)`, whose disconnect remains unresolved; do not use it for
this measurement. The restart callback is not a gameplay input source.

One 1/60-game-second native service timer samples actual `BlzIsKeyPressed`
state and attempts at most one gameplay frame per callback. D (3 or 5), R=0
and epoch 1 are fixed for the run. Frames 1..D are agreed neutral; each opportunity captures F+D once
and immediately attempts one 65-byte I2 packet through `BlzSendSyncData` on
`SC_I`. Repeated waits preserve that capture while sampling continues to latch
edges for the next uncaptured row. A false send result leaves the assigned row
unchanged and shows a local fatal diagnostic; sending then stops until restart.
There is no retry, catch-up, prediction, rollback or second reliability layer.

Only registered synchronized receipt events, with identity from
`GetTriggerPlayer`, accept network rows. The common F<=K gate never consults
pending local input or send success. With two humans, both real rows are
required. With exactly one human, the absent slot receives a diagnostic neutral
row for the same frame inside that real row's accepted receive callback. The
HUD and trace mark this solo fixture explicitly. Observers send nothing.
Objects, keyboard handles, frames and receive/capture/playback scratch are
preallocated in common setup. No Wurst object or native handle is allocated in
the local polling/send path.

HUD counters show S (service callbacks), F (next gameplay frame), K (contiguous
accepted frontier), C (executed frame), local sends/failures/errors, per-slot
receipts, common errors, and total/current/maximum waiting callbacks. Sampled
and captured masks are local; consumed masks and fighter state come from
accepted rows. These are game callback counts, never physical latency.

F8 writes Warcraft CustomMapData `smashcraft-scheduled-input-probe.txt`.
The first service callback writes `smashcraft-scheduled-input-probe-ready.txt`.
The trace retains input transitions and aggregates every 60 callbacks, stops
at 2048 records, and reports dropped records. Exclude dumps from timing windows.
Inactive clients sample neutral (latching releases); resuming held keys creates
new sampled presses. Chat/menu focus is not detected: test those separately,
and do not interpret their key sampling as established usable gameplay policy.
Short taps entirely between service callbacks remain unobservable. Native
engine stalls may stop the sampler itself. Slot changes/disconnect recovery and
epoch/rematch negotiation are outside this probe; restart for a fresh run.


The scheduled diagnostic records every successful send, receive and pre-step
advance/wait decision during service callbacks 1..180. After that it returns to
edge/transition and periodic logging, keeping the 2048-entry trace bounded for
ordinary short runs. Export with F8 after callback 180. The ordered records
preserve whether receipt occurred before or after the gate within the same
service-counter interval; that counter alone does not imply simultaneous events.
