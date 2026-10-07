# Local input recovery (#233)

The release keyboard sender permanently set `sendFailed` when one
`BlzSendSyncData` call returned false. A reproduced refused send still stopped
local rows 120 callbacks later. It now retains the failed packet and newly
captured rows, retries in order, and keeps their original capture frames and
timestamps. The multiplayer receive rules and two-frame capture delay are
unchanged.

Checks in `ts/`:

- `bun test test/playable-delay.test.ts`: 4 passed. One refused send recovers;
  the existing two-frame prediction and independent capture records pass.
- `GAME_TESTS=localInput bun test test/game.test.ts`: 1 passed. A 60-row send
  cut retains all 60 original rows; playback reaches frame 62 and the press
  still executes on its original frame 17.
- `bun test test/local-input-focus.test.ts`: 2 passed. One second without focus
  captures 60 neutral rows, including the original release. A pause samples
  neutral keys, keeps its agreed frame, and resumes advancing without waiting
  for its own player.
- `bun run check`: passed.
- Emitted Lua32 playback regression: 1 passed with
  `codex-perf-20261007/ts/build/lua-stock/lua-5.3.6/src/lua`; the full Lua suite
  reached its five-minute runtime bound, so the changed playback regression
  was compiled and run separately in `ts/build/input233-lua/`.

## Read-only playtest evidence

Times below are 8 October 2026, UTC+8. These facts were read from Tom's
CustomMapData and the existing controller service journal. No game controls,
process inspection, service restart or account actions were used on Tom's
install.

Replay 151 used the playable keyboard path. Its fourth and final persisted
part was written at 01:14:00.460 and ends at checkpoint 1560. The later match
record says it was interrupted at frame 2022. The service kept keys on from
01:13:31 until focus loss at 01:14:11; the next pad disappearance was at
01:14:35. Neither the failed send nor the final missing input frame is stored
in these files, so the reproduced sender failure is a supported repair, not
an established cause of that particular playtest.

Replay 156's part 11 was 8,194 bytes, ended at checkpoint 7200, and was written
at 01:28:07.082. Part 12 was 4,167,803 bytes, contained a new segment at frame
7421, and was written at 01:29:15.169. The match record later reached frame
7630 before being interrupted. Focus was lost at 01:28:11 and restored at
01:29:10. The large resume segment matches the independently reproduced
pause serialization fault repaired for #206.

The controller service repair is separate: commit `b79b08e6` passed 27 service
tests, including a 1.85-second disappearance retaining one held press with
zero releases or repeated presses, and Bluetooth discovery without a by-id
link with the held button in its first snapshot.

The final native one-second pad-cut LAN match is held by the session's native
test pause. The precise missing frame in replay 151 remains unknown.
