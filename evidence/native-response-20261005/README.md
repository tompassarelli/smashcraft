# Controller response before prediction catch-up repair — 5 October 2026

The controller candidate retains its tested inputs and supports Start pause,
but its local response still contains avoidable scheduling delay. Twelve local
shield presses on client B were visibly detected with median **83.09 ms** and
maximum **88.89 ms**. Native service rows independently show input already
admitted while local prediction takes another **1–3 callbacks** to reflect it.
This is the next repair in #27; these results do not certify the candidate as
a replacement for playable 0.0.40.

## Exact workload

Same map/helper as wc3-melee:evidence/controller-start-native-20261005/README.md:
`editbox-start-20261005`, integrated source `ff4f6cd`, map SHA256
`314d72009f8e260f836ebc6f7dfb8d0eff6088855a3d482c9d782e1ee1edc5c3`,
helper SHA256 `ea6e7311e5a787cf08beeeb951cd799f01323ff3c643da9e5464098d8a36f6cb`.
Journal/editbox, shadow-d0-r24, pool-predicted, normal stage and Archer/Rifleman.
Both retained clients joined the same online match on one Linux host.

Two virtual evdev controllers fed the actual helpers; only the named actor's
left analog trigger was pressed. Each trial used twelve 250 ms shield holds
with seeded 700–1000 ms gaps. Independent kernel readers retained timestamps;
submission brackets and compositor-ready timestamps share the host monotonic
clock. The game was fresh for each role. Helpers published frames 1–912 and
exited successfully. No input-failure receipt was produced. Both native clients
drained to frame 912 with matching checksum: `392151:30686` in A's trial and
`74572:922443` in B's trial.

## Observed appearance response

| Actor / observation | Detected / attempted | Median | p95 / observed max |
| --- | ---: | ---: | ---: |
| A local press | 9/12 | 89.13 ms | 108.22 ms |
| A local release | 9/12 | 110.88 ms | 188.01 ms |
| B local press | 12/12 | 83.09 ms | 88.89 ms |
| B local release | 12/12 | 81.63 ms | 167.84 ms |
| B's press seen remotely on A | 11/12 | 178.40 ms | 191.20 ms |

These are conditional distributions of detected transitions. Unresolved or
censored observations remain in the raw result, not counted as lost inputs or
quietly included as successful responses. The small sample makes p99 equal to
the observed maximum; neither is a supported worst-case bound.

A's initial broad capture had median 32.60 ms spacing and a 44.04 ms maximum gap.
B's smaller fighter-region capture had median 16.34 ms spacing and a 16.75 ms
maximum gap. Each onset has a lower/upper interval between captured frames.
The roles therefore have different measurement resolution and are not a precise
fairness comparison. Physical controller electronics, separate-machine clocks,
display scanout, movement/attack response and human play are unmeasured.

The old analyzer accepted only a positive blue-tint change and classified A's
negative held-state signal as unresolved. The current region contains fighter
and shield graphics, so the appearance analyzer uses the measured direction
from idle to held appearance. It retains the existing 20%-step / 4x-noise
threshold, two consecutive frames and pre-input rejection. This measures a
shield-linked regional appearance change, not pure blue tint or post-release
actionability. The rejected old result is retained alongside the new analysis.

## Admitted input waits for prediction

B's trial starts the existing clean service probe with Ctrl+G at stage selection,
before Y starts the match and focuses the receiver. After helpers stop, Escape
and Ctrl+H export the probe; Ctrl+T exports a drained endpoint trace. Thus no
keyboard key was held during controller emission.

Thirteen edge-bearing service rows survive the probe's last-row-per-callback
summary. They show first matching predicted shield state 1–3 callbacks after
admission: approximately 16.66–50.00 native game milliseconds. The exporter
overwrites earlier row details when a packet carries multiple inputs, so these
thirteen rows are not a complete edge inventory. Native clock differences here
compare two events in the same map clock; they are not subtracted from host time.

Examples: service row 168 has admitted target 96 but next speculative frame 95
after its update; shield prediction changes at row 170. Row 805 admits target
734 but ends at next speculative frame 732; shield changes at row 808. The
production loop currently permits only one speculative advance per callback,
even with later local frames already present. The repair must consume available
frames before presentation, bounded by local availability, the existing rollback
window and a catch-up budget. It must not retarget events or invent future rows.

## Reproduction and retained files

Capture: wc3-melee:tools/journal-response-capture.py. Analysis of retained numeric
signals: wc3-melee:tools/analyze-journal-response.py. The unchanged video decoder
used here is
~/code/wc3-melee/worktrees/test-loop/build/two-clients/analyze-responsiveness.py.
It pairs NUT frame PTS with compositor-ready timestamps; maximum matching error
was below 0.007 ms. The appearance analysis does not need the video decoder to
recompute results from the retained signals.

A's capture geometry was `600,450 1360x550`, analysis ROI `260,280,520,500`.
B's capture geometry was `1400,730 300x240`, analysis ROI `0,0,300,240`.
Each role's directory contains stimulus, kernel/helper logs, frame color signals,
onset intervals and drained native traces. B also contains all 18 native service
pages and the extracted admission-to-prediction rows. Published text exports
normalize line endings and trailing whitespace; numeric records are unchanged. Original videos and Wayland
logs stay local under wc3-melee:build/native-response-a-20261005 and
wc3-melee:build/native-response-b-service-20261005.
