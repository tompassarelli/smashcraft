# Repro

- Repro: `bun wisp repro FILE [--view] [--test NAME] [--shrink [--out FILE]] [--frame N --out FILE] [--diff-frame N|previous]` replays a moment a player saved
  with K (or View held on a controller) in simulated clients, to the checksum
  the game recorded; `--test NAME` writes a test that replays it. `--frame N
  --out FILE` saves its exact canonical state after N; `--diff-frame previous`
  or another saved frame adds a sorted field-path diff (wisp:docs/repro.md).
