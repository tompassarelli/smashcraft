# Competitive integrity: executive decision

**HOLD the competitive commitment.** Issued 3 October 2026 at 14:27 UTC / 22:27 Taipei, before the unchanged 15:15:25 UTC / 23:15:25 Taipei deadline. Continue the capture/frame-assignment experiment; pause decisions that require guaranteed online input timing. Incomplete evidence does not establish a casual-only limit or justify abandoning Warcraft.

The positive result is meaningful: production simulation tests preserve an F5 shield delivered four logical frames late, remove a temporary false hit through rollback, and match the canonical full state. Moving the original shield assignment to F9 causes damage. The unresolved boundary is therefore **intention → capture → correct common frame**, separately from late packet delivery.

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| 7/7 focused production-simulation tests passed, including contact-changing defense and reordered delivery | Recorded frame identity and final-state correction work in tested cases | Physical capture, native scheduling or acceptable visible corrections |
| One controlled 2.065 s network interruption coincided with a 2.111 s polling gap; an approximately 180 ms tap was absent | Poll-only capture can omit a tap before rollback has anything to replay | Frequency in ordinary play or an unavoidable engine-wide constraint |
| Two retained 39.29 s combat recordings, 32 local presses and 32 releases | Local software-injected press median 36.90 ms (2.21 frames), p95 47.99 ms (2.88), maximum 54.92 ms (3.29); release maximum 71.34 ms (4.28) | A hardware-latency bound or independently correct frame assignment |
| 32 observed remote presses in those recordings | Remote visible median 171.13 ms (10.27 frames), maximum 283.25 ms (17.00) | Acceptable correction experience or the cause of each delay |
| Local-cursor assignment inspected and modeled under four-tick skew | Current assignment depends on each client's progress; common sampling/pause contract remains unproved | That native clients actually exhibit this skew or a measured player-slot advantage |

Frame conversions use 60 Hz. Native captures and injection share one host monotonic clock; no delays are calculated from unsynchronized machine clocks. Software trials bypass controller hardware and physical scanout. Observed maxima are not proven bounds. Retained native results precede Smashcraft 0.0.1 and must not be relabeled as acceptance of that build.

## Design decision

- **Claim today:** deterministic logical-frame combat and tested rollback of received, correctly tagged input. Native capture omissions and response variability remain material.
- **Development target:** competitive quality remains plausible if a supported capture path preserves events and correct common-frame identity through pauses, and native response/correction gates pass.
- **Cannot promise:** Slippi-quality response, arbitrary-spike resilience, fair native frame assignment, seamless corrections, continuous analog delivery or verified support on all three operating systems.
- **Character work:** proceed with provisional startup, active, recovery and physics data in 60 Hz logical frames. Hold guaranteed reaction windows, one-frame online promises and assumptions that a logical tick always consumes 16.67 ms during stalls. Do not hide unknown timing by widening character windows.

## Next gate and architecture delta

The shortest decisive gate is an externally timestamped event sequence surviving a native script-service stall, followed by independently defined common-frame assignment and the contact rollback case on two actual clients. Ordinary controller-to-keyboard mapping still crosses the polling boundary. Native editbox text is a candidate preservation bridge, not a verified solution; rendering text earlier than synchronized callbacks does not prove retention during a stall.

Map scheduling/buffering, the Rust helper and supported native interfaces remain in scope. Hosting options include FLO/W3Champions nodes/equalization and a controlled host. Hosting may improve routing, waits or delivery cadence; it cannot alone reconstruct uncaptured intention. Deeper native integration is an option if cheaper supported seams fail, not an established requirement. Wireless spikes, Blizzard behavior and local engine service must remain separate hypotheses until measured.

Acceptance requires independent expected-frame boundaries and pause rules; no unexplained missing/duplicated/retargeted events or confirmed-state disagreement in the declared envelope; native contact correction in both roles; and separate presentation acceptance. Existing local response targets remain median ≤33 ms, p95 ≤50 ms, p99 ≤83 ms, without recurring unexplained >100 ms responses. A first 1,000-transition native corpus is a release gate, not a proof of universal bounds.

Full evidence, failure classifications, reproduction instructions and remaining gates: wc3-melee:docs/competitive-integrity-decision.md. Complete ongoing goal: wc3-melee:docs/online-delivery-goal.md. Tracking: GitHub #21 within #16–#20. Automated development is off-monitor; no owner controller test is requested now.
