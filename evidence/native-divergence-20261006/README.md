# Native moments versus headless replay: 6 October 2026

Why the 0.0.48 native bot session's moments (#59;
smashcraft:evidence/bot-session-0048-native-20261006/README.md) don't replay
headlessly. Inputs: the five moments, helper logs and integrity traces under
`~/.local/share/smashcraft-build-inputs/playable-0048/` (private). Replays used
the session's source, `632b5295`, unless noted.

## Rows: not the cause

Rows decoded from each helper's `editbox_emit` records in `helper-N.log` equal
the moment's rows on every frame: 3278 of 3278 frames across the five moments
(R1 matches 1 and 2, R2 matches 1 and 2, R4 match 2).

## Runtime: not Bun against Lua

`bun wisp repro` and the same replay in stock 32-bit Lua 5.3.6 reach the same
checkpoint and final checksums for all five moments. Both runtimes round every
binary32 operation to nearest.

## First differing state: frame 0, the Rifleman's aerial jump speed

R2 has an integrity trace of confirmed checksums from frame 0 to about 1200.
Each R2 match was rebuilt from frame 0: fighters created as the shell creates
them, the moment's match record with the clock at 3600, and the rows from the
helper logs.

- With host tuning, frame 0's checksum is 223797:897164. The trace has
  369585:197574.
- Copying the tuning that the moments recorded natively gives 369585:197574.
  One tuning field differs: the Rifleman's `physics.aerialJumpSpeed`, natively
  23.12399673461914, on the host 23.123998641967773.
- That field is `f32(melee(4.099999904632568) * 0.9399999976158142)`. The exact
  product is 23.12399850702286. The host value is rounded to nearest. The native
  value is rounded toward zero.
- All five moments recorded the same native value.

`f32()` compiled to Lua's raw operator, and Warcraft's raw `*` (and `+`) don't
round to nearest (smashcraft:evidence/warcraft-lua-numbers-20261005/README.md).

## Rounding models

Each model is a Lua 5.3.6 build with `LUA_32BITS` whose `luai_numadd`, `luai_numsub` and
`luai_nummul` macros round the exact result as listed (scratch builds, not
kept).

| Raw `+ - *` rounding | R1 match 1 (662 frames) | Other 4 moments | R2 frame 50 vs trace |
| --- | --- | --- | --- |
| to nearest (stock Lua32, Bun) | misses | miss | misses |
| toward zero, `/` to nearest | lands on 14760:637232; 1320–1800 checkpoints miss | miss | misses |
| toward zero on `+ -` only, or on `*` only, or on `/` too | misses | miss | misses |
| toward −∞ | misses | miss | misses |

So Warcraft's raw arithmetic is close to rounding toward zero, but its exact
rule is still unknown. Through frame 58 of R2, the trace's 3-decimal
positions, launches and damage match the replay; only low bits differ.

## Exact f32

Wisp a382883 compiles `f32(a + b)`, `f32(a - b)` and `f32(a * b)` to exact
binary32 operations in Lua (`f32(a, b, operation)`).

Six replays were run on main `4eab3f39` with that Wisp: 4 moments and the 2
rebuilt R2 matches, 4892 frames. R2 match 2's moment no longer restores in
current source, which needs `stickSideAge`.

- Their checksums are identical in stock Lua32, in the toward-zero Lua32, and
  in Bun.
- With the old compiler, the toward-zero Lua32 gave different checksums from
  the other two.

Cost in stock Lua32 on the development machine, same six replays:

| Build | Time |
| --- | --- |
| raw f32 | 2.5–2.9 s |
| exact f32 | 5.6–6.8 s, with 2.86 million exact operations |
| exact f32, plus a ±1 rough-distance test before `signedDistance` in `surfaces.ts` | 3.3 s |

75% of the exact operations came from `signedDistance` in
smashcraft:ts/src/game/sim/surfaces.ts.

The run with the rough-distance test gave the same checksums.
