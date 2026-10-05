# Smashcraft 0.0.45 native check — 6 October 2026

**Result: the match and rematch played through with no stall at selection,
but the capture's result gate failed on one result-screen read.** On client
B's rematch result screen the reader saw "Player | wins!" where the screen
says Player 1. The game agrees on that result: both clients ended at frame
285 with equal confirmed checksums, and A reads "Player 1 wins!". As
instructed, the capture was not run again.

| File | SHA-256 |
| --- | --- |
| `Smashcraft 0.0.45.w3x` (38,570,261 bytes) | `dc1ee5d230e0da2237d63e558b3240bcb75d061be6d4150a0c714d00aa417bde` |
| `wc3-journal-0.0.45` (the 0.0.43 binary, renamed; same bytes as `wc3-journal-0.0.44`) | `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3` |
| Compiled bundle `ts/build/playable.lua` | `e47314e273b100378020ba1626ce3e069732efc8004240691137b3f5f0fa6d90` |

Both files are private under ~/.local/share/smashcraft-build-inputs/playable-0045/.

## Build

From smashcraft `8b5a29b`, with the command in smashcraft:docs/playable-0045.md
(build.log): 8.17 s, all 304 archive entries verified. The bundle carries
build ID `playable-0045` with `hotReload = false`.

## What happened

1. `bun wisp fresh MAP --no-quick` made 0.0.45 the only map in
   `Maps/00-Smashcraft` on both clients. The diagnostic reload-speed map moved
   to `smashcraft-replaced-maps`. Both ready files read
   `BUILD playable-0045` (fresh.log). From all players in the lobby to
   fighter selection took 10.15 s: 0.0.44 took 13.74 s, and the integrity
   builds 10.0–10.6 s. CustomMapData held 19 files on A and 17 on B.
2. `bun wisp playable capture --helper …/wc3-journal-0.0.45 --build playable-0045 --out DIR --app-id a=steam_app_3516115571 --app-id b=steam_app_3516115572 --first-epoch 1`
   exited 0 after 33.1 s. Both epochs logged "one-stock combat, stock loss
   and results observed" (capture.log).
3. `bun wisp playable result DIR` failed with one item:
   "epoch 2: result screens do not both name Player 1" (result.log,
   playable.json).

| Epoch | Winner read on A / B | End frames | Confirmed checksum (frame) |
| --- | --- | --- | --- |
| 1 | Player 2 / Player 2 | 273 / 273 | `771580:781223` (263), equal |
| 2 | Player 1 / none (OCR "Player \| wins!") | 285 / 285 | `783381:730897` (276), equal |

## Checks

- **No stall at selection.** The helpers' menu keys moved both clients from
  selection to the stage screen and into each match. Epoch 1's player view
  was taken 8.9 s into the capture. 0.0.44 stayed at CHARACTER for 30 s.
- **Stage drawn.** Frame probes at both match starts: A shows sky 92.5% and
  92.8%, with the stage in 49 rows; B shows sky 98.1% and 98.4%, with the
  stage in 47 rows (each needs 15 rows).
- **Pooled fighter animation.** Both input traces start with
  `presentation pool-predicted`. In the recording, the fighters' poses
  changed in each 0.5 s sample during the attack taps on both clients
  (frames.txt). One cropped strip of A's frames was inspected: the Rifleman
  raised and lowered its rifle, and the Archer shifted its weapon,
  with one attack flash. A recording alone cannot tell a pooled clip from a
  plain unit animation.
- **No lingering puffs.** A's result-screen crop shows only the winner and
  the stage. At both result screens, consecutive frames 0.25 s apart changed
  0 pixels for 3 s on both clients.
- **Error reports.** None archived. `smashcraft-error-p*.txt` is unchanged
  since 5 October.
- **Model sounds.** Not checked: no audio was recorded.

The "Developer test: playable-0045 | player=… | mode=shadow-d0-r24
pool-predicted …" line is shown to players during each match and at
results. The guide had said the developer display was off; it now states
what is off.

Both clients were recorded with wf-recorder (1280x720, 30 fps, 2 codec
threads each, in a capacity scope). The video is private under
~/.local/share/smashcraft-build-inputs/playable-0045/video/. After the
capture both clients stood at fighter selection with 0.0.45 installed.
