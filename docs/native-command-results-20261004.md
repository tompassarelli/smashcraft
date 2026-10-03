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
