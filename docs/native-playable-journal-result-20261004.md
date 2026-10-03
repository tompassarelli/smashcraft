# Native production journal ingress: competitive HOLD

Two retained online Warcraft clients reached confirmed frame 600 with identical
checksum `132930:406073` using original, explicitly assigned journal frames.
The implementation exhibited long delivery/progress stalls. This establishes
scripted ingress and numerical convergence, not competitive responsiveness.

## Candidate and path

- Smashcraft 0.0.18, build `20261003T214300000000000`.
- Private archive SHA256 `21500f0c2d2e0e5e936dd43beab35660843a57c34de87d758b3508b5dfcd4cdd`.
- Source integrates physics main `f14444e` through merge `e2024cb` plus the
  journal changes published with this report.
- Lua production map, nominal 60 Hz service, `shadow-d0-r24`,
  `pool-predicted`, response probe enabled, journal source.
- Two distinct online accounts on the same Linux machine, separate private
  desktops and prefixes; Battle.net transport. Host Archer, second slot Rifleman,
  Sky Deck, three stocks, seven-minute timer. No controller hardware in this path.

Wurst generates canonical existing singleton I3 packets and checks each against
production decode. The host publisher embeds unchanged wires in immutable local
preload files. The map reads the next sequence, verifies epoch and exact frame,
admits it through `captureLocalAt`, and submits the same wire over `SC_GP`.
Confirmation consumes consecutive frames; numerical rollback and pooled
presentation use the existing production implementation. No new combat codec.

Expected frames are authored independently in the corpus: sequence N is frame N
at delay zero. Host playback targets `(N-1)/60` seconds from a monotonic origin.
This is authored playback, **not** a validated physical-capture-to-live-frame rule.
Native clocks are not subtracted across clients or equated to the host clock.

## Evidence

| Observation | Evidence and limit |
| --- | --- |
| Canonical packet corpus | 2,400 encode/decode roundtrips passed: two epochs, two slots, 600 frames each. Only epoch 1 was played. |
| Publication | 1,200 immutable rows, 600 per slot, over 9,984.052 ms. Host publication lateness median 1.179 ms, p95 1.787 ms, max 3.523 ms (0.071, 0.107, 0.211 nominal frames). These are file-publication statistics, not input latency. |
| Original identity | Observed journal rows retain sequence=frame, including 577–600. Both simulations confirmed all consecutive frames through 600. This does not measure physical capture or every receipt individually. |
| Numerical state | Both clients reported `132930:406073` at confirmed F600. Intermediate F320 and F548 checksums also match. Checksums are not a full state-field comparison. |
| Delivery/progress stalls | Window 1 stays at confirmed F292 between native 0.989 and 2.988 seconds, then reaches F320. Window 2 stays at F542 from native 0.990 through 2.989, then reaches F548 at 3.989. Roughly 120 nominal callbacks of unchanged confirmation; source/transport cause not isolated. |
| Rejections | Zero rejected rows and zero trace drops in the retained windows. Tracing started at F291, so this is not an all-session rejection or latency count. |
| Prediction after corpus ends | Window 3 confirms F600, speculative F601, then reports 59–60 speculative failures per 60 callbacks. Finite-source exhaustion is the trigger; exact owning cause remains unresolved. Do not treat this as successful starvation handling. |
| Physics integration | Aggregate tests 627/628. Existing `PhysicsTests.wurst:1863` Archer/profile6/facing−1 roll-entry assertion still fails. Journal tests 2/2 and native candidate build passed. |

The corpus contains held movement, one-frame attack presses and following
releases, shield holds, direction changes and neutral rows. The chosen movement
does not establish a meaningful attack-versus-shield exchange: no damage was
observed at the sampled presentation checkpoints. No stock/result/rematch,
simultaneous-button, physical keyboard baseline, or controlled-hitch claim is made.

## Reproduce and inspect

1. In the owned checkout, run
   `bash tools/netcode-probe/generate-input-journal-corpus.sh` with the locked
   compiler and standard library. Its workspace explicitly disables map-object
   injection; the earlier default injection setting caused a post-test NPE when
   no map archive existed. Correcting workspace configuration closed that driver
   failure; neither packet assertions nor compiler pin changed.
2. Build with journal source, `shadow-d0-r24`, pooled predicted presentation and
   response probe using wc3-melee:build.sh. Use the exact frozen archive above
   for this result; rebuilds are different candidates.
3. Host/join with two accounts, close spare lobby slots, choose fighters and
   Sky Deck, start. Verify both build/epoch/slot ready receipts before publishing.
4. Run the retained Python publisher with build ID, epoch 1 and generated corpus
   path. It performs host file operations only; wires and frames are Wurst-owned.
5. Developer trace uses **Ctrl+T** (registered modifier mask 2). Verify the
   build-specific trace-start receipt. Each window ends after 300 callbacks.
   Preserve each export before starting another window.

Raw artifacts are in wc3-melee:docs/native-playable-journal-20261004:
the publisher, canonical corpus, publication timestamps, and paired three-window
trace exports. The first window begins after F291; no earlier trace exists.

## Decision and next discriminating work

**HOLD the competitive commitment.** Original-frame ingress and eventual
confirmation are supported for this scripted trial. Responsive live pacing,
graceful stalls, physical input timing and acceptable recovery remain release gates.
The observed maximum is not a proven bound.

Delivery pauses → paired native traces → transport/service backlog suspected,
not diagnosed → instrument exact submission/receipt around a bounded singleton
versus existing batch transport trial → separate native callback scheduling from
queue delivery → Battle.net transport and host environment remain coupled.
Custom hosting/FLO may improve delivery; it cannot by itself supply missing
capture timestamps or repair simulation frame assignment.

Finite-source prediction failures → paired F600/F601 trace → source-starvation
path unresolved → reproduce with a missing next row and inspect prediction's
first failure → fix the owning admission/prediction boundary → do not hide the
failure by manufacturing later inputs.

Character design may use deterministic 60 Hz logical frame units provisionally.
Do not commit to a latency-sensitive competitive promise or choose frame data
under an assumed physical-input delay bound from this trial.
