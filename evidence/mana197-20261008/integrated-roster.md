# Integrated roster and replay

Build: `e64de1c2866107dd39c4b1a0be71add4b904e5a4` on main.

- All 21 authored fighters, including Chen, Peon, Tinker and Kael'thas:
  `GAME_TESTS=exSpecials bun test test/game.test.ts`, 7 pass, 0 fail.
  The roster loops cover 42 EX neutral/side variants, each with an ordinary
  comparison and an unaffordable-EX fallback.
- Existing computer reaction contracts: 8 pass, 0 fail. This includes 150
  surprise-action traces with zero responses before the authored delay,
  Wren Expert's frame-12 response and zero direction reversals before five
  frames across the original 13 fighters.
- `bun wisp repro ~/.local/state/smashcraft/mana197-20261008/pad/smashcraft-repro-p0-f346-1.txt`:
  each of two clients replayed 346 frames to the recorded `509057:722152`
  checksum. The recording contains both players' EX neutral and side casts.
- Publication checks: TypeScript, type escapes, source shapes and secret
  scan passed. The updated Wisp pin was installed before publication.

Original balance/tier and frame-budget measurements are pending the shared
integrated runs; no independent full field or performance run was started.
