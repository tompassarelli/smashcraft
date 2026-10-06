# 0.0.49 four-fighter moments versus headless replay: 6 October 2026

The 0.0.49 integrity build was `6282a557` with Wisp 91f8174, which has exact
f32 arithmetic. In its `--bot-four` session, 1 of 4 distinct moments
replayed to its recorded checksum with `bun wisp repro`. Files (private):
`~/.local/share/smashcraft-build-inputs/playable-0049/r2-bot4/`.

| Moment | Bun (`wisp repro`) | Stock Lua32 and toward-zero Lua32, same source |
| --- | --- | --- |
| e1 f778 | first checkpoint (360) misses | lands on every checkpoint and the final |
| e1 f1866 | lands | lands |
| e2 f774 | 480 misses | the final lands; 480 misses |
| e2 f1850 | 1680 misses | 1800 and the final miss |

## Bun against Lua: special hit targets

From f778's frame 335 on, Bun and Lua32 differ in one checksummed field: fighter
3's `specialHitTargets[0]` (2 in Bun, absent in Lua). The full records of
frames 325–335 are equal: the difference comes from the copy taken to checksum
them.

The cause is `copyFighterState`. It looped to `special.hitTargets.length`, the
length of the target fighter's array. Its elements may be undefined, and in Lua
the length of a table holding nil is any border; a fresh fighter's is 0. So
in Lua, and in Warcraft, no hit target reached a replay snapshot or checksum
copy, while Bun copied all four. The 0.0.49 game's checksums never include
hit targets.

Fixed in smashcraft:ts/src/game/replay/fighterState.ts (a fixed count). Wisp
8ceee0e rejects any `.length` read of an array that may hold undefined.

With the fix, the four moments replay to identical checksums in Bun, stock
Lua32 and the toward-zero Lua32. They no longer match the 0.0.49 recordings,
which the game made without hit targets, so a fresh session is needed.

## Lua against Warcraft: the DI angle

Lua32 replaying the session's own source still differs from the game in two
places. A search of the checksummed fields, moving each by up to three ulps,
found one field each time: fighter 0's `launch.diAngleDegrees` is one ulp
nearer zero in the game.

- f774 frame 480: native 10.302379608154297, Lua 10.302380561828613.
- f1850 frame 1800: native −4.127387523651123, Lua −4.127388000488281.

The integrity trace's confirmed checksums match the Lua replay at every
traced frame of f774 and f778 except 408, 468 and 480. Those frames follow
fighter 0's DI at frame 375 and precede its next reset. At 408 the same
single field differs.

Which operation differs is not established. The value is
`multiplyFloat32(rad, 57.29578)` with `rad = multiplyFloat32(degrees, π/180)`;
only the developer HUD reads it. Velocity matched in the game, which rules out
every one-ulp change to the DI inputs (x, z, stick) for the f1850 event.

Rounding `rad` toward zero fits both differing events and the one other DI by
fighter 0. That fighter is the human on a pad, with `diStickValid` set. It
does not fit three computer DIs whose angles matched: rounding `rad` toward
zero would have changed them.

The integrity trace now writes each DI's exact operands and results, so the
next session can repeat the operation natively step by step.

## Overflow

Wisp's helpers built infinity by squaring 2^24. A toward-zero product
overflows to the largest finite value instead. In Wisp's toward-zero Lua32 the
Lua tests failed 5, and 2 after Wisp 0e46c0f set infinity to `math.huge`.
None of these moments reaches an overflow.

## Math libraries

The DI angle path uses no platform math library and no Warcraft math native:
only Wisp's binary32 helpers and Melee's atan2, sin and cos
(smashcraft:ts/src/sim/meleeScalarMath.ts), which are the parity corpus's.
Its operands and results for fighter 0's DI at f774 frame 375 are identical
in Bun, stock Lua32 and the toward-zero Lua32 (the registered test "a DI's
traced operands repeat its angle exactly"). The game's one library call in
synchronized code was the ground-bounce check's `f32(Math.atan2(...))` in
knockback.ts; it and the projectile pitch now use Melee's atan2. Wisp b1c3e19
and later reject the platform math library inside `f32()` and Warcraft's math
and random natives anywhere.
