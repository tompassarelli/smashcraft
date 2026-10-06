# Native bot session: Smashcraft 0.0.48 — 6 October 2026

Two signed-in clients (A on private display :2, B on :1) played Battle.net
custom games of private 0.0.48. Each player was a scripted virtual pad read by
the real `wc3-journal` helper, with computer opponents in every match.

## Build

- Source: integration commit `3546d9ea` (main `da3dd889` plus #48 lag
  recovery, #55 C-stick get-up and the helper's C-stick thresholds), merged
  into lane `native-0048-20261006` as `632b5295`. Harness commits `b6f9c06f`
  and `93008ae9` change only `ts/scripts/integrity/`.
- Maps: "Smashcraft 0.0.48", playable profile, SHA-256 `66e2b63b…`. The
  build ID inside is still `playable-0047`: `3546d9ea` does not rename it.
  The integrity-profile build of the same source is `4fe2b00c…`. Both use the
  `illidan-visible-20261006` container and assets.
- Helper: `cargo build --locked --release --bin wc3-journal` from the same
  source, SHA-256 `cb3669c7…`.
- Raw captures, logs and moments are private under
  `~/.local/share/smashcraft-build-inputs/playable-0048/`.

## Runs

`bun wisp parity capture --bot` (smashcraft:ts/scripts/integrity/journey.ts)
plays a match and a rematch. Two players on pads face a computer Demon
Hunter. The match timer is one minute with three stocks. Both pads play beats
the whole time. Client B's Warcraft III.exe, checked by its DISPLAY, is
stopped for 2 s with SIGSTOP/SIGCONT at 6, 14 and 22 s. At 30 s both pads
hold View, so each helper asks its client to save a moment.

| Run | Map | Options | Beats | Stalls |
| --- | --- | --- | --- | --- |
| R1 | 0.0.48 playable | `--pad49`: match 1 opens with #49's script | 5 ms taps of A, Y, X | match 2 |
| R2 | 0.0.48 integrity | `--bot-four`: adds a computer Archer (four fighters); `-dev perf` overlay on A in match 2 | 5 ms taps of A, Y, X | match 1 |
| R4 | 0.0.48 playable | — | 5 ms taps of A, Y, X, a 200 ms shield, 300 ms dashes right and left | both matches |

All three runs exited 0. The computer won every match, at 29–55 s.

## Results

**#14, PASS.** Illidan's body was drawn above his teal hero glow:

- 58 of 58 in-match captures from R1, on both clients (r1-frames).
- 8 of 8 match-start frames from R1, R2 and R4, four fighters included.

The body measure (dark pixels above the glow, net of the band median) was
696–8069 in this session. In 0.0.47's invisible-Illidan frame it was 76.
R2's scene report at each result passed the lingering check on both
clients: 3 of 583 effects in view, and the stage. Archer and Rifleman were
not pixel-checked one by one, because fighters standing side by side merge
in the column counts.

**#48 box 2, FAIL at the worst frame (the median fits).** Measured on R2's
integrity build, an upper bound for playable: the same executor plus the
trace. The match was four fighters, with Illidan and Archer as computers.
The overlay was read 31 times over 55 s of match 2 (r2-perf-overlay.txt):

- Lua plus natives per frame, median 3.05–4.94 ms (usually 4.03 ms; one
  reading taken as the match started showed 1.10 ms). That
  leaves an 11.8–13.6 ms margin against 16.7 ms.
- Each 2 s window's worst frame took 18–66 ms, in 31 of 31 windows.
- Catch-up: median 0 frames a callback, maximum 6 in every window.
- Native calls, median 129–163 a frame, maximum 2144–3184.

**#48 box 3, FAIL (3 of 12 trials).** Input delay is how many frames the
helper has journaled by its clock beyond the last frame its client consumed,
read at each edit-box receipt. Across 12 stops of client B:

- The ~120-frame backlog drains to 16–30 frames within 0.4–0.6 s every time.
- The first stall of each match then leaves B 15–25 frames above its
  pre-stall 4–5 frames. It returns after 5.5, 5.0 and 4.7 s with three
  fighters, and after 40 s with four (r4-stall-series-e1-t1-b.txt).
- Only 3 of 12 trials settled within 1 s, all of them starting from a
  baseline already raised by the previous stall.
- Both clients agreed throughout: same winners and end frames, and equal
  confirmed states at every common trace frame (R2: 40 frames).

The pre-#48 integrity build (`da3dd889`, dry run) settled in 3.7, 0.95 and
2.6 s.

**#49, PASS except the focus blip, which was NOT RUN.** In R1 match 1,
711 checked frames had 0 mismatches (r1-pad49.json):

- The resting stick and both drifts (+8000/−8000 and −9000/+9000) read
  neutral.
- X pressed special once. Y pressed jump once.
- Down at 0.650 of full tilt (21299) set no down in 87 frames. At 0.670
  (21954) it set down in 87 of 87 frames.
- A held right stayed held for 207 frames.
- The client consumed 1049 of the 1050 records the helper typed.

The focus blip was not run. An inert window on the private desktop never
took focus. The only path that moved focus went to the client's own
Battle.net window, and in the dry run the helper's typing reached the
launcher there, which started two extra Warcraft instances. They were
stopped by PID and A was relaunched through its launcher.

**#47, #50, #51, #54, FAIL on the native-equals-headless half.**

- `bun wisp oracle` on `632b5295` (oracle.txt): 131 pass, 0 mismatch,
  6 departures and 19 n/a. By area: ledge 15, tech 18, getup 23,
  platform 12, landing 5, plus the 3 L-cancel departures.
- All 5 saved moments diverge from the headless replay of their rows at the
  first checkpoint, 120 frames after the snapshot (moment-replays.txt).
  These are R1 ×2, R2 ×2 and R4 ×1, 10 files in all, and each client pair
  recorded the same checksums.
- The same lane's headless playable match with a computer Demon Hunter
  replays moments saved 1 s and 25 s in exactly (headless-late-moment.txt).
  So the difference is between Warcraft's run and Bun's on the same rows.

**#26 re-run, FAIL (no table).** `bun wisp parity capture` ran twice on the
integrity build. Both times, P2 lost the first match's only stock (frames
1221–1241, then 1167; winner P1 on both clients) before the workload's
scheduled Start pause. The journey stopped with "integrity pause was not
committed", so no capture.json was written.

**wisp#15 box 3, FAIL.** F8 did not reach the map natively:

- Three presses on the development build, including a 120 ms hold, did not
  run the map's F8 action: a file write placed at its start was never
  written. Y, registered the same way, paused the match.
- One press during R1 on 0.0.48 saved nothing.

View held on a pad (the helper's request) saved every moment above.

## #17: what a human would report (R1, R2, R4: 3 matches and 3 rematches)

| Item | Result |
| --- | --- |
| Missed / extra inputs | 904 scripted presses (attack, jump, special, shield, dash both ways); 904 rows carry them; 0 missed, 0 extra. #49 script: 0 of 711 frames off |
| Input delay, frames (helper clock − consumed), away from stalls | p50 3–4, p95 4–5; B in stall matches p95 23–26, max 45 (the post-stall residual above) |
| Rollback corrections (R2 trace, first 1200 callbacks per match) | 0–2 per client per match, ≤ 22 frames replayed, deepest 21; playable runs keep no rollback trace |
| Largest position correction | Not recorded by any trace: not measured |
| Stuck controls | 0: no button held in any match's last row |
| Crashes / error reports | 0 error reports, 0 client crashes, 0 helper exits in R1, R2, R4 |
| Outcome / checksum disagreement | 0 between clients (6/6 winners, confirmed states equal); native vs headless replay disagrees in 5/5 moments |
| 2 s stalls | 12 (see #48 box 3) |

## Not from 0.0.48

- **wisp#16 box 1:** soak through the real helper, on `da3dd889` with the
  debug helper. 4 matches, 1580 frames, checksums equal in 4 of 4. One
  finding: a 20.7 ms frame at frame 12. Its repro file does not replay:
  `soak --repro` stops at frame 10 with "no journal row holds … stick
  0,-9083", a stick value inside the helper's dead zone.
- **wisp#17, PASS:** development build from `da3dd889`.
  - `-dev perf` showed "Lua ms: 1.50 / 5.98 (clock step 0.98 ms)" on A
    only, so `os.clock` is present.
  - `hot --watch` printed `pN frame cost vN vs vN-1` for both clients
    1.96 s after "vN running".
  - Over 20,000 frames and 6 reloads: 0 error reports, 0 desyncs.
