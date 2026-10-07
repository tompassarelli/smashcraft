# Defile cast and edge — 8 October 2026

Defile’s simulation is unchanged from accepted frozen field `82995f01`; only
its move-list description changes in `lichKingSpecials.ts`. The accepted field
37651390705 played 31,200 matches and passed 13/13 original 40–60% bands
(Lich King 53.3333%). This supports the existing #174 balance box, not later
changes to gameplay. The immutable report is
`evidence/balance-numbers-20261007/round-2-result.md` at `8a2cf49e`.

The cast replaces only Special Down at its existing index 63 and 50-frame
length. Frame 20 plants Frostmourne: drawn-model tip height 0.986 units.
`check-strikes.ts BEFORE AFTER 'Special Down'`: 95 prior clips kept, 0 changed.
The original clip export also changed only LichKingOriginalClip63’s hash;
other fighters’ retained clip/source hashes passed.

The pool’s opaque dark interior and additive rim share the danger radius;
the outer edge stays at the simulation radius while its color flashes for
12 frames after a growing hit. The flash derives from existing projectile
state, so pause and rollback cannot advance an independent flash clock.
The move list says: “Plant Frostmourne to spread a shadow pool; hurting a
grounded foe grows it and flashes the edge. Jump out; recasts must wait.”

## Checks

- `bun run check`: pass.
- `bun test test/game.test.ts -t Defile`: 3/3 pass.
- Focused emitted Lua32 bundle: 13/13 pass (projectile presentation and
  Lich King special contracts, plus existing Lua table census).
- Original `lich-king-defile.pad`, with the current controller helper,
  headless: 54/54 input edges on frame, 7/7 expectations, 2/2 scene models.
  It covers refused recasts, repeated casts, the jump escape and both facings.
  #16’s explicit same-pad headless substitution applies to this behavior box.
- The original existing replay evidence remains applicable: presentation art
  and description change no replay state or gameplay.

Private art, PNGs, scenes, helper traces, model, and maps stay outside Git:
`~/.local/share/smashcraft-animation-reference/defile174-20261008/` and
`~/.local/share/smashcraft-build-inputs/defile174-20261008/`.
`repeat-escape-current/` is the original passing script.
`corrected-cast/` redraws the same four captured scenes using the final
immutable model paths; it does not replay or change simulation inputs.
`growth-final/` and `growth-final-frames/` use `174/growth.pad`, the existing
#167 down pad with additional capture moments and identical behavior
expectations. Consecutive captures 679/680 skipped 680 in the engine’s
presentation callbacks; the duplicate frame-680 capture was removed only
from this new capture pad.

Final `174/growth.pad` run: 24/24 input edges on frame, 6/6 expectations,
1/1 scene model; thirteen requested frames rendered. Three growths at frames
696, 732 and 768 expand the radius from 39.6 to 45.6, 51.6 and 57.6;
all three flash white (255,255,255) and return to purple (170,75,255)
after twelve frames. `growth-pulses.json` records the drawn effect values.
The final sheet visibly separates the planted sword silhouette and the bright
versus settled pool edge, in the actual side-view headless render.

`bun wisp map build --profile native-driver --name Defile174Final --out …`:
pass, 1256 packaged entries verified. The final private map is
`~/.local/share/smashcraft-animation-reference/defile174-20261008/Defile174Final.w3x`.

Tom’s visual verdict remains pending. The original native-look box remains
pending while native use is prohibited; rendered headless frames are prepared
for review, not claimed as native Warcraft captures.
