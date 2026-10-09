# Map

- Map commands: `bun wisp map build [--profile NAME] --name NAME --out OUT.w3x`
  builds the TypeScript map from the private inputs smashcraft:build-inputs.json
  names (`--base`, `--container`, `--assets`, `--summon` override one);
  `bun wisp map rebuild MAP.w3x` replaces only its script.
  Both commands resolve every special, attack, contact-accent and projectile
  cue model in Classic and Definitive through the renderer's real asset resolver.
  A missing path in either look fails the build before replacing the map.
  `--profile native-input` measures the playable keyboard path with developer
  setup and the response probe (Ctrl+G records, Ctrl+H exports); its rendered
  marker identifies the callback actually captured in pixels. Report that
  diagnostic overhead; journal integrity is a separate input path.
  `--profile pause-probe` runs the integrity map's unchanged input path and
  starts its response probe at match setup. The first pause and resume emit
  `pause-boundary` rows; resume exports the positions presented in that callback
  automatically, for `ts/test/native/pads/206/pause-dash.pad`.
  Headless `pad` writes `pause-draws.jsonl` with the last paused picture and
  first resumed picture, fighter/effect positions and animation clocks,
  observing once after each real draw's callbacks (#86).

- Map size: players download the map in the lobby, so prefer Warcraft's own
  assets (reshape, recolour, rescale or recombine stock models, doodads,
  effects and animations) before importing a file. A custom asset is fine
  where stock can't do the job well; each new import's commit names its size
  and why stock couldn't do it. `bun wisp map build` prints the map's size and
  imported bytes; the default build fails when the map is more than 10% over
  smashcraft:ts/map-size-baseline.tsv, naming the largest new imports. After a
  justified import or a cut, rebuild with `MAP_SIZE_UPDATE=1` and commit the
  baseline (smashcraft:docs/design/map-size.md).

- Physics diagnostic: `bun wisp map build --profile physics-probe ...` selects
  the production numerical fixtures. Rebuild it with
  `bun wisp map rebuild MAP.w3x --profile physics-probe`; see
  smashcraft:docs/native-physics-precision.md for the unchanged report gate.

- Frame workload: `bun wisp map build --profile frame-cost ...` runs the
  isolated 4096-frame TypeScript executor and records its complete replay state.
  smashcraft:ts/scripts/frameCost.ts reads recorded paired benchmark results.
