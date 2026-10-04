# Local editbox input candidate

This is an unaccepted #26 candidate. It integrates the locally polled editbox
boundary demonstrated in wc3-melee:docs/frame-tagged-native-results-20261004.md
with the existing live evdev journal, original-frame admission, direct
BlzSendSyncData and local prediction. It does not use editbox event callbacks or
per-packet file acknowledgments. Exact playable 0.0.40 remains the baseline.

The helper types each existing I4 packet followed by `;`. The map reads local
text once per ordinary gameplay callback, admits one packet, sends that exact
packet, and removes only its consumed prefix. Partial packets and subsequent
packets remain in the editbox. Each packet retains its original epoch/frame;
no progress-relative reassignment or delayed polling fallback is added.

The developer-only editbox appears at Warcraft coordinates x=0.04, y=0.55,
width=0.72, height=0.035. It is focused and cleared at match start, hidden and
cleared outside the match. Stop the prior helper before rematching and start a
helper against the new epoch receipt. Stale epoch packets fail admission.
**Ctrl+Y pauses/resumes this candidate**, because ordinary Y occurs in encoded
input. The existing pause barrier and control ACK messages remain in use.
Other input modes keep Y. Focus/caret behavior and pause remain native checks.

The requested text capacity is 4096 characters. A smaller reported native
capacity, reaching the bound, changed unconsumed prefix, malformed packet or
noncontiguous frame stops input explicitly. This is bounded storage, not an
arbitrary interruption guarantee. Native text truncation/caret behavior still
needs observation. Chat and other text-entry focus are not concurrently usable.
The helper retains its existing two-row batching and completed-frame sealing;
this candidate does not establish first-eligible-tick physical response.

## Build and native invocation

Use the existing prepared build inputs, the checked-in compiler pin, and these
build settings with wc3-melee:build.sh:

```sh
WC3_BUILD_ID=editbox-ingress-20261005 \
WC3_DIAGNOSTIC_ID=editbox-ingress-20261005 \
WC3_INPUT_PROFILE=shadow-d0-r24 WC3_PRESENTATION=pool-predicted \
WC3_INPUT_SOURCE=journal WC3_JOURNAL_INGRESS=editbox \
WC3_RESPONSE_SERVICE_PROBE=1 WC3_DEPLOY_MAP=0 \
WC3_PRIVATE_ASSETS="$HOME/.local/share/smashcraft-build-inputs/production-netcode-20261004" \
~/code/wc3-melee/worktrees/input-retention-20261005/build.sh "$SMASHCRAFT_BASE_MAP"
```

The lane needs the same prepared generated art as the existing integration
lane. The parent owns packaging and both authenticated native clients. No player
release counter changes. After loading the diagnostic and starting a match,
use the existing native driver with its binary changed to
~/code/wc3-melee/worktrees/input-retention-20261005/companion/target/debug/wc3-journal
and replace `--mailbox-display` with `--editbox-display`. The equivalent helper
invocation per client is:

```sh
~/code/wc3-melee/worktrees/input-retention-20261005/companion/target/debug/wc3-journal \
  --device "$SMASHCRAFT_EVDEV" --out "$SMASHCRAFT_CUSTOM_MAP_DATA" \
  --ready-file "$SMASHCRAFT_READY_RECEIPT" \
  --epoch-monotonic-ns "$SMASHCRAFT_CAPTURE_EPOCH_NS" \
  --stop-frame 300 --editbox-display "$SMASHCRAFT_DISPLAY" --trace
```

Use the same independently observed normal 5 ms tap, ~250 ms stopped-helper tap,
~250 ms stopped-game tap and half-stick excursion. Reconcile all 300 original
frames and the three tap rows with map traces and fighter behavior; compare
arrival/local response as well as queue catch-up. A helper completion or correct
first tap cannot accept this candidate. The decisive new native seams are text
append, consumed-prefix removal, capacity and focus under the actual producer.

## Source checks

Pinned Rust journal tests pass 9/9 and the helper builds. The new Wurst ingress
class compiles to Lua with zero errors/warnings. A full-game source check passed
the corrected typechecking seam, then stopped at object injection because that
standalone command had no map input. Parent map packaging is still required;
no successful full map build or native acceptance is claimed here.

Helper SHA256:
`e70b54cc3e20146c456a9bb97df097972a55f0c82c1b9e31de800513fd472259`.
