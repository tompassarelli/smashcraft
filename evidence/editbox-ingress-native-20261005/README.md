# Two-client short-tap retention checkpoint — 5 October 2026

The repaired editbox candidate delivered 300 original input frames per player.
Both native online clients applied all three 5 ms Attack taps once per fighter
at original frames 19, 97 and 157. The second tap occurred during a 249.994 ms
helper stop, the third during a 245.027 ms game-process stop. Both clients
ultimately confirmed frame 300 with state checksum `978581:476670`; neither
produced an input-failure receipt. This closes this executable counterexample,
not all of issue #26 or a physical response guarantee.

## Candidate and evidence

Map: `editbox-20261005b`, source `ad66b8e`, SHA256
`76b209e855f7771011eda13687d9c3dcd9d972f9372524c2f32793dbe3141784`.
Configuration: journal/editbox, shadow-d0-r24, pool-predicted, normal scenario.
The helper pins Enigo commit `ea81f5c1239534db48c51d46268d1ad80cc8057f`
from https://github.com/tompassarelli/enigo. Its executable SHA256 is
`ffd9d5e173b7ee570db16200b724d7465e2f5ec0c4338f4a100950e819c2af9f`.
The consumer helper build and nine focused tests passed.

Two helpers read the same virtual Linux evdev controller. An independent kernel
reader recorded six button edges and two axis transitions. Both helper logs
matched all eight kernel timestamps and frame calculations exactly. The axis
held half-right from frames 37–66 and returned neutral at 67. Each helper
published frames 1–300 in order, in 150 packets, then exited successfully.

| Measurement | Client A | Client B |
| --- | ---: | ---: |
| Median text emission | 1.416 ms | 1.398 ms |
| Maximum text emission | 4.840 ms | 6.077 ms |
| Confirmed attack frames, each fighter | 19, 97, 157 | 19, 97, 157 |
| Final confirmed frame | 300 | 300 |

These emission times measure only the helper's text call. They are not physical
button-to-pixel or network round-trip measurements. The first five-native-second
traces end at confirmed frames 225 and 234; this is a recording boundary, not
lost input. After the queues drained, Escape released editbox focus and Ctrl+T
started the existing trace again. Those drained traces independently report the
same final frame and checksum. No extra map build was needed.

Raw evidence is retained under wc3-melee:evidence/editbox-ingress-native-20261005:
producer and independent kernel JSONL, both helper logs, both initial native
traces, both drained traces, capture metadata and the reconciled result JSON.
Compositor video remains local in
wc3-melee:build/native-editbox-20261005b-mapping-restored/input-native.mp4.

## Failed attempt and fixture repair

The first run with this repaired helper retained the old missing-I failure on
A while B admitted through frame 64. Comparing the X11 keymaps found six
leftover mappings only on A: keycodes 178, 183, 219, 222, 230 and 248 represented
I, W, Z, underscore, X and Y. These matched the earlier helper's temporary
mappings; that helper had been forcibly stopped after its emission timeout.
The repaired library discovered A's inherited level-zero I mapping before the
ordinary shifted I key, so the earlier remapping defect persisted in the fixture.

Those six test-owned mappings were restored to NoSymbol. The resulting keymap
matched B exactly. The passing run above used the same map and repaired helper;
no decoder bypass, replacement emitter, dropped packet or relaxed assertion was
introduced. Preserve the before/after keymaps with the local failed trial at
wc3-melee:build/native-editbox-20261005b-fixed-helper. Do not run a subsequent
trial against temporary mappings stranded by an earlier forced process kill.

## Remaining scope

This is native injected-input evidence for the specified Linux path. Real
controller latency, first eligible visible response, pause/resume, focus/chat
ownership, reconnect/rematch, rapid repeated edges and other platforms remain
with issues #25–#27 and #18. The editbox is still a developer-facing candidate;
playable 0.0.40 remains the released checkpoint. A successful three-tap corpus
does not establish arbitrary interruption recovery or complete input guarantees.
