# EX mana acceptance

Source: the commit introducing this file and `sim/exSpecials.ts`.

- `bun run check`: pass.
- `GAME_TESTS=exSpecials bun test test/game.test.ts`: 7 pass, 0 fail;
  34 neutral/side variants across 17 authored fighters cover cost, fallback,
  ordinary duration and EX entry. Light/heavy/second/late/throw contacts,
  stock reset, snapshot equality and the HUD cue are covered.
- `GAME_TESTS=mana bun test test/game.test.ts`: 10 pass, 0 fail.
- `bun wisp pad test/native/pads/197/ex-specials.pad --headless --helper
  ~/code/smashcraft/worktrees/codex-tapjump203-r3-20261007/companion/target/debug/wc3-journal
  --out ~/.local/state/smashcraft/mana197-20261008/pad`: 4 expectations pass;
  both players use EX neutral and side; 26 edges, 0 off their frame, 0 late.

The original balance/tier field and performance measurements are shared
integration work, with their own retained evidence. The headless pad satisfies
the native behavior portion under roadmap #16's 8 October standing order.
