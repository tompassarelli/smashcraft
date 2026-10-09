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

- Stage-select cards: `bun scripts/stageThumbnails.ts --stage NAME` (from ts/,
  through the capacity helper) regenerates one stage's layout silhouette and
  hero render, stores it and records its input hash in its own row of
  ts/stage-thumbnails.json; run it after changing that stage or its art, or
  ts/test/stage-thumbnails.test.ts fails and prints the command. Without
  `--stage` it redraws every stage (smashcraft:docs/design/stage-select.md).
