# Smashcraft 0.0.47 native check — 6 October 2026

**Pass.** `bun wisp playable result` exited 0. Both clients' end receipts
named the winner of each match (Player 2, then Player 1), both
announcements agreed, and the confirmed checksums were equal. Both ready
files read `BUILD playable-0047`. No developer text appeared, every frame
probe found the stage, and there were no error reports.

| File | SHA-256 |
| --- | --- |
| `Smashcraft 0.0.47.w3x` (38,579,096 bytes) | `c72bebba435f3ac26ed9cdf4ccb9c29ab7004f3e30f0e1b28e71765087ff8245` |
| `wc3-journal-0.0.47` (the 0.0.43 binary, renamed) | `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3` |
| Compiled bundle `ts/build/playable.lua` | `cd130e179c3479f2924f41689420693d59f9bfb502b72fe19ac8cff069c1f83a` |

Both files are private under ~/.local/share/smashcraft-build-inputs/playable-0047/.

## Run

From smashcraft `8ed7ab9`, with the commands in smashcraft:docs/playable-0047.md.
The helper was copied from 0.0.46's, which has the same bytes as the 0.0.45
copy the guide names.

1. Build: 8.98 s, 304 entries (build.log).
2. `bun wisp fresh MAP --no-quick` made 0.0.47 the only map in
   `Maps/00-Smashcraft` on both clients. 0.0.46 moved to
   `smashcraft-replaced-maps` with its bytes unchanged (`044d0796…`). From all
   players in the lobby to fighter selection took 10.60 s (fresh.log).
3. `bun wisp playable capture … --first-epoch 1` exited 0 after 32.9 s.
4. `bun wisp playable result DIR` exited 0 with no failures (result.log,
   playable.json).

| Check | Match 1 | Rematch |
| --- | --- | --- |
| Winner, from both end receipts | Player 2 / Player 2 | Player 1 / Player 1 |
| End frames | 271 / 271 | 283 / 283 |
| Confirmed checksum (frame), both clients | `252411:81243` (262) | `821716:130851` (278) |
| Announcement crop, A / B | "Player 2 wins!" / "Player Z wins!" | "Player 1 wins!" / "Player I wins!" |
| Frame probe: stage rows A / B; sky | 49 / 47; 92.8% / 98.2% | 49 / 47; 92.8% / 98.2% |

- "Developer" appears neither in ui.txt nor in the result-screen text.
- Error reports: none archived. `smashcraft-error-p*.txt` is unchanged since
  5 October.

## CPU

Each Warcraft process was sampled once a second from /proc (cpu.txt).
Windows run from each match's start to its end boundary (cpu-matches.txt). A
one-stock playable match lasts about 4.6 s, so each window holds four
samples:

| | A median (max) % of one core | B median (max) |
| --- | --- | --- |
| Match 1 | 142 (214) | 93 (118) |
| Rematch | 66 (102) | 102 (106) |
| Whole sampling, 42 s including menus | 87 | 106 |

These samples are too few to compare with the integrity build's 25-second
matches, which ran at 84–138% median on 0.0.46-era code. No 0.0.46 playable
CPU was sampled. This run does not establish whether the parking cut lowered
CPU.

## Guide

The guide's commands match what was run. One correction: end receipts have
named the winner since 0.0.46, not 0.0.47 (0.0.46's receipts carry
`winner=`, see smashcraft:evidence/playable-0046-native-20261006/).

After the run both clients stood at fighter selection with 0.0.47 installed.
