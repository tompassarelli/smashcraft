# Hot reload ×10 on both clients, #39 — 6 October 2026

**Pass: median 0.841 s from save to both clients running the new code**
(min 0.677 s, max 0.925 s, n = 10). Every sample's six paired confirmed
checksums were equal on both clients, the simulation advanced across each
reload, and each new callback ran. The 5 October baseline from the same
procedure had a median of 1.378 s.

## Setup

- Source: smashcraft `306a54a` plus lane commits that do not touch map
  source. A main-profile map (build `typescript-dev`) was built with the
  0.0.44 inputs (build.log, 304 entries). Map SHA-256
  `ccf41188f06636ddd67a3a4590dc17707b5735b05000c2b6a3d70d473ffe5570`,
  private under ~/.local/share/smashcraft-build-inputs/native-owner-20261005/reload/.
- Each client's CustomMapData was emptied of earlier experiment files: 94,057
  (A) and 94,292 (B) files were moved, not deleted, to the sibling
  `Documents/Warcraft III/CustomMapData-archive-20261006/`. Kept in place:
  files of other maps, `MeleePrototypeBindings.pld`, today's dev receipts,
  and the error, hot-ack, object-data, ready and trace files. An empty
  `CustomMapData/smashcraft-hot/` folder was created on both clients.
- `bun wisp fresh MAP --rebuild` put both clients in a quick match in 23.94 s.
  Its player-view check passed: both scene reports read "1 stage deck piece
  drawn; 1 of 267 effects in view across 25 models". Frame probes:
  - A: arena sky present (92.9%); stage in the stage band present (49 rows
    hold a deck-coloured run of at least 20% of the width, needs 15).
  - B: arena sky present (98.5%); stage in the stage band present (47 rows,
    needs 15).

  The frames are at ~/.local/state/smashcraft/frames/a.ppm and b.ppm (fresh.log).

## Procedure

As in smashcraft:evidence/native-delivery-20261005/reload-ten.json: start
`bun wisp hot --data A --data B --watch`, then repeat ten times:

1. Ctrl+T on A starts an input trace on both clients.
2. Save a changed marker in the `confirmed frame` trace line of
   smashcraft:ts/src/platform/shell/diagnostics.ts.
3. Wait for `vN running in 2 client(s)`.
4. Check both `smashcraft-hot-ack-pN.txt` files: "applied N" with the same
   apply clock on both.
5. Compare the two traces' confirmed checksums and check that the new marker
   appears.

The source was restored after the run.

## Samples

"Wisp step" is the first number on the `vN running in 2 client(s)` line,
from change detection to both acknowledgements. "Save → acks" is the
driver's own time from writing the file to reading that line. Per-sample
frames and checksums are in reload.json; the watcher output is wisp.log.

| Sample | Version | Wisp step, s | Save → acks, ms | Equal checksum pairs | Frames |
| --- | --- | --- | --- | --- | --- |
| 1 | v2 | 0.900 | 924 | 6/6 | 1031–1330 |
| 2 | v3 | 0.858 | 861 | 6/6 | 1338–1637 |
| 3 | v4 | 0.850 | 862 | 6/6 | 1646–1945 |
| 4 | v5 | 0.861 | 862 | 6/6 | 1955–2254 |
| 5 | v6 | 0.925 | 929 | 6/6 | 2262–2561 |
| 6 | v7 | 0.764 | 777 | 6/6 | 2569–2868 |
| 7 | v8 | 0.748 | 756 | 6/6 | 2877–3176 |
| 8 | v9 | 0.677 | 693 | 6/6 | 3184–3483 |
| 9 | v10 | 0.697 | 714 | 6/6 | 3493–3792 |
| 10 | v11 | 0.832 | 840 | 6/6 | 3802–4101 |
| **Median** | | **0.841** | **850** | | |

The initial publish (v1, 7.76 s) includes the cold compile and is not a sample.
