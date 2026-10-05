# Native rapid-tap preservation: 4 October 2026

Competitive recommendation remains **HOLD**. The current experimental native
keyboard polling path does not preserve every software-issued short tap in this
trial. This is an implementation-path finding, not an established universal
Warcraft engine limit or a physical-controller measurement.

## Exact setup and result

Same retained online A/B clients and Smashcraft 0.0.1 candidate documented in
[smashcraft:evidence/native-session-20261004.md](native-session-20261004.md).
A is slot 0, private display :2, and shield is Q (action bit 256). Inputs were
private XTEST. The response-service probe recorded polling, captured edges,
assigned targets, simulation progress and presentation state in native game time.

| Stimulus | Issued pairs | Native rows | Recorded shield presses/releases | Phase |
| --- | --- | --- | --- | --- |
| Requested 4 ms hold, 80 ms neutral interval | 20 | 114 | 2 / 2 | Combat throughout |
| Requested 40 ms hold, 80 ms neutral interval | 20 | 159 | 20 / 20 | Combat throughout |
| Repeated short trial with XInput2 raw observation | 20 | 115 | 3 / 3 | Combat throughout |

The repeated short trial observed all 20 Q presses and 20 releases at the
Xwayland raw-event boundary. Paired X11 timestamps measure actual holds of
4–5 ms, mean 4.3 ms (0.24–0.30 simulation frames). Thus the missing pairs lie
after the observed X11 boundary and before the native polled input history.
This does not yet isolate Wine handling from Warcraft servicing. The X11 clock
was used only for same-server hold intervals, not compared to native game time.

## Controlled service stall

A separate run issued three 40 ms shield pulses: before a controlled process
stop, entirely during the stop, and after continuation. X11 recorded all three
press/release pairs with measured holds of 40 ms each (2.4 simulation frames).
The native probe recorded only two shield press/release pairs across 50 rows,
all combat phase 2. The middle pulse is absent from the polled history.

The shell requested STOP and CONT on the exact owned Warcraft process 125.631 ms
apart (about 7.54 simulation frames). An EXIT trap also resumed the process;
subsequent process state confirmed it was running. This is a controlled
whole-process service stall, not isolated rendering load, packet loss, wireless
jitter, or a measured natural hitch. Host request timestamps do not prove the
precise scheduling suspension interval. Native game clocks were not equated
with host time. This result demonstrates that even a 40 ms software input can
disappear on the current polling path during a service stall; it does not show
that every supported engine/helper architecture must lose it.

At 60 Hz, requested holds are approximately 0.24 and 2.4 simulation frames;
neutral intervals are 4.8 frames. These are requested XTEST durations, not
measured device or OS edge timestamps. Each pair used a separate xdotool process;
process/transport scheduling may increase or vary the actual interval. All
commands completed successfully. That proves issuance, not each engine-visible
transition. No cross-machine latency was calculated.

The short trial's 114 rows cover roughly 1.9 native seconds; the long trial's
159 rows cover roughly 2.65 native seconds. Counts are native poll edge counts,
not a proven hardware loss rate. No median, percentile or maximum physical
response latency is established by this experiment. The initial attempted
trial ran in RESULT with zero polls and was excluded.

## Interpretation and next intervention

Symptom: short software-issued taps fail to appear in the polled input history.
Evidence: 2/20 short versus 20/20 longer shield pairs in combat, with the same
candidate, display and software input path.
Cause/confidence: code inspection establishes that shadow gameplay returns from
synchronized key callbacks without capturing action edges, while polling local
key state once per service callback. A complete press/release between polls
therefore cannot be recovered by that sampler. This explains the result, but
host-side/Xwayland event observation is still needed to locate every missing
pair precisely. Network delivery was not isolated or assigned as the cause.
Classification: demonstrated current input-path limitation; implementation
sampling choice with unresolved earlier delivery contribution.
Intervention: preserve ordered local transitions at their earliest supported
observable boundary, before frame sampling; evaluate whether native key events
provide suitable local timing or require the companion's event history and an
actual supported ingress. Merely latching already-polled edges does not fix an
unobserved tap. Do not substitute synchronized delayed callbacks without
measuring their effect on intended-frame assignment.
Decisive test: repeat both pulse widths with host/X11 transition IDs and
capture/assignment/application IDs; every transition must either enter its
independently expected frame or produce an explicit bounded rejection. Then
repeat through a controlled service stall and the real Xbox path.
Remaining limitation: correctly tagged late network rows may roll back, but
rollback cannot reconstruct a physical intention absent from the recorded
history. Common-frame correctness and acceptable visible correction remain
separate gates.

## Reproduction and private evidence

Start the clean response probe with Ctrl+G during verified combat. Issue twenty
iterations of this private-display command, then export with Ctrl+H:

```sh
env DISPLAY=:2 XAUTHORITY='' xdotool \
  keydown --delay 0 q sleep 0.004 keyup --delay 0 q sleep 0.08
```

Repeat in a fresh probe run replacing 0.004 with 0.04. Verify exported phase 2,
row count and freshness; exclude noncombat runs. Resolve the selected private
display from the actual retained run rather than assuming :2 on another session.

Private authored diagnostics:
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-session-20261004/rapid-taps/
contains short-page0.txt, long-page0.txt and long-page1.txt. Run2 is short; run3
is long. Count pressed/released bit 256 in the B rows. The second long page
contains its final nine rows. No credentials or proprietary assets are included.
The repeated short trial is run4 in x11-short-native-page0.txt; corresponding
XInput2 events are in x11-short-events.txt. Select RawKeyPress/RawKeyRelease,
detail 24, and pair their X11 timestamps; do not double-count ordinary key events.
Controlled-stall evidence is in hitch-native-page0.txt, x11-hitch-events.txt
and hitch-stimulus.txt. The native probe is run5.
