# Native commands retain activations missed by polling

Competitive recommendation remains HOLD: retention is improved in this probe,
but independently correct intention-frame assignment is not established.

## Evaluated configuration

Two distinct-account Battle.net clients in private Linux desktops, same-machine
Wine/Proton environment. Exact candidate Smashcraft 0.0.5, build
20261003T164627759078070, SHA256
553d3d8b2488909c12f6e632edd043d4621e5570f23c1700444624d7bb6833ed.
Selected dummy's Q activates zero-cost/zero-cooldown Berserk-based Pulse.
Local key-state sampling runs at 1/60 second. Probe source is in the
native-command-probe-20261004 lane, commit 822a6b5a1c2b4cb4cc61cebffd6a84cf875ee4b2.
Both clients wrote exact-build readiness receipts. A baseline Q activation
produced order 852100 and effect 1097035108.

## Results

| Trial | External X11 pairs | Local sampled pairs | Native orders/effects, each observer |
| --- | ---: | ---: | ---: |
| Run 3, repeated taps | 20 | 12 | 20 / 20 |
| Run 4, before/during/after process stall | 3 | 2 | 3 / 3 |

Run 3 contains 311 service rows per observer, about 5.18 simulation seconds;
run 4 contains 173, about 2.88 simulation seconds. Neither capture overflowed.
Run 3 requested 4 ms holds but X11 measured 16–17 ms, mean 16.35 ms
(0.96–1.02 frames at 60 Hz). Do not compare it as a matched 4 ms trial against
previous production polling results. Run 4 requested 40 ms holds but measured
52 ms (3.12 frames). Xdotool delivery overhead changed the actual stimulus.

Run 4 stopped only owned Warcraft PID 2069007, delivered the middle press and
release while stopped, then resumed it with an EXIT-trap recovery. It was
verified running afterward. X11 timestamps for presses were 458547941,
458548167, 458548697 ms; each release was 52 ms later. No external STOP/CONT
boundary timestamps were retained, so the exact stall duration is unmeasured.
Both observers recorded all three order/effect pairs at identical native game
times: 998.047, 1472.168, 1771.484 ms. These are callback times, not original
intention timestamps. Never subtract X11 time from native game time.

## Interpretation and next action

Measured: native command activation survives a queued press/release during
this controlled process stall while key-state polling omits that pair.
Measured: both observers recorded the same activation sequence in these trials.
This falsifies the claim that all Warcraft input approaches necessarily share
the current polling retention defect. It does not establish physical-controller
latency, acceptable visible recovery, original-frame identity, releases, analog
axes, or a general latency bound. Native commands could retain an activation
and still apply it later than intended.

Next decisive work: repeat actual 4–5 ms taps with an injector whose external
record confirms the duration; reverse participant roles; inspect whether a
supported command or helper channel can carry independent event/frame identity.
Rollback must consume preserved history tagged to its intended common frame;
callback-time tagging alone cannot establish that property.

## Reproduction and evidence

Host exact probe with humans in slots 0/1. Host chat -start resets/selects;
close chat before taps, allow commands to arrive, then host -save exports both.
Record XInput2 RawKeyPress/RawKeyRelease detail 24 and parse native S/E rows.
Filter raw events only, avoiding duplicated ordinary X11 events.

Private X11 logs:
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-command-20261004/{short,hitch}-x11.txt.
Native exports remain in each prefix's Warcraft III/CustomMapData, filenames
smashcraft-command-20261003T164627759078070-p{0,1}-run{3,4}-pageN.txt.

## Corrected rapid taps from participant B

Run 5 reversed the injecting participant to B (slot 1) and explicitly set
xdotool keydown/keyup `--delay 0`. XInput2 measured all 20 pairs, holds 4–5 ms,
mean 4.4 ms (0.24–0.30 frames). B sampled 2 press/release pairs; both observers
recorded 20 orders and 20 effects, with 279 service rows each (4.65 simulation
seconds). The external recording is
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-command-20261004/short-b-x11.txt;
native exports use run5. This confirms rapid activation retention from the
other participant in this configuration. It is not a host/client latency or
fairness comparison: intention and callback clocks remain unaligned.

Run 6 repeated the corrected 4 ms request from A: X11 measured 20 pairs,
4–5 ms holds, mean 4.25 ms. A sampled 2 pairs; both observers recorded
20 orders/20 effects across 277 service rows each. External log:
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-command-20261004/short-a-corrected-x11.txt.
Native exports use run6. Both participants therefore demonstrate retention
under the matched short-tap procedure; this remains distinct from latency parity.
