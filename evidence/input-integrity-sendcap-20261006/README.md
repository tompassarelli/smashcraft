# #26 send-rate sweep: 10, 15 and 20 messages a second — 6 October 2026

**No rate passes every gate.** At all three rates, edges, expected frame and
final checksums pass, and local start fails, as it did on r8. Raising the rate
did not improve any gate. It raised client A's echo median from about 150 ms
at 10 messages a second to 200–330 ms. **10 messages a second (batch 6) is the
highest rate whose echo stays in the 110–150 ms band.** The sample is one
match and one rematch per rate.

## Candidate and session

- Source: integration HEAD `30381c4` (I5 send cap). Build `typescript-integrity`
  (journal/editbox, pool-predicted, d0/r24) on a private copy of the
  four-fighter diagnostic. Map SHA-256
  `813f7cbd20472b597144d93105ef52b1e4d8409181ee3835683c3b2d4c684f04`.
- Helper `wc3-journal-0.0.43`, SHA-256
  `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3`.
- One signed-in session on both clients: a new game per rate via
  `bun wisp fresh MAP --no-quick`. With no helper running, the rate was set by
  chat on client A: `-dev batch N`, then `-dev rb 24`. Both clients' receipts
  showed `batch=N rb=24` before
  `bun wisp parity capture --helper … --build typescript-integrity --out DIR --app-id a=steam_app_3516115571 --app-id b=steam_app_3516115572 --first-epoch 1`,
  then `bun wisp parity result DIR`.
- Batch 6 is the map's default, so that capture used no chat commands.

## Results

Full tables: batch-6/, batch-4/ and batch-3/ (`integrity-table.md`, `summary.json`).

| Metric | 10/s (batch 6) | 15/s (batch 4) | 20/s (batch 3) |
| --- | --- | --- | --- |
| Edges injected per player | 648 / 648 | 648 / 648 | 648 / 648 |
| Lost / duplicated / reordered / stuck | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Applied at expected frame, both clients | 1296/1296 | 1296/1296 | 1296/1296 |
| Local start − capture, frames p50/p95/max (gate) | 0 / 74 / 91, **fail** | 32 / 89 / 119, **fail** | 4 / 82 / 105, **fail** |
| Opponent lateness, frames p50/p95/max | 6 / 21 / 23 | 0 / 20 / 23 | 5 / 20 / 23 |
| Rollback depth, frames p50/p95/max | 11 / 24 / 24 | 11 / 24 / 24 | 10 / 24 / 24 |
| Prediction stalls at 24-frame limit | 109; longest 58 | 123; longest 69 | 116; longest 62 |
| Final checksums match | Yes | Yes | Yes |

Local echo: the median of each trace's per-second mean
(`local echo native-ms min-mean-max`, 20 seconds per trace), in ms. The
values in brackets are the lowest and highest per-second means. Raw lines are in
`batch-N/local-echo.txt`.

| Rate | Match: A | Match: B | Rematch: A | Rematch: B |
| --- | --- | --- | --- | --- |
| 10/s | 148.0 (89.9–1284.0) | 77.6 (65.8–298.9) | 151.2 (109.8–1632.0) | 106.0 (76.3–229.4) |
| 15/s | 242.7 (117.6–1694.7) | 90.6 (73.3–735.5) | 199.1 (105.0–1785.7) | 97.3 (73.2–345.0) |
| 20/s | 159.0 (99.1–1338.5) | 95.4 (77.9–328.7) | 330.1 (117.2–1708.7) | 105.5 (69.6–312.6) |

Client A hosts. At every rate its per-second echo still reaches 1.3–1.8 s in
some seconds, and B's never goes above 0.75 s.

## Harness findings

1. **The `--sweep` route does not work on this build.** The map hides
   Warcraft's chat box, so the journey's wait for a visible chat prompt never
   passed. That wait is removed: both clients' dev receipts confirm a command.
   With the wait removed, the sweep typed its commands while the helpers ran.
   The next match then received only 4 journal rows (text ack `received=4`)
   and stayed at confirmed frame 0, failing at its pause step
   (`capture-attempt2-sweep`, kept privately).
2. **A second capture in the same game emitted no menu input.** New helpers,
   started after a completed match and rematch (menu epoch 2), did not react
   to the pads (`capture-attempt3-chained-b4`).
3. Setting the rate by chat in a new game before the helpers start worked for
   both 15 and 20 messages a second.
