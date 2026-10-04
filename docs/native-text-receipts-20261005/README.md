# Native receipt/replay — 5 October 2026

Status: native focus trial now drains all records; slow recovery remains open.
Playable 0.0.40 is unchanged.

The helper retains original records after emission and removes them only after
native cumulative acknowledgment. Sixteen records can be in flight. Framing,
identity and checksum checks recover interrupted text; retransmissions cannot
execute a record twice or change its payload. Game acknowledgment follows
existing input admission and synchronized submission, not text emission.

The initial candidate passed 17 Rust tests, four pure Wurst tests and native
map compilation. Its focus trial did not pass. Both clients applied the first
Attack at original frame 7 and confirmed through frame 46. A subsequently
admitted through frame 76, but no further A sync delivery appeared in the
retained traces. Repeated 250 ms retransmissions filled A's text box and it
stopped explicitly with `controller text capacity reached`, expected frame 77.
The helper driver timed out waiting for native acknowledgment. The calibrated
other window received zero key events.

A later warm-leave attempt exposed a Battle.net disconnect; B ended by forfeit
at frame 46. This does not establish why A's synchronized delivery stopped.
The failed run is not a clean test of focus recovery or response latency.
It does expose that time-only retransmission can flood a stalled receiver.
A was recovered through the retained signed-in launcher, without new credentials.

Initial map: `text-receipt-20261005`, SHA256
`43da1db36f2d8b2080672ca099627da8c2e2d42d2803b9d9ed83bbb56e5eb7ce`.
Initial helper SHA256:
`ae87e132276f368ea4c8e0f45f501da7d00143579d55c08ac152d3da3fbfff9c`.
Source base: `67e29b7`; receipt implementation is the current owned worktree.
Evidence: wc3-melee:docs/native-text-receipts-20261005/initial/.

The follow-up grants at most one retry window per fresh native receipt revision.
Empty/incomplete input requests recovery; a complete record waiting for game
admission grants no repeated capacity. A stopped native callback therefore
cannot accumulate unlimited retry copies. Original records and queue limits
remain intact. All 18 Rust tests and the helper build pass, including a stalled
receiver with 100 elapsed retry periods and an unchanged receipt. The pure
framing tests remain unchanged and banked. Native map compilation passed with zero errors. Follow-up diagnostic
`text-credit-20261005` SHA256
`f6bf00c42866eb7d69fab26092cf71bd3a5d12ef1c90fcdacc70a4c182f46a53`;
helper SHA256
`ac752d33bd7a48d4b3bf9d5b57d62f0395943c34d33d616bcd6be5795cf8d884`.
That native focus trial also failed: A stopped at expected original frame 141
with text capacity reached, and the helper driver timed out. Final observed
native receipt counts were 70 records on A and 102 on B. The calibrated sink again
received zero key events. The receipt-revision rule was insufficient to prevent
overflow and is not an accepted repair. Raw evidence is under
wc3-melee:docs/native-text-receipts-20261005/credit/.

The next owning repair separates draining the native text box from gameplay
admission with a bounded received-record queue. The no-focus control against the unchanged credit candidate **passed**.
Both helpers exited normally after native ACK 150, and both fresh native endpoint
traces confirmed frame 300 / checksum `614143:814131`. Both response exports recorded
300 sent and 300 received frames, zero unmatched receipts and zero dropped export
rows. Both initial gameplay traces applied A's two 5 ms Attack taps at their
original frames 7 and 109, once each. The shield press/release were captured at
frames 40/58. This establishes bounded ordinary stream delivery; it does not close
focus recovery or physical response. Evidence is under
wc3-melee:docs/native-text-receipts-20261005/control/. No completed input-retention guarantee follows.

The driver also now waits for its newly mapped focus-test window to appear in
the compositor. The first setup attempt failed before any helper started;
that setup failure is retained locally and is not a game-input result.

## Receive queue checkpoint

The receiver now drains complete validated envelopes into a 16-record ring even
while game admission waits. Native receipts distinguish received from consumed;
only consumption releases helper retention/window space. The focused Wurst 5/5
and Rust text 4/4 checks passed; helper and native map compilation passed.

Diagnostic `text-receive-queue-20261005`, map SHA256
`749ab7ad78210bf24a1e37f5b6222100b75dd5d47845d9f2da6cd262c66b8043`.
Helper SHA256: `a7de13116b355016f77b7ac0ae34c952b7f710860dde704da7383e1fc7d99db2`.
Evidence: wc3-melee:docs/native-text-receipts-20261005/receive-queue/.

The 500 ms focus-away workload completed. Both helpers exited normally, both map
receipts reached received=150/consumed=150, and both clients confirmed frame300 /
checksum `614143:814131`. Both response exports contain300 sent/received frames,
zero unmatched receipts and zero dropped export rows. Zero controller key events
reached the calibrated non-game window. The helper captured Attack at original7
and109 and synthesized a neutral release at49; unfocused events and held-through-
return controls were suppressed until neutral. Native data confirms the first
attack at7, shield presentation becoming inactive after return, and submission
plus synchronized receipt of frames49/109. The initial five-second gameplay trace
ends before the second attack: its precise fighter application is not observed.

This fixes the tested text overflow/loss failure, but **does not establish fast
focus recovery**. A emitted423 envelopes for150 unique records (16,157 bytes),
and its own-sync echo median/max was3387.890/6293.091ms. B emitted196 envelopes
and measured113.045/346.878ms. These are native game-clock echo measurements, not
physical input response. Confirmed simulation stopped at46 during recovery;
A's frame300 was sent at14526.886ms and echoed at19269.256ms from probe start.
The no-focus credit control had212/249 envelopes and echo medians177.570/172.863ms;
its source differs from this queue candidate, so this is context, not a matched
performance attribution.

The sender's retry timer is not refreshed when received acknowledgments advance.
Consequently it can retry recently sent records while cumulative receipt is
making progress. Removing that unnecessary retransmission is the next narrow
repair; a causal claim for the seconds-long native delay needs its result.
No whole-focus acceptance, #26 closure or replacement player release follows.
