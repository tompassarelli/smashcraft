# Headless

- Headless match: `bun wisp headless [quick-match|desync] [--clients N] [--journey FILE] [--render DIR --frames N... --graphics classic|definitive]` plays
  the dev build's quick match in simulated clients in about a second and prints
  desyncs, error reports and scene problems; `--cost` adds its predicted
  Warcraft cost per frame. `--render` draws requested frames using the map's
  immutable imports and classic Warcraft assets; `--journey FILE` supplies
  capture inputs as journey JSON. Stock extraction uses `CASC_EXTRACTOR`
  and `WC3_STORAGE`; stock caches follow that installation's `.build.info`, so
  updated game art is extracted again. `WC3_ASSET_MANIFEST=FILE` records the build
  and SHA256 of every returned asset for a comparison. `WC3_TEXTURES` reuses extracted PNGs
  (smashcraft:docs/player-view.md).
