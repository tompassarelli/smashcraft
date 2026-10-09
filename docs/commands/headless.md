# Headless

- Headless match: `bun wisp headless [quick-match|desync|cpu-expert|computer-match] [--clients N] [--journey FILE] [--render DIR --frames N... --graphics classic|definitive]` plays
  the dev build's quick match in simulated clients in about a second and prints
  desyncs, error reports and scene problems; `--cost` adds its predicted
  Warcraft cost per frame. `--render` draws requested frames using the map's
  immutable imports and classic Warcraft assets; `--journey FILE` supplies
  capture inputs as journey JSON. Stock extraction uses `CASC_EXTRACTOR`
  and `WC3_STORAGE`; stock caches follow that installation's `.build.info`, so
  updated game art is extracted again. `WC3_ASSET_MANIFEST=FILE` records the build
  and SHA256 of every returned asset for a comparison. `WC3_TEXTURES` reuses extracted PNGs
  (smashcraft:docs/player-view.md).

- Text match: `bun wisp headless text-match [--seed N] [--you SLUG] [--cpu SLUG] [--level rookie|beginner|intermediate|advanced|expert] [--stage NAME] [--delay N] [--every N] [--frames N] [--stocks N] [--minutes N] [--input FILE]`
  plays one seeded match in the pure simulation (no Warcraft runtime) where
  fighter A is driven by stdin (or `--input FILE`) and fighter B by a
  computer at `--level`, and prints one compact line per `--every` frames
  (default 1): frame, then for A and B x, z, percent, stocks, action state,
  facing, signed distance to the nearer deck edge, dx/dz to the nearest side
  platform, and each active hitbox of that fighter within 150 units of the
  other (local x and z range and its gap). The same seed, options and input
  reproduce the output byte for byte. Projectiles are not shown.
  Input lines are `FRAME WORD...`: the words are held from that frame until
  the next line (an empty line body or `neutral` releases everything); `left
  right up down` push the stick fully, `x=N z=N` set it between -127 and 127,
  `attack special jump grab shield walk short-hop smash-left smash-right
  smash-up smash-down` press buttons, and a trailing `!` holds a button for
  that one frame. A command stated at frame F reaches the fighter at frame F
  plus `--delay` (default 4). The whole input is read before the match starts,
  so an agent that plays turn by turn re-runs the match with the file grown by
  its latest lines; determinism makes the earlier frames identical. Core:
  smashcraft:ts/scripts/textMatchView.ts (parsing, delay, the line format),
  driver: smashcraft:ts/scripts/textMatch.ts. Issue: #407.

