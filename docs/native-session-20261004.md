# Native online session: 4 October 2026

Competitive recommendation remains **HOLD**. This is a two-client access,
combat, result and rematch smoke test, not latency acceptance or a completed
human controller trial.

## Evaluated setup

- Warcraft III 3.0.0.24268, two distinct online accounts, separate retained
  Wine/Proton prefixes and private desktops on one Linux host.
- Online custom room `sc-integrity-1004`, candidate Smashcraft 0.0.1.
- Both installed archives have SHA-256
  `0893d090f31cab60dba6a7a2e6b3c5fc4d7f873f396f3b283b8c020ccc45f23d`.
- Map build ID `1791035176`; `shadow-d0-r24`, `pool-predicted`, normal scenario.
- Native ready receipts written at 00:06:47 Taipei identify human/fighter mask
  5: host in slot 0, joining client in slot 2. Slots 1 and 3 are EMPTY.
- Inputs were software XTEST events on each private display. No physical Xbox
  timing, scanout latency, macOS/Windows behavior or analog delivery was measured.
- No new impairment was introduced. Wireless/route behavior was not isolated;
  the measured delays below cannot be attributed to Blizzard or local Wi-Fi.

## Observations

| Boundary | Evidence | Scope |
| --- | --- | --- |
| Stored account login | A's log reports Logged in after encrypted-field delivery; native main menu and online lobby subsequently reached | No manual sign-in for this attempt; no indefinite session guarantee |
| Two clients in one online map | Matching room headings, exact installed archive hashes, fresh map ready receipts with mask 5 | Actual native joining; confirms the nonadjacent human/fighter slots in this run |
| Native input and combat | Trace begins in stage selection, enters phase 2, and records attacks for participants 0 and 2 at frames 47 and 96 | Software input delivery and application; no independent expected-frame or response-time claim |
| Confirmed state samples | Both clients report the same six frame/checksum pairs below | Sampled checksums agree; not an exhaustive full-state comparison |
| Prediction correction | A reports corrections/replayed frames; B does too, with different speculative histories | Actual native rollback activity; visual/audio correctness remains unverified |
| Result | Controlled held-left input causes ring-outs; traces reach phase 3 | One scripted match ends; not a competitive playtest |
| Rematch | Native help changes from 0/2 ready to 1/2 after A's Y; B's Y returns to character selection, confirmed by a fresh phase-0 trace; a subsequent trace reaches combat and applies an attack | Second scripted fight started in the retained online session; not accepted responsive human play |

First combat capture: 300 callbacks, approximately 4.997 native-game seconds.
Trace-buffer overflow count is zero on both clients. That is **not** a count
of lost physical or OS input events.

| Confirmed frame | A and B checksum |
| --- | --- |
| 0 | 680896:532859 |
| 35 | 810343:441962 |
| 97 | 145771:268368 |
| 157 | 373997:436935 |
| 217 | 757781:373800 |
| 277 | 920272:935482 |

The rematch combat trace spans another 300 callbacks, approximately 4.990
native-game seconds. Both clients agree at confirmed frames 36, 103, 164, 221
and 284, with checksums respectively 414386:666825, 883616:31653,
414329:551791, 928694:185066 and 46714:715139.

A's first one-second echo summary contains 35 samples, native-clock minimum
83.374 ms, mean 214.985 ms, maximum 433.411 ms. This is map send-to-self-echo
timing, **not** physical local visible response or a network RTT bound. It
supports continued investigation of delivery and presentation, not a cause
assignment or a competitive greenlight.

## Reproduction and retained evidence

Use the native startup and encrypted-login procedure in
warcraft3-development-distilled. Reuse both signed-in clients. Create the room
with the exact candidate under Maps/00-Smashcraft and join it by name from B.
The map's W/R direction controls choose characters; Y confirms character/stage
selection. Verify each phase through the current map trace or visible controls.

Ctrl+T on the first human starts a synchronized 300-callback trace. In the
observed stage-to-match run, Y starts combat; R/W held directions and N attacks
exercise both clients. Record each trace's freshness before reading it.
Ring-outs exercise RESULT; Y on each human exercises rematch readiness.

Private archived traces are in
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-session-20261004/:
first-combat-a.txt, first-combat-b.txt, ringout-a.txt, ringout-b.txt,
rematch-combat-a.txt and rematch-combat-b.txt.
These are authored map diagnostics, not authentication logs. Use the shared
confirmed frame identity to compare checksums; do not equate speculative frames
or calculate delays from unsynchronized clocks.

Native observation now uses the published private-desktop-development-distilled
capture command. It captures the selected compositor with bounded execution,
nonempty output and atomic replacement. Capture failure must stop inspection;
unknown OCR does not establish readiness. Cropped white-text extraction recovered
the result/rematch text when whole-frame OCR missed it. VNC's underlying
capture discrepancy remains unresolved; native capture does not claim to repair
the remote protocol.

## Remaining gates

Physical controller and local visible-response measurements, event preservation
through a service stall, independently correct common-frame assignment, contact
correction presentation/audio, complete responsive fights/rematches, three/four
clients, ten accepted matches and hosting comparisons remain open. This older
candidate is not acceptance of the current production physics/map version.
