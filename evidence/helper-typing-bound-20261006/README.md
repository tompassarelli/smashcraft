# The helper's typing bound, native and headless — 6 October 2026

wisp#19. Why the soak predicted 100–115 ms typing stalls, and what types at
once now. Wisp 4d6cfec, the companion and the headless stand-in
(smashcraft:ts/test/rematch/journalHelper.ts) from this commit.

## What wc3-journal (8ac53f2f) types at once

It types at most 256 characters past the record the receipt says arrived,
but that bound is checked only while something typed is still unreceived:
once a receipt clears it, the next record goes out whole. A record joins up
to 16 waiting packets. With moving sticks a packet is 30–60 characters, so a
joined record reached about 480. 0.0.49 R1's native helper, with pad beats
(short packets), typed records of up to 268 characters
(`~/.local/share/smashcraft-build-inputs/playable-0049/r1-bot/helper-1.log`,
largest 204–268).

The helper now joins a packet only while the record's envelope stays within
256 characters (`cargo test --bin wc3-journal`: 53 passed; the new test
fails without the bound).

## The stand-in against the native helper

The stand-in now journals and types frame by frame of its own clock, also
while the game stands still, as the helper's loop does. Client B's typed
records on the native session's workload (pad beats, computer Illidan, B's
game stopped 2 s at 6, 14 and 22 s), against 0.0.49 R1's `editbox_emit`
sizes on client B:

| | Records | p50 | p95 | Largest |
| --- | --- | --- | --- | --- |
| Native helper 8ac53f2f, 0.0.49 R1 (two matches) | 1804 | 39 | 53 | 268 |
| Stand-in, 8ac53f2f rules (one match) | 699 | 39 | 56 | 296 |
| Stand-in, joined records within 256 | 697 | 39 | 56 | 254 |

## Soak

`bun wisp soak` (200 matches, 4 workers), the typing stall modelled at
0.5 µs per character squared:

| Stand-in, judgment | Findings |
| --- | --- |
| 8ac53f2f rules, before frame by frame, typing in the frame's cost (16.7 ms) | 2 in a 12-match run, 100–115 ms (smashcraft:evidence/headless-native-cost-20261006) |
| Within 256, typing in the frame's cost (16.7 ms) | 59 in 59 matches, every one 30–34 ms, 29–33 ms of it typing (soak-200-typing-at-frame-budget.txt) |
| Within 256, typing against the helper's bound (32.8 ms) | none (soak-200-default.txt) |
| pre-8ac53f2f bursts, same judgment | 93 in 60 matches: 88 typing (up to 183 ms), 5 catch-up (soak-200-bursts.txt) |

The 30–34 ms frames are the bound working as designed: after a lag spike
or a quiet helper, the backlog drains one 256-character typing per
receipt. So the soak judges typing against the bound the game declares
(`limits.typingMs`, smashcraft:ts/scripts/wisp/soak.ts) and a frame's own
work against 1/60 s. In 0.0.49 R1, receipts after B's 247- and 268-character
typings came 109–140 ms apart where steady play had about 100, so stalls of
this size are likely real in Warcraft; the soak's catch-up detector judges
whether a game recovers from them.
