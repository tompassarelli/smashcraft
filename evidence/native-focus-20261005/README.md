# Focus transition repair and remaining delivery gap — 5 October 2026

The sampled-focus helper does not yet provide safe controller delivery across
window switches. In one 300-frame, two-client native trial, the calibrated
non-game window received 32 key events and client A rejected a malformed record
at original frame 47: `I421x100`. Both helpers still reported emission of frames
1–300. Successful helper emission therefore did not establish native delivery.

Map: `editbox-catchup-20261005`, SHA256
`cf05b108d0f18a84fa3e187bb27c41e8033893918b1ca85a581d7d32ffaa2909`.
Helper source `d733203653ab7851527b2d48656e8bbfe868f426`, integrated as `0e1f66b`;
helper SHA256 `e41c384a6e361e2164ec39da52926faa3cf048d3b7c969cc2a9e4b5bad85d12c`.
The source candidate passed 15 helper tests and compiled, but is not accepted
as a native focus fix and is not a replacement player release.

The driver switches A away for 500 ms, with Shield held before loss, a release,
a 5 ms Attack tap and Start while unfocused, Attack and half-stick held through
return, neutral rearm, and a fresh Attack. The sink first observed an intentional
press/release calibration. The focus guard observed loss and neutral rearm;
checking focus before multi-key emission still allowed a record to be split
between windows. The map's rejection remains intact.

Local evidence: wc3-melee:build/native-focus-ready-20261005/.
Reproduction driver: wc3-melee:tools/journal-focus-capture.py.

A subsequent Enigo draft attempted XGrabServer, a focus query, text emission,
and ungrab. Its competing-focus test failed: 702 emitted keys yielded 71 target
and 188 other-window events. This rejects that draft's isolation claim; it does
not establish exactly how Xwayland routed the remaining events. Both the API
and its consumer draft were removed from live source. Patches remain beside the
local counterexample. The scratch test disturbed retained game sessions, so
future library experiments must use a separate scratch X server.

## Directed delivery results

A single packet addressed with XSendEvent was accepted by both native clients:
original frames 1–2 entered the existing decoder and synchronized transport.
The initial library implementation set the Shift event mask alone; Wine entered
lowercase `i`, and both native decoders rejected frame 1. This failed variant is
retained under `directed-mask`; it is not an accepted consumer pin.

Enigo revision `0b7bae348b0ba7108b81bc4c7267e5bb2d6a509b` adds explicit directed
Shift press/release events. Its scratch-Xvfb test delivers 320 mixed-case and
symbol characters plus 96 modifier pairs under competing focus changes, with
all text/releases reaching the selected window and unchanged global held keys.
The version-pinned fork branch is `enigo-delay-repair-20261005`; its main tracks
a different upstream line. MIT notices are preserved. The helper builds with
this immutable pin; its 15 focused tests also pass (before the modifier-only
library follow-up). No unrelated dependency migration was needed.

**Native outcome: destination isolation improved; focus retention still fails.**
The same 300-frame workload produced zero key events in the calibrated sink,
versus 32 for sampled global delivery. Native A accepted frames 1–46 and the
Attack at original frame 7, then expected frame 47 but received a complete packet
starting at frame 57 (`I421v100`). Records 47–56 were emitted by the helper but
not admitted by the map. The decoder correctly stopped; no rows were silently
reassigned and no acceptance rule was weakened. Helper executable SHA256:
`cd8eff3faf6e8ccdb499444d7fb718f6ebe518a84a082c5b0deb68dcfe27be64`.
Evidence is in `directed-modifiers`; the map bytes are unchanged from above.

This demonstrates that server-level emission success cannot stand in for map
receipt across focus transitions. The next owning repair is bounded retained
original records with native acknowledgment/replay and record framing that can
recover an interrupted text transfer. It must keep a window of outstanding
records; returning to the rejected serial per-chunk ACK path would reinstate
its measured throughput bottleneck. This repair is not implemented yet.

The prior tap/stall, Start pause and same-callback prediction results remain
accepted within their recorded scope. Issue #26 owns the remaining focus defect.
Playable 0.0.40 remains the release; this is an incomplete controller candidate.
