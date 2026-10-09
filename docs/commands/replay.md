# Replay

- Replays: every client records each match as `smashcraft-replay-N.txt` (a
  manifest written at its end) and `smashcraft-replay-N-K.txt` parts written
  during it. `LUA=<32-bit lua> bun wisp replay FILE [--out JOINED]` replays a
  manifest with its parts, or a joined replay, in Bun and 32-bit Lua to every
  recorded checksum; `--out` writes the joined replay to share
  (smashcraft:docs/design/client.md, "Full-match replays").
