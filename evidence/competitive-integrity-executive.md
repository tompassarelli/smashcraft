# Competitive integrity: executive decision

> Historical record of the closed #21 decision (3–4 October 2026). Its gates and release targets are superseded: current acceptance is the **Done when** list of each issue under roadmap [#16](https://github.com/tompassarelli/smashcraft/issues/16), with input integrity in [#26](https://github.com/tompassarelli/smashcraft/issues/26).

**HOLD the competitive commitment.** Issued 3 October 2026 at 14:27 UTC / 22:27 Taipei, before the unchanged 15:15:25 UTC / 23:15:25 Taipei deadline. Continue the capture/frame-assignment experiment; pause decisions that require guaranteed online input timing. Incomplete evidence does not establish a casual-only limit or justify abandoning Warcraft.

The positive result is meaningful: production simulation tests preserve an F5 shield delivered four logical frames late, remove a temporary false hit through rollback, and match the canonical full state. This now also works numerically in both native Battle.net clients on the exact 0.0.10 probe candidate. Moving the original shield assignment to F9 causes damage. The unresolved boundary is therefore **intention → capture → correct common frame**, separately from late packet delivery.

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| Native 0.0.10 contact probe on both clients: speculative damage 12, corrected damage 0, shieldstun 7; corrected/canonical/confirmed checksum 383160:327045 and empty in-memory differences | Preserved original F5 defense repairs the scripted exchange through actual native synchronization | Physical capture, naturally late packets, common clocks, visible/audio recovery or human-match acceptance |
| Native 0.0.9 frozen external corpus under verified 250 ms process stops: 9 records/client, both observers receive all 18 unchanged | IDs, timestamps, frame tags and actions survive the tested editbox/poll/sync path | Live controller integration, independent common-frame assignment or a latency bound |
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

The external timestamp/frame-tag retention and native numerical contact-correction gates now have positive evidence. The next gate is live retained controller events with independently defined common-frame assignment, followed by visible/audio recovery and actual human fights. Ordinary controller-to-keyboard mapping still crosses the polling boundary. Native editbox text preserves the tested synthetic records through a process stall; it remains an experimental bridge, not a verified gameplay input solution. The helper's final-state collapse is fixed: it now maps each selected SDL event in order, with 12 focused tests passing. That does not prove earlier backend capture timestamps, Warcraft keyboard polling, live common-frame assignment or visible response.

Exact native contact evidence and exporter limitations: wc3-melee:evidence/native-contact-rollback-result-20261004.md. Full-state comparisons ran in memory; native Preload truncated exported long state strings. The accepted candidate used simulation commit 62b1a88; rebuilding the probe against later physics is a distinct candidate requiring its own check.

Map scheduling/buffering, the Rust helper and supported native interfaces remain in scope. Hosting options include FLO/W3Champions nodes/equalization and a controlled host. Hosting may improve routing, waits or delivery cadence; it cannot alone reconstruct uncaptured intention. Deeper native integration is an option if cheaper supported seams fail, not an established requirement. Wireless spikes, Blizzard behavior and local engine service must remain separate hypotheses until measured.

Acceptance requires independent expected-frame boundaries and pause rules; no unexplained missing/duplicated/retargeted events or confirmed-state disagreement in the declared envelope; native contact correction in both roles; and separate presentation acceptance. Existing local response targets remain median ≤33 ms, p95 ≤50 ms, p99 ≤83 ms, without recurring unexplained >100 ms responses. A first 1,000-transition native corpus is a release gate, not a proof of universal bounds.

Full evidence, failure classifications, reproduction instructions and remaining gates: wc3-melee:evidence/competitive-integrity-decision.md. Current order of work: roadmap #16. Automated development is off-monitor; no owner controller test is requested now.


## Capture update — 4 October 2026

The competitive verdict remains **HOLD**. Native numerical rollback repairs the tested F5 defense delivered four logical frames late; live correct original-frame assignment remains unverified. A controlled Linux SDL cold-start test retained 10/10 edges, but compressed 35.615065 ms of producer spacing to 0.019056 ms in capture timestamps. Warm stopped trials preserved spacing. This is a measured capture-library defect, not an established Warcraft/Battle.net limit or a measured native wrong-frame outcome. Warm-up is not a repair. Source repair and exact sdl3-src dependency consumption remain pending the Tom-owned fork decision because SDL upstream prohibits AI contributions. Physical response, common-clock/pause rules, visible/audio recovery and actual human fights remain open.

Evidence: [capture-clock investigation](https://github.com/tompassarelli/smashcraft/blob/main/evidence/sdl-linux-capture-clock-20261004.md), [retained counterexample](https://github.com/tompassarelli/smashcraft/blob/main/evidence/controller-event-retention-20261004.md).


Native journal replay now passes on 0.0.11: ten original warm SDL Attack edges
per sender survive the tested editbox/poll/sync path during a controlled
250.956681 ms process stop. Both observers receive both exact ten-row streams;
all counters are zero. This is replayed journal transport, not live capture,
common-clock assignment, combat or physical response acceptance. Details:
wc3-melee:evidence/native-controller-tag-candidate-20261004.md.

Native immutable-file ingress now corrects a current-production combat exchange
on both online clients in 0.0.16. Eight authored original-frame rows published
while B was verified stopped yield sixteen exact observer receipts, zero invalid
rows, correction from F5, damage 12→0 and shieldstun 7. Corrected full snapshots
match canonical and confirmed simulation; shifting the defense to F9 instead
leaves 12 damage. This is one scripted exchange, not live physical capture or
continuous playable prediction/presentation acceptance. Competitive **HOLD**
remains pending capture-clock repair, common-frame/pause rules and playable
recovery. Evidence: wc3-melee:evidence/native-file-contact-rollback-result-20261004.md.
