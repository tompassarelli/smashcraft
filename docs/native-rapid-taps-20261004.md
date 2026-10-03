# Native rapid-tap preservation: 4 October 2026

Competitive recommendation remains **HOLD**. The current experimental native
keyboard polling path does not preserve every software-issued short tap in this
trial. This is an implementation-path finding, not an established universal
Warcraft engine limit or a physical-controller measurement.

## Exact setup and result

Same retained online A/B clients and Smashcraft 0.0.1 candidate documented in
[smashcraft:docs/native-session-20261004.md](native-session-20261004.md).
A is slot 0, private display :2, and shield is Q (action bit 256). Inputs were
private XTEST. The response-service probe recorded polling, captured edges,
assigned targets, simulation progress and presentation state in native game time.

| Stimulus | Issued pairs | Native rows | Recorded shield presses/releases | Phase |
| --- | --- | --- | --- | --- |
| Requested 4 ms hold, 80 ms neutral interval | 20 | 114 | 2 / 2 | Combat throughout |
| Requested 40 ms hold, 80 ms neutral interval | 20 | 159 | 20 / 20 | Combat throughout |

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
