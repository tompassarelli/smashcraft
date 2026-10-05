# #26 through the real helper into headless clients — 6 October 2026

**Every gate passes, and the retention and frame columns agree with the
latest native run** (send cap, batch 6): 648/648 edges per player, 0 lost,
duplicated, reordered or stuck, 1296/1296 on their expected frame, final
checksums match. Wall time 101 s for the match and rematch, capture and
reconciliation included. No Warcraft client was used.

## Candidate and command

- Smashcraft lane `headless-input-20261006` (base main `035c0d4`), Wisp
  `bae8a9a` (wisp#12 on the network model, `6a7d0a7`). Build
  `typescript-integrity` (journal/editbox, pool-predicted, d0/r24), its
  TypeScript run in two of Wisp's headless clients at 60 frames a second of
  wall time, with Battle.net's measured sync-message latency (seed 1).
- Helper: wc3-journal built from this lane's smashcraft:companion with
  `--text-out`, SHA-256
  `b46d9e5163417a904f3b4fc0311abe777914952978181f87766ab3bfccbf4bf2`.
- `bun wisp parity headless --helper companion/target/debug/wc3-journal --out DIR`
  from smashcraft:ts/ (capture, then `parity result` on DIR).

## Results

| Metric | Headless (this run) | Native batch 6 (10/s) |
| --- | --- | --- |
| Edges injected per player | 648 / 648 | 648 / 648 |
| Lost / duplicated / reordered / stuck | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Applied at expected frame, both clients | 1296/1296 | 1296/1296 |
| Local start − capture, frames p50/p95/max | 0 / 0 / 0 (n=253) | 0 / 74 / 91 (n=194), **fail** |
| Opponent lateness, frames p50/p95/max | 10 / 17 / 23 | 6 / 21 / 23 |
| Rollback depth, frames p50/p95/max | 12 / 18 / 24 | 11 / 24 / 24 |
| Prediction stalls at 24-frame limit | 13; longest 7 | 109; longest 58 |
| Final checksums match | Yes | Yes |

Lateness, rollback and stalls come from the modelled latency only: the
network model has no client lag (Wisp's docs/network-model.md), which the
native run's saturated client A showed, so fewer stalls and a passing local
start are expected here and are not a native claim.

Full table: `integrity-table.md`; counts and distributions: `summary.json`;
journey and settings: `capture.json`.

## Other runs of this harness (same day, scratch)

- Before every receipt sampled the tightest of eight clock brackets, one
  edge 5 µs after a frame boundary was assigned to the frame before
  (1295/1296): the boundary's realtime sample was bracketed by 31 µs.
- Without the network model: the same gates and columns (0/0/0/0,
  1296/1296), lateness 2/5/19, no stalls.
- With it, three more runs: one passed every gate; one passed the
  retention, frame and checksum gates and failed local start (max 7 frames);
  one never ended the rematch: both players held their stick off-stage for
  75 s without the result (screens were not yet kept; `screens.txt` now is).

## Leads, not results

- After the Start pause, client A's input trace ended (PauseTimer) at frame
  1695 and client B's later: the headless clients' native calls differ there
  (`capture.json` settings.headless.divergence) while the confirmed
  checksums agree. The trace counts paused callbacks per client.
- Each client's scene report kept an ImpactDust hit spark in view for 9.6
  and 11.5 s at the rematch's result (`player-view-2.txt`). Effects are
  emulated headlessly; what reaches the screen keeps its native check.
