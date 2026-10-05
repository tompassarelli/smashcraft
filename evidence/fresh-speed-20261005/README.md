# Fresh-match speed, #39 — 5 October 2026

**Gate not met.** The box asks for rebuild-start → both clients' `-dev quick`
receipts in ≤ 15 s on 3 runs. Three completed runs took 27.3, 32.9 and 29.8 s
(launch to exit). A fourth run failed at the join. Even with no automation
time at all, the Warcraft and Battle.net waits measured below add up to about
19–21 s.

## Setup

- Lane `native-owner-20261005`, based on the lane's `fresh` macros
  (batched leave from `--from-game`, batched host name/Create, concurrent
  guest name entry). `fresh` gained `--profile`, so `--rebuild` keeps the
  integrity build instead of switching to the main profile.
- Map: a private copy of the four-fighter integrity diagnostic,
  ~/.local/share/smashcraft-build-inputs/native-owner-20261005/fresh-speed/Smashcraft diagnostic fresh-speed.w3x
  (38–40 MB, build `typescript-integrity`).
- The script was compiled once before the runs (cold compile 7.33 s, not
  counted). Each timed run reused it: `script reused`, rebuild 0.11–0.13 s.
- Command per run, in a 6-CPU capacity scope:
  `WAYGATE_DESKTOP_TIMINGS=1 bun scripts/waygate.ts fresh MAP --rebuild --from-game --profile integrity`.
  `wall.txt` holds launch and exit times; `fresh.log` holds Waygate's step
  and desktop-operation timings.
- Run 2 recorded both desktops (wf-recorder, 2 codec threads each, in its
  own 6-CPU scope). The video stays private at
  ~/.local/share/smashcraft-build-inputs/native-owner-20261005/fresh-speed/run-02-video/.
  Recording slowed that run; it is used only to time the screen changes.

## Runs

Phase durations are the time automation observed each boundary, in seconds.
"Leave" is when the slower client reached Custom Games.

| Run | Variant | Wall | Rebuild | Leave | Host | Join | Lobby full | Start → selection | Quick receipts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | lane macros | 27.299 | 0.115 | 4.807 | 6.409 | 3.939 | 0.211 | 11.141 | 0.303 |
| 2 | lane macros, video | 32.883 | 0.133 | 5.716 | 7.841 | 6.604 | 0.338 | 11.450 | 0.365 |
| 3 | name typed after hosting; host starts on arrival | 29.809 | 0.110 | 4.413 | 6.847 | 6.548 | 0.275 | 10.866 | 0.363 |
| 4 | name typed early; host starts on arrival | 30.378 (failed) | 0.130 | 3.534 | 6.457 | > 20 (password prompt) | — | — | — |
| **Median, runs 1–3** | | **29.809** | 0.115 | 4.807 | 6.847 | 6.548 | 0.275 | 11.141 | 0.363 |

## Where the time goes

Times are from run 2's video, aligned on F10 → Game Menu (+0.20 s) and on
`-dev quick` → match (+0.35 s), and from Warcraft's War3Log.txt on client A.

| Phase | Warcraft/Battle.net time | Automation's added time |
| --- | --- | --- |
| Leave | Score screen visible about 0.35 s after Q and settled after about 1.1 s; Custom Games visible 1.4–2.5 s after Back. Minimum about 3–3.9 s. | 0.3–0.8 s per boundary |
| Host | Create Game screen usable about 1.45 s after its click; map selection about 0.5 s. After Create, War3Log shows `Opening map` → `NetProviderBNET::PostDistFileComplete()` in 2.7 s (run 2) and 3.9 s (run 1), with the lobby just after. | about 0.3 s per OCR boundary |
| Join | B stays on an unchanged join screen (host name and BACK) for 4.6–5.5 s after Join, then the lobby loads. | about 0.9 s to read the lobby |
| Start → selection | 5 s lobby countdown, then loading; ready file written 10.9–11.5 s after Start. | ready-file poll only |

The host's distribution step does not depend on map size. In today's
War3Log the first host of each map name took 3.9–4.9 s and later hosts of the
same name 1.8–2.7 s. The 0.56 MB `frame-cost-paired-20261005b` map took 4.22 s
on its first host, the same as the 34–40 MB maps.

## Fixes tried on the join phase (two, both failed)

1. Type the game name only after the host's lobby exists (run 3). Join was
   still 6.548 s, so typing early was not the cause.
2. Keep early typing, but let the host create the game as soon as it reaches
   Custom Games (run 4). B joined the lobby: A showed `PLAYERS: 2/4`, and
   after CANCEL B showed "You joined scdev …". But a modal
   `[L:PASSWORD ENTER]` with CANCEL/CONFIRM covered B's lobby, so the lobby
   read timed out after 20 s.

Both changes were withdrawn. The committed `fresh` keeps the lane's
orchestration and adds only `--profile`.

## Recommendation

Change #39's fresh box from ≤ 15 s to the measured floor of this route, about
≤ 22 s over 3 runs, after one join fix: when a password modal covers the
guest's lobby, press CANCEL and keep the lobby read going. Estimated cost:
about 30 minutes plus 3 native runs. Reaching 15 s would need a route that
skips the Battle.net leave, re-host and join, and countdown; none has been
observed on these clients. Script-only edits already apply without re-hosting
through `waygate hot`.
