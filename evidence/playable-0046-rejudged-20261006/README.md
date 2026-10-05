# Private candidate 0.0.46, capture re-judged — 6 October 2026

The native capture recorded in evidence/playable-0046-native-20261006/ failed
only "epoch 2: end frames differ or are absent" (end receipts 283 and 285).
Each end receipt's frame is its client's local input source's next expected
frame, not a shared simulation frame, so that comparison was invalid. The gate
now requires both receipts and decides agreement from the winner both receipts
name and the confirmed result checksums both clients share.

The same capture directory (~/.local/share/smashcraft-build-inputs/playable-0046/capture/,
map SHA-256 044d0796dbd181a7fddb4fe0b4a7aa7ef1ea828b18da7586c6fc9e637f90aa13,
helper SHA-256 d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3)
was re-judged with `bun wisp playable result` at this commit: exit 0.
Match 1: Player 2 by both receipts; match 2: Player 1 by both receipts, confirmed
checksum 264212:30917 at frame 275 on both clients; no in-game error reports.
playable.json is that verdict.
