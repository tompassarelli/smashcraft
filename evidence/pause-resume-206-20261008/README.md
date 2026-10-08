# Native pause/resume presentation positions (#206)

The unchanged `ts/test/native/pads/206/pause-dash.pad` ran on clone-a and
clone-d on 8 October 2026. Its 10 input edges landed on their intended frames,
with zero late writes or off-frame inputs. The native operator reported a
valid run without a new desync report.

The `pause-probe` fixture at `3705a0d1cb05f0554583096f205cc04f06c653af`
starts the existing response probe in the first match callback and exports
after the callback that commits resume has presented both fighters. It changes
neither pause behavior nor the input script. The source landed on main at
`b3fc005f0fafefa7394d6a1715d51a4e9684ca83`.

The private map's SHA-256 is
`0a75ea5d3519308cfc3ad508002fa7ab06ac77890ce1b17a9262624cc0fe2b8c`.
It was rebuilt from the native corpus map with `bun wisp map rebuild MAP.w3x
--profile pause-probe`, retaining the `typescript-integrity` build identity.
The helper was the existing #206 integration build at
`smashcraft:worktrees/pause-206-integration-20261008/companion/target/debug/wc3-journal`.

Both clients record `I 214 pause-boundary paused` and
`I 385 pause-boundary resumed`. Integrity serials are one-based; their
presentation rows are 213 and 384. Row 383 is the final paused callback.
All three rows contain exactly these positions:

| Client | Fighter | Presented frame | X | Z |
| --- | --- | --- | --- | --- |
| 0 | 0 | 167 | -149.040 | 0.000 |
| 0 | 1 | 167 | 240.000 | 0.000 |
| 1 | 0 | 174 | -56.640 | 0.000 |
| 1 | 1 | 174 | 240.000 | 0.000 |

Four of four within-client position comparisons are equal. The confirmed
cursor is 167 on both clients; each client's predicted presentation is
compared with its own frozen presentation. The `A` rows show no simulation
advance in the resume callback. These are native presentation-callback
observations; the response-page format separately requires framebuffer marker
correlation to identify the first frame actually visible on the screen.

The six original response pages and the input result are retained alongside
this report. The private native run is
`~/.local/state/smashcraft/pause-capture206-20261008`; its automatic corpus
recording is `~/.local/state/wisp/corpus/2026-10-08T09-13-38-274Z`.

The map's TypeScript-to-Lua build, `bun run check`, the focused
`bun test test/pause-resume.test.ts` (21 assertions), and the push's source
shape check passed. That existing test recorded 120 normal and 120 resumed
callbacks, each advancing one simulation frame, with zero corrections.
