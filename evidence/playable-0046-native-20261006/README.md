# Smashcraft 0.0.46 native check — 6 October 2026

**Fail: the result gate stopped on the rematch's end frames, with everything
else passing.** The rematch's end receipts read `frame=283` on A and
`frame=285` on B. Both receipts name `winner=P1`, both announcements read
Player 1, and the confirmed checksum at frame 275 is equal. As instructed,
nothing was run again.

| File | SHA-256 |
| --- | --- |
| `Smashcraft 0.0.46.w3x` (38,571,067 bytes) | `044d0796dbd181a7fddb4fe0b4a7aa7ef1ea828b18da7586c6fc9e637f90aa13` |
| `wc3-journal-0.0.46` (the 0.0.43 binary, renamed) | `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3` |
| Compiled bundle `ts/build/playable.lua` | `f2080cdbd57ddd08b7bc7add8f7f33fec2ab1870ccafad174fedae3900141f4f` |

Both files are private under ~/.local/share/smashcraft-build-inputs/playable-0046/.

## Run

From smashcraft `21b5581`, with the commands in smashcraft:docs/playable-0046.md,
which match what was run:

1. The helper was copied with `install -D -m 700`, then the map was built:
   8.97 s, 304 entries (build.log).
2. `bun wisp fresh MAP --no-quick` made 0.0.46 the only map in
   `Maps/00-Smashcraft` on both clients. 0.0.45 moved to
   `smashcraft-replaced-maps` with its bytes unchanged (`dc1ee5d2…`). Both
   ready files read `BUILD playable-0046`. From all players in the lobby to
   fighter selection took 10.36 s (fresh.log).
3. `bun wisp playable capture … --first-epoch 1` exited 0 in 33.7 s, and
   both epochs logged "one-stock combat, stock loss and results observed"
   (capture.log).
4. `bun wisp playable result DIR` exited 1:
   "epoch 2: end frames differ or are absent" (result.log, playable.json).

| Check | Result |
| --- | --- |
| Winner source, both matches | "end receipts": P2 then P1, both clients (end-receipts.txt) |
| End frames | Match 1: 273 / 273. Rematch: **283 / 285** |
| Confirmed checksum | `252411:81243` (frame 262), equal; `264212:30917` (frame 275), equal |
| Ready files | `BUILD playable-0046` on both |
| "Developer test" in ui.txt | none; the result-screen texts have none either |
| Frame probe | Stage in 49 rows (A) and 47 rows (B) at both match starts; sky 92.7% and 98.2% |
| Error reports | none; `smashcraft-error-p*.txt` unchanged since 5 October |
| Announcement crop (944,312 1008×168) | Read the winner line in all four: A "Player 2 wins!" and "Player 1 wins!"; B "Player Z wins! … Player 2 wins!" and "Player I wins! … Player \| wins!", which the gate counts as 1 |

## First divergence

The END receipt's frame is `journal.source?.expectedFrame()`
(smashcraft:ts/src/platform/shell/journal.ts, `serviceJournalEnd`). That is
the next frame each client's local journal source expects when that client
writes the receipt, not a frame both clients share. The playable gate requires
the two to be equal. They were equal in match 1 here and in both 0.0.45
matches, but not in this rematch.

After the run both clients stood at fighter selection with 0.0.46 installed.
