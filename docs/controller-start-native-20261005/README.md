# Controller Start pause checkpoint — 5 October 2026

Controller Start paused and resumed both native online clients while their text
receivers retained focus. Both helpers published original frames 1–600 once,
exited successfully, and produced no input-failure receipts. The synchronized
pause barrier stopped at next frame 76: both native traces held confirmed frame
75. After resume, both drained traces confirmed frame 600 with checksum
`432553:258417` and zero dropped trace rows.

Implementation: `4b03816f5924deafe81db9695e6fc3cfa8aae274`.
Map `editbox-start-20261005`, SHA256
`314d72009f8e260f836ebc6f7dfb8d0eff6088855a3d482c9d782e1ee1edc5c3`.
Helper SHA256
`ea6e7311e5a787cf08beeeb951cd799f01323ff3c643da9e5464098d8a36f6cb`.
Configuration: journal/editbox, shadow-d0-r24, pool-predicted, normal scenario.
Enigo pin remains `ea81f5c1239534db48c51d46268d1ad80cc8057f`.

Start is edge-detected from the kernel controller stream, including while
paused. Its existing `JP1` epoch/sequence/state request is serialized alongside
I4 rows and ACK1 acknowledgments, then crosses the existing `SC_JP` synchronized
request before entering the existing prepare/commit/resume barrier. It emits no
keyboard shortcut and does not change focus. Repeated presses cannot apply a
stale control sequence. No gameplay rows are reconstructed or discarded.

## Stimulus and scope

One virtual kernel controller fed both helpers. An independent kernel reader
recorded the physical event timestamps. The driver supplied a 5 ms Attack tap
before pause (frame 19), a tap while paused, Attack held across resume, its
release, then a fresh 5 ms tap. Helper logs show that paused presses were omitted,
the held-through-resume release generated no held/pressed/released gameplay
bits, and the fresh tap generated its new press/release. The fresh tap belongs
to frame 103 on A and 102 on B because their resumed capture anchors differ by
7.1 ms; these per-client frame assignments are retained, not forced equal.

Native UI showed **PAUSED — Press Start to resume** and **Resume: Start**.
The initial five-second native traces end while paused. Thus the detailed
post-resume neutral-rearm observation is helper-origin evidence, supported by
both clients reaching the same confirmed frame/checksum; it is not a per-frame
native post-resume action trace. The successful run is one bounded 600-frame
trial, not physical latency, arbitrary input coexistence, reconnect/rematch,
or full issue #26/#18 acceptance.

After both helpers exited and their queues drained, Escape then Ctrl+T on A
started the final synchronized trace on both clients. No keyboard shortcut or
focus change occurred during the controller trial itself. The video is retained
locally at
wc3-melee:build/native-start-600-20261005/pause-native.mp4.

## Failed keyboard route

The prior F8 candidate lost A's rows 67–76 while F8 was held. Repeating without
redundant window activation still lost rows 67–74. In the stopped match, ordinary
text entered successfully, but text entered while F8 or F7 was held did not.
This bounds the incompatibility to the tested concurrent held-key/typed-input
path and closes both the activation-only and F8-only hypotheses. It does not
identify a lower engine/X11 implementation cause or establish other platforms.
F8 has been removed as the player pause action. Concurrent keyboard interference
and whole-window focus loss remain unresolved; the controller's own pause
control now shares its ordered ingress instead.

## Checks

The focused Rust Start edge/sequence test passed (1/1); helper build succeeded.
Full native map compilation/packaging passed with zero errors and 27 warnings.
No extra source-suite rerun was needed for unchanged simulation behavior.
The capture driver records this exact session's paths and delegates graphical
observation to the retained session's wc3-melee:build native UI helper; it is an
evidence record, not a portable launcher.
