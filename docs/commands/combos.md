# Combos

- Combo potential: `bun wisp combos [--fighter NAME]... [--jobs N]` searches
  true combos and tech-chase reads, replays its best routes, and writes the
  per-fighter openings-per-kill table (docs/design/balance.md, "Combo potential").

- Advantage state: `bun wisp combos --advantage [--fighter NAME]... [--jobs N]`
  measures every fighter's throws at 0/20/40/60% against a light, medium and
  heavy target with and without DI, its forced knockdown and tech-chase
  coverage, tech trap and juggle, and writes
  smashcraft:tools/move-data/advantage-state.md against the targets in
  smashcraft:docs/gameplay-design.md, "Advantage state" (#388).
