# No ground under any stage: scenery bases below the frame (#191)

Headless renders (`bun wisp headless --journey ... --render`) of all eleven
selectable stages with `-dev view near` (frame 160) and `-dev view far`
(frame 260), before and after, the method of
smashcraft:evidence/water193-20261008/result.md.

- Before (main 88e494da): terrain is already hidden (`BlzShowTerrain`), but
  at the far extreme every stage with scenery showed the flat cut bases of
  ground doodads floating below the deck, and most did at the near extreme
  too (a projection of every piece's model bounds against both extreme
  cameras, matching the renders).
- Fix, following Ultimate's Battlefield (towns on cliffs and waterfalls that
  fall out of the frame; the private reference ultimate-battlefield.png):
  natural forms (rock, ice, crystal, coral, spires, tree, obelisks, the
  waterfall, the Frozen Throne massif) are stretched downward with
  `BlzSetSpecialEffectMatrixScale` so their bases reach below the far
  frame, tops unchanged; buildings and props (moon wells, aviary,
  watchtower, necropolis, ziggurat, demon gate, fire props, mine cart,
  arches and walls, Stratholme's buildings and fires, Temple of Tides) stand
  on a stretched stock rock of the stage's kind (Barrens rock, Icecrown
  glacier, Ruins rock). One Hellfire fragment (x 2650, y 6200, scale 0.75)
  is removed: it would need a 25x stretch.
- No new imported files: every model was already in the map.
- The scene report counted any effect below the ground as parked; it now
  counts only effects on the ground (where `AddSpecialEffect` creates them)
  or at hideEffect's parking depth, so the deep scenery is checked as shown.
- Check: smashcraft:ts/test/player-view.test.ts "no stage shows a scenery
  piece's base below the deck at either camera extreme" (fails on 88e494da,
  passes after). player-view 23/23, stageScenery + stagePalette game tests
  5/5, stage-render 2/2, home-stages 1/1.
- After: ten stages render with no base showing at either extreme.
  Stratholme can't render headless before or after (missing map asset
  CityWallEntrance/LargeStratholmeTower_Main_Diffuse.tif); the projection
  test covers it.
- The headless renderer draws no terrain, sky or fog: checklist A (sky) and
  D (fog softening the far band) need the native batch.

Renders are retained privately under
`~/.local/share/smashcraft-build-inputs/stages191-20261008/`, not committed
(stock Warcraft art).
