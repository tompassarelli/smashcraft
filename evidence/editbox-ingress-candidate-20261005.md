# Local editbox input candidate

This #26 candidate passed its bounded two-client short-tap/stall corpus on
5 October after the helper repair; broader acceptance remains open. See
wc3-melee:evidence/editbox-ingress-native-20261005/README.md for the final result
and raw traces. It integrates the locally polled editbox
boundary demonstrated in wc3-melee:evidence/frame-tagged-native-results-20261004.md
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
~/code/wc3-melee/worktrees/playable-integration-20261005/build.sh "$SMASHCRAFT_BASE_MAP"
```

The lane needs the same prepared generated art as the existing integration
lane. The parent owns packaging and both authenticated native clients. No player
release counter changes. After loading the diagnostic and starting a match,
use the existing native driver with its binary changed to
~/code/wc3-melee/worktrees/playable-integration-20261005/companion/target/debug/wc3-journal
and replace `--mailbox-display` with `--editbox-display`. The equivalent helper
invocation per client is:

```sh
~/code/wc3-melee/worktrees/playable-integration-20261005/companion/target/debug/wc3-journal \
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
class compiles to Lua with zero errors/warnings. The integrated map at source
`2248e78` compiles and packages successfully with the pinned toolchain (zero
errors, 27 existing warnings). The full build also includes the confirmed KO
renderer. Native input acceptance failed in the first integrated trial below.

Private candidate:
~/.local/share/smashcraft-build-inputs/playable-integration-20261005/build/editbox-20261005.w3x.
SHA256: `2a986994cf17f6364aa05bf9ffeebb84f723f6c858aeab64bf2dfc76e1a7ed44`.

Helper SHA256:
`e70b54cc3e20146c456a9bb97df097972a55f0c82c1b9e31de800513fd472259`.

## First integrated native trial

Both retained online clients loaded `editbox-20261005`; both received both
production-channel startup markers. The existing virtual-controller driver
produced 5 ms taps at 0.3, 1.6 and 2.6 seconds, half-stick motion from 0.6 to
1.1 seconds, a verified 250.013 ms helper stop and a 249.935 ms game stop.

The helper's text call became too slow: median packet emission was 219.587 ms
for A (145 completed emissions) and 219.932 ms for B (150). Many neutral packets
were only nine characters including the delimiter; the largest observed call
was 761.933 ms. A had published through frame 291 when the driver's 25-second
completion wait expired; B reached 300. Helpers were resumed/reaped and the
virtual device destroyed. This is a measured helper-emission bottleneck, not a
Warcraft sync latency result or an engine throughput limit.

The initial five-native-second traces contain zero admitted/sent rows and zero
confirmed frames. Later native observation showed the stopped-input message;
the initial trace had already ended, so it does not contain that rejection's
cause. Do not attribute the rejection to slow emission alone. The owning next
repairs are the helper's text-emission boundary and capturing the map's first
rejection independently of the short trace window.

Evidence stays in the integration lane's
wc3-melee:build/native-editbox-20261005/ (producer/kernel logs, both helper logs,
both map traces and compositor video). Neither end-to-end retention nor gameplay
response passed. Playable 0.0.40 and the open #25–#27 claims remain unchanged.

## Isolated native rejection

Diagnostic `editbox-20261005b` adds a failure receipt independent of trace
duration. Map SHA256:
`76b209e855f7771011eda13687d9c3dcd9d972f9372524c2f32793dbe3141784`.
Both clients received `I421100;` through private-display xdotool. Each map
admitted its two rows, both clients received both players' rows, and both
confirmed frame 2 with checksum `401279:850203`. No rejection occurred.

Without leaving that match, the unchanged helper then emitted only
`I421300;` on each client (`--first-frame 3 --stop-frame 4`). Both helper
processes exited successfully. Both native failure receipts contain:

```text
reason=invalid or noncontiguous I4 row: 421300 sequence=3 frame=3
```

The leading capital I was lost across this emission boundary. The successful
xdotool control establishes that the first-packet decoder/admission/direct-sync
path works; it is a diagnostic control, not a substituted production helper.
It does not establish continuous capture, stalls or gameplay acceptance.
Enigo's remapped-key path versus existing shifted-key mappings is the current
fidelity hypothesis; the timing defect is independently reproduced without
Warcraft in wc3-melee:evidence/enigo-text-counterexample-20261005/README.md.
The upstream repair owns both demonstrated consumer constraints.

Evidence: wc3-melee:build/load-editbox-20261005b/ and
wc3-melee:build/first-helper-editbox-b/ in the integration lane. All helpers and
virtual devices from these trials exited; the signed-in clients remain open.
