# View

- Player view: `bun wisp view scene DATA_DIR...` and `bun wisp view frame
  FRAME.ppm...` report what a player would see wrong; `view models --prune` removes facts for deleted models without remeasurement; `view models` rewrites
  the model facts they read; `view models ... --only MODEL,...` refreshes only the named rows (smashcraft:docs/player-view.md); `view strikes --assets DIR`
  rewrites the hero strike moments swings and specials align to
  (smashcraft:docs/fighter-animation-work.md, "Hero swing alignment");
  `view motion --assets DIR [--character ID]` measures every fighter's movement and recovery
  clips and rewrites their foot cadence and audit (smashcraft:docs/fighter-motion.md);
  `view reach --assets DIR [--character ID]` rewrites how far fighters' swings
  draw toward their strikes (smashcraft:docs/hurtboxes.md).
