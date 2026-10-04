# Native match lifecycle — 5 October 2026

Scope: Linux virtual controllers, two retained Warcraft clients on the same host,
ordinary one-stock matches, keyboard menu confirmation and persistent journal
helpers. This is not physical latency or a cross-machine clock guarantee.

## Accepted result

Source `1955ef9` (lifecycle implementation `547eb88`), map
`match-focus-entry-20261005`, SHA256
`e0e9592d49a6bca1c60da52ea76d5fd34c692b0153d6fc221c6834596ff105a1`.
Helper SHA256 `5f3ef51561b4e662710ca1f26fb654b84f4db43dd9883d59f466271297997486`.
Configuration: journal input, editbox ingress, shadow-d0-r24, pool-predicted,
normal one-stock matches and RESPONSE_SERVICE_PROBE enabled. Pinned Wurst/Lua
compiler 6b129956f6e7cf9582510f26b99d305526bf3ded, stdlib e3714f629113; declared Warcraft API patch v3.0.

- Both helpers started before match confirmation and stayed alive through two
  complete start/result sequences and one ordinary results/selection/rematch.
  No external capture timestamp or per-match helper restart was supplied.
- All eight eligible Attack edges matched independent kernel timestamps and
  local START publication anchors. Four 5 ms taps applied once per fighter at
  original frame 19 on each native client: eight native attack applications.
- A results-only tap produced no action in the next match. Menu confirmation
  needed one 120 ms key press per player after the match-entry latch repair.
- Match 1 ended at confirmed 118/checksum 858608:772108 on both clients;
  match 2 ended at 117/checksum 339439:72128. No trace drops, input failures,
  unexplained retargets or extra attacks were found.
- Input rows recorded beyond the combat result were consumed as terminal data;
  they did not extend combat or leak into the next match. Helper publication
  counts were 138/135 in match 1 and 136/136 in match 2.

The original-frame oracle uses each client's complete START file timestamp,
independently translated to CLOCK_MONOTONIC. Its anchors agreed with the helper
within 501 ns in this corpus. Helpers reported approximately 1.100 ms timestamp
uncertainty. A/B START publications differed by 7.602 ms in match 1 and 1.344 ms in
match 2: these are local grids, not a common cross-machine clock. No stronger
fairness, boundary ambiguity or physical latency conclusion follows.

Raw data and machine-readable result are in
wc3-melee:docs/match-lifecycle-native-20261005/passed/summary.json and its adjacent
files. Both owned helpers were interrupted cleanly and reaped after the pass;
the authenticated Warcraft clients remain available. This is a bounded #25/#26
lifecycle result, not a replacement player release or completion of #17's human
fights. Playable 0.0.40 remains preserved. Controller-only menu navigation, chat,
device reconnect, map reload, hardware, other platforms and full clock/response
acceptance remain open.

## First attempt (retained failure)

Source 547eb88, map `match-lifecycle-20261005`, SHA256
`3583085f9162fd60224f0e9ba8a3996d0214f29f05f546a6047f9a679d0685ad`.
Helper SHA256 `5f3ef51561b4e662710ca1f26fb654b84f4db43dd9883d59f466271297997486`.
Both local START publications were accepted without an external epoch. Each
fighter's 5 ms Attack applied once at original frame 19 on both clients. Stock loss
ended the fight at confirmed 117/checksum 339439:72128. Helpers drained 70 records
and published quiescence; native final receipts reached revision 31, showing the
receiver had hidden ingress. The driver failed waiting for character selection
after its first rematch confirmation. Helpers were cleanly reaped.

A subsequent bounded file-access trace was inconclusive and supplied no diagnosis.
Manual confirmations subsequently advanced the retained game through rematch.
Source inspection found that starting a match suppressed Y keyup after the phase
change, leaving the menu confirmation held. The repair clears that release in
all phases. The driver also uses explicit120 ms menu key holds; its gameplay taps
remain5 ms. Because both were changed, a later pass does not isolate their individual
contributions to the failed menu attempt.

Failed inputs, helper logs, native traces and UI transcript are retained in
wc3-melee:docs/match-lifecycle-native-20261005/failed/.

A setup-only retry of `match-release-20261005` stopped before gameplay: two quick
stock-down clicks registered only once, leaving 2 stocks. The driver now observes
the starting count and waits for each visible decrement. No map rebuild was needed;
wc3-melee:docs/match-lifecycle-native-20261005/failed/stock-setting-ui.txt retains
that rejected fixture attempt.

## Key-release follow-up

Source 9a85f27, map `match-release-20261005`, SHA256
`5651c5be63fff979ea517126eb34e881ef5dd48ce9df8cc605db22ada4cedadd`.
After repairing the stock-setting fixture, native results remained at 1/2 ready.
One additional 120 ms Y press on A immediately reached character selection. This
isolates a stale confirmation latch for the player who started combat; shutdown
acknowledgment and rematch transition were functional. Moving the key-up handler
alone did not fix it. Taking text focus can prevent delivery of the original
release, so entering journal combat now clears all previous menu confirmations
before taking that focus. Native evidence is retained in
wc3-melee:docs/match-lifecycle-native-20261005/failed-release/.
The extra confirmation was diagnostic evidence, not an accepted workaround.

## Reproduction

wc3-melee:tools/journal-match-capture.py starts at stage selection with two real
clients and starts persistent --follow-matches helpers before final confirmation.
It records independent kernel events and START file timestamps, drives two stock
losses and rematch, and retains epoch-specific native traces.
wc3-melee:tools/journal-match-result.py reconciles capture frames and applied attacks.
The concrete private-display session paths are runtime inputs, not portable defaults.

Focused implementation checks: 26/26 Rust journal tests, helper build and 1/1 Wurst
lifecycle test passed. Map compilation passed. These do not replace the native
journey. The repaired native journey passed with the bounded scope above.
