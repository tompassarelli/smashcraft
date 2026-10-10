# Stage

- Stage lighting: `bun wisp accept --only '170-*'` captures stock lighting, a
  fighter mask and stage lighting in one paused scene per stage. From the
  repository root, `bun tools/stage/contrast.ts MASK.png STOCK.png STAGE.png`
  measures fighter/background lightness and colour distance. The native
  owner records the graphics profile and checks #168's budget; procedure:
  smashcraft:docs/design/visual-quality.md.
  `bun wisp accept --only '191-*'` captures every stage at its closest and
  widest gameplay camera for the floating-stage art checklist. Development
  maps expose `-dev view near|far|off` for those framings and
  `-dev fogv STYLE ZSTART ZEND DENSITY HEIGHTSTART HEIGHTEND LINEARSTART LINEAREND R G B OVER_SKY`
  for the existing 3.0 fog comparison; these affect only local presentation.

- Stage search: from the repository root, through the capacity helper,
  `bun tools/stage/search.ts STAGE [SPEC.json] [--out DIR]` captures the
  stage's near and far views once, rejects every candidate that breaks a
  render-free rule (fog start ≥ 5000, deck body ≥ 50 darker than its top and
  top ≥ 40 from the fog, pieces inside x ±4096, nothing floating, no mirror
  twins, scenery behind the fight, a light that keeps its fighter rules),
  renders the rest in one warm Wisp call per mode and client, and ranks them by worst empty-backdrop
  share. It writes `DIR/STAGE-search.txt`: the table and the top one or two
  finalists as scenery and light source, numbers written as `f32(...)` where
  binary32 needs it. Splice a finalist in, then run `contrast.ts
  --stock-light STAGE` and one fresh judge. SPEC.json lists values per axis
  and searches their product: `fogStart`, `fogEnd`, `fogColor` ([r,g,b] 0–1),
  `tint` ([r,g,b]), `tintScale`, `depth` (y offset of every piece), `scale`
  (multiplier), `lightKey`, `lightAmbient`, `lightIntensity`, and
  `pieces: {"INDEX": {x, y, z, scale}}`, plus `modes` (default classic and
  definitive), `clients` (default [0]) and `finalists` (1 or 2). Model choice
  stays a human step; with no spec it sweeps fog end and tint scale. The
  rules live in smashcraft:ts/src/game/presentation/stageRules.ts and
  smashcraft:ts/scripts/stageViewRules.ts, shared with the stage tests.

- Stage-select cards: `bun scripts/stageThumbnails.ts --stage NAME` (from ts/,
  through the capacity helper) regenerates one stage's layout silhouette and
  hero render, stores it and records its input hash in its own row of
  ts/stage-thumbnails.json; run it after changing that stage or its art, or
  ts/test/stage-thumbnails.test.ts fails and prints the command. Without
  `--stage` it redraws every stage (smashcraft:docs/design/stage-select.md).

- Deck texture repetition: `bun tools/stage/period.ts IMAGE.ppm X0,Y0,X1,Y1 [EXCLUDED_X0:X1,...|-] [PROJECTED_PERIOD_PX]` measures the visible front face using radius-32 high-pass luma and overlap-normalized Pearson correlation at horizontal lags 64–700 pixels (up to half the box width). State each camera's box and any excluded occluder columns; the strongest correlation must be below 0.30.
