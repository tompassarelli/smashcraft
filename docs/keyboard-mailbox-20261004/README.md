# Keyboard journal delivery

The first native attempt carried the original frame-19 short attack through to
both clients, but was too slow for play. Both traces reached only confirmed
frame36 after5 native game seconds. The attack applied at native trace time
2.517s on both clients. This is trace-relative timing, not physical input latency.

Both helpers retained press/release pairs at original frames19,97 and157 and
produced all300 capture rows. Frame97 was captured during a stopped helper;
frame157 during a stopped game. Half-stick right spans frames37–66. The latter
inputs did not reach the five-second native traces. The helpers did not drain
their delivery queues within the driver's25-second completion wait and were
reaped. Do not report all300 frames delivered or the stall checks passed.

Unlike the preload-input trials, actual synchronized packets arrived steadily.
However the local bridge submitted neutral single-chunk packets roughly every
100–150ms and larger packets much less often. Existing traces do not distinguish
key-emission cost from acknowledgment observation. The next owning repair
measures those boundaries and replaces per-key submission with a suitable
bulk held-state operation if the measurement supports it. No new network
transport survey is needed.

Artifact: ~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/keyboard-mailbox-a.w3x
SHA256: 1e414dec6b97002fbf543a1ac10fc8f6fbc892436f1f7503de6a95528d70618c.
Source: bcdcb00, including the map source-list correction after5b896ce.
Focused checks passed: Rust2/2, Wurst3/3; native map compiled.
Evidence: wc3-melee:docs/keyboard-mailbox-20261004/a/.

The timed-out helper did not release held keys on SIGTERM; the parent explicitly
released the54 carrier keys on both private displays. This interfered with one
initial Quit Mission attempt. After releasing them, both clients left normally
without restart. Exact playable40 bytes are restored on disk; the input bridge
is not the delivered playable replacement. Graceful interruption is part of
the pending companion repair.
