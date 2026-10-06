# Native bot session: Smashcraft 0.0.49, 6 October 2026

Two signed-in clients played Battle.net custom games of private 0.0.49:
A on private display :2 and B on :1. Each player was a scripted virtual pad
read by the real `wc3-journal` helper, with computer opponents in every bot
match. Every result names the build it came from.

## Builds

Both builds use the stage-model-20261006 container and assets, the
build-port-20261005 summon clips and physics-base.w3m. All six maps verify
305 entries. Raw captures, logs, frames and moments are private, under
`~/.local/share/smashcraft-build-inputs/playable-0049/`.

| Source | Playable "Smashcraft 0.0.49" | Integrity | Dev |
| --- | --- | --- | --- |
| **4eab3f39** (main after 87c39002: #48 typing fix, frame-cost cuts, walls, deck, techs, jab, K) | `42648b2c…` | `30d9e543…` | `7f2b60b8…` |
| **fc287** (lane merge 2114de21 = main 6282a557: fc287ae0, #59's exact f32 via Wisp d361849, #56 computer) | `94e0c04d…` | `3ef89f7f…` | `336f3a4e…` |

- Helper: `cargo build --locked --release --bin wc3-journal`, SHA-256
  `014936f4…`. It was built from 4eab3f39. companion/ last changed at
  60b9aaff (the #48 typing fix) and is unchanged at fc287ae0.
- The build ID inside the playable map is still `playable-0047`.
  `bun wisp play` and its test use that ID, so it was not renamed.

## Runs

| Run | Build | Kind | Fighters | Stalls |
| --- | --- | --- | --- | --- |
| R1 | 4eab3f39 integrity | `parity capture --bot` | 2 pads + computer Demon Hunter | 3 per match on B |
| R2 | fc287 integrity | `--bot --bot-four`, `-dev perf` on A in match 2 | 2 pads + computer Illidan and Archer | 3 in match 1 on B |
| R3 | fc287 integrity | #26's `parity capture` (no `--bot`), then `parity result` | 2 pads (3 fighters in the rematch) | #26's helper and game stalls |
| K | fc287 dev | `bun wisp fresh` quick match, K on A 12.2 s in | quick match | none |

R1 and R2 played the match on Sky Deck and the rematch on Three Bridges
(smashcraft:docs/native-bot-session.md). Their beats added C-stick flicks
for #60. All captures exited 0; R3's result exits 1 on its local-start gate.

## Results

**#48 box 3, FAIL (R1 1/6, R2 0/3).** This is client B frozen with SIGSTOP
for 2.000 s, verified by DISPLAY. Input delay is frames journaled by the
helper's clock beyond the last frame its client consumed. A trial settles
when the delay returns to its pre-stall maximum and stays there for 1 s
(bot-result.json):

| Trial | Pre-stall | Peak | Back at | Settled at |
| --- | --- | --- | --- | --- |
| R1 e1 t1 (4eab3f39, 3 fighters) | 6 | 143 | 1002 ms | 1002 ms |
| R1 e1 t2 | 4 | 126 | 1020 ms | 1020 ms |
| R1 e1 t3 | 5 | 143 | 919 ms | **919 ms** |
| R1 e2 t1 | 4 | 144 | 915 ms | 1450 ms |
| R1 e2 t2 | 4 | 142 | 1336 ms | 1336 ms |
| R1 e2 t3 | 5 | 143 | 1014 ms | 1014 ms |
| R2 e1 t1 (fc287, 4 fighters) | 5 | 147 | 1191 ms | 2153 ms |
| R2 e1 t2 | 7 | 156 | 1728 ms | 2453 ms |
| R2 e1 t3 | 7 | 143 | 1364 ms | 1834 ms |

- 0.0.48 left B 15–25 frames late for 4.7–5.5 s after a stall (40 s with
  four fighters). On R1 that residual is gone: the backlog drains within
  0.8 s, and delay is back within 0.9–1.3 s.
- With four fighters on fc287, it drains by 0.77 s, then hovers at 6–25
  frames until 1.8–2.5 s (r2-stall-series-e1-t2-b.txt).
- Checksums are equal in both runs: 0 of 19, 8, 19 and 17 common confirmed
  frames differ, and the final exported checksums match.

**#48 box 2, FAIL at the worst frame (fc287, R2 rematch).** Four fighters:
the two pad players plus computer Illidan and Archer. The `-dev perf`
overlay on A was read 63 times over the 60 s rematch (r2-perf-overlay.txt).
Each reading covers the last 120 frames.

- Lua plus natives per frame, median: 4–6 ms (5 ms in most windows; 1.01
  and 3.01 ms as the match started).
- Each window's worst frame: 30–105 ms (median 48 ms). 63 of 63 windows
  hold at least one frame over 16.7 ms, so at least one frame in every
  2 s. The overlay gives no count beyond that.
- Worst frame: 105 ms.
- Catch-up: median 0 frames, maximum 6 (4 in the first window).
- Native calls a frame: median 82–172, maximum 2156–2939.

**#26 re-run (R3), FAIL on local start by one press (fc287).**
- Load average 7.7–8.2 during the capture (r3-machine-load.txt).
- An exclusive capacity probe deferred only on this session's own client
  leases (12 CPU ceilings). One unleased single-core Lua process from
  another lane ran. 0.0.48's R6 ran at load ~20.

| Metric | Result |
| --- | --- |
| Edges injected per player | 648 / 648 |
| Lost / duplicated / reordered / stuck edges | 0 / 0 / 0 / 0 |
| Edges applied at expected frame, both clients | 1296/1296 (100.0%) |
| Local start − capture, frames p50 / p95 / max | 0 / 0 / 5 (n=203); missing first prediction 0 — **gate fails** (needs ≤ 1) |
| Opponent input lateness, frames p50 / p95 / max | 8 / 17 / 23 (n=1299) |
| Rollback depth, frames p50 / p95 / max | 9 / 19 / 24 (n=324) |
| Prediction stalls at 24-frame limit | 8; longest 8 callbacks |
| Final checksums match | Yes |

- 202 of 203 legal presses start on the capturing callback. The other is
  in the rematch: B's press at frame 761 started 5 callbacks late.
- B captured it at callback 792, and the same callback logged
  `stall 2 761 736`. Prediction stood 25 frames past the last confirmed
  frame, over the 24-frame window, until A's input arrived.
- R6 on 0.0.48 measured 0 / 67 / 118.

**#57 box 2, FAIL on the underside (sides PASS).**
- Frames: 120 (R1) and 155 (R2) captures of both desktops, one pair about
  every 2.5 s. 60 and 88 of them are during matches.
- Sides: drawn on both stages. The tapered side faces show against the sky
  in their upper half and against the black backdrop band below. R2
  b-14760200 (Three Bridges) shows Illidan just off the left side face.
- Underside: on neither stage do the captures show the underside where a
  fighter would hit it. Down the deck's middle, its charcoal reaches
  76–91% of the frame height; the HUD panels start at about 82%. Below it
  are the black backdrop band, the HUD panels and the ground.
  - Sky Deck, column x=1000 of R1 a-14097500: charcoal down to y 1310 of
    1440, between HUD panels, then ground.
  - Three Bridges, column x=1280 of R1 a-14149910: charcoal ends at
    y 1157, 27 px above the HUD panel, on the black backdrop: dark gray on
    black.
  - Visual check of six frames (R1: one per stage; R2: two per stage): the
    lower body runs into the backdrop and behind the HUD, with no visible
    underside edge.

**wisp#15 box 1, PASS (fc287 dev).** K pressed on A 12.2 s into a quick
match wrote `smashcraft-repro-p0-f781-1.txt` 0.25 s later, on A only.
- Build `typescript-dev`, frame 781, checksum 25271:419074, 149 lines.
- A's capture 2.5 s after the file's timestamp reads "Moment saved" in the
  notice frame (946–1110, 314–329); its capture at 0.6 s shows nothing
  there yet. B's capture at 1.4 s shows nothing there.
- Not pressed on the playable build. Its journal path saved moments from
  the pad's View hold in R1 and R2 (integrity builds).

**wisp#15 box 3 / #59 box 2, reported, not counted (#59).**
- The K moment replays to its recorded checksum on both headless clients
  (k-dev-repro.txt). Its fighters stood idle.
- R2's moments on fc287: 1 of 4 distinct moments lands (2 of 8 files;
  r2-moment-replays.txt). e1 f1866 lands. e1 f778, e2 f774 and e2 f1850
  diverge at their first checkpoints: frames 360, 480 and 1680.

**#60 box 1, FAIL on local start.** The fc287 runs R2 and R3 together
(press-60-fc287.json):

| Item | Result |
| --- | --- |
| Scripted presses | 1030 (R2 382, R3 648): attack, jump (Y, B, stick), special, shields (both triggers, 200 ms holds), dashes (300 ms holds), C-stick in four directions, grab, walk, stick moves; 5 ms taps |
| Lost / extra | 0 / 0 |
| Edges applied on their pressed frame, both clients | 2060/2060 (100%) |
| Local start, legal presses not in the presser's own stall | n=234 measured: p50 0, p95 0, **max 66** callbacks |
| — clear of stops (or more than 1 s after one) | 208: 205 at 0, one each at 4, 5 and 16 |
| — within 1 s after a stop ended | 26: p95 31, max 66 |
| Legal presses whose first prediction didn't start the action | 24 (23 clear, 1 during the other player's stall): shown when confirmed 9–62 callbacks after capture (p50 14) |
| Presses during the presser's own stall (not gated) | 0 measured, 2 without a first prediction |
| Checksums | Equal |

Worst gated presses, all on the fc287 integrity build:

| Run | Match | Slot | Frame | Local start (callbacks) | When |
| --- | --- | --- | --- | --- | --- |
| R2 | 1 | 0 | 490 | 66 | 1 frame after a stop of B ended |
| R2 | 1 | 0 | 532 | 31 | 43 frames after a stop ended |
| R2 | 1 | 1 | 1044 | 16 | 72 frames after a stop ended |
| R3 | 2 | 1 | 761 | 5 | prediction past the 24-frame window |
| R2 | 2 | 1 | 2194 | 4 | no stops in that match |

R1 on 4eab3f39 (r1-press-result.json): 220 presses, 0 lost or extra,
438/438 on frame. Local start is 0 for all 35 presses clear of stops.
Within a second after a stop it is 10–22, and during B's stall 46–50.

## #17: what a human would report (R1, R2, R3)

| Item | Result |
| --- | --- |
| Missed / extra inputs | 0 / 0. Scripted presses against helper rows: R1 220 and R2 382 presses, 0 missed and 0 extra (bot-inputs.json). Against both clients' confirmed rows: 0 lost and 0 extra across R1, R2 and R3 (1250 presses) |
| Input delay, frames (helper clock − consumed), away from stalls | R1 p50 3–4, p95 4–5, max 8; R2 four fighters p50 3–4, p95 5–8, max 19 |
| Stuck controls | 0: no button held in any match's last row; stuck edges 0 |
| Crashes / error reports | 0 error reports, 0 client crashes, 0 helper exits in R1, R2, R3 |
| Client disagreement | 0: same winners in every match, 0 differing confirmed states, final checksums equal |
| 2 s stalls | 9 (see #48 box 3) |

End receipts carry each client's own journal frame, so they differ by 0–4
frames between clients (R1 2405/2403, R2 3607/3609). The final confirmed
frames and checksums are equal.
