# Stock-built platforms on Frozen Throne (#290)

Headless renders (`bun wisp headless --journey s2.json --render DIR --frames
160 260`, journey `-dev quick stage 2`, `-dev view near` at 100, `-dev view
far` at 180), the method of smashcraft:evidence/stages191-20261008/result.md,
from lane platforms-290 on main 6b1f3c18.

- base: palette slabs (main).
- t1: IceBridge (scale 0.3, yaw 90), North_IceFloe, IceBlock + Ice_Rock +
  crystal composite. Bridge sat too low (offset from its railing top, not
  its walkway at z 45); crystal composite read as clutter.
- t2: IceBridge on its walkway: railings and dark end faces read as a box.
  North_IceFloe2 with two Ice_Rock0 hung under it by a negative height scale:
  reads as a floating ice floe. Retextured cliff piece at yaw 90: not drawn
  (one-sided, faced away).
- t3: two floe platforms with Icecrown_Rubble0 and Ice_Rock0 hung below; the
  retextured cliff piece (RoughCliffDoodadCollapse0 with slot 11 pointed at
  TerrainArt\Icecrown\Ice_Cliff1, 4,840 B, placed in the private stock render
  cache for this trial only, never in the map) at yaw 270: draws as an
  Icecrown stone slab.
- final (shipped): three floe platforms (North_IceFloe2 twice, North_IceFloe3
  on top) each over saronite rubble and ice rock, every top within 2 units of
  the walking line. Both extremes: platforms read as ice over dark stone
  against the sky; nothing new below the deck.
- Scene check: same 8 problems as base (unmodeled natives such as
  BlzShowTerrain), none from the new models once their facts were added;
  10 stage deck pieces drawn (4 decks + 6 dressing parts).
- Model bytes (CASC 3.0.1, classic / HD): North_IceFloe2 4,830 / 95,648;
  North_IceFloe3 3,945 / 108,404; Ice_Rock0 3,460 / 113,210;
  Icecrown_Rubble0 5,560 / 206,974; IceBridge 18,916 / 1,052,218;
  RoughCliffDoodadCollapse0 4,840 / 21,240. `_de.w3mod` returned the HD bytes.
- Map imports added: none.

Renders, scripts and the trial model are retained privately under
`~/.local/share/smashcraft-build-inputs/platforms290-20261008/` (stock
Warcraft art), not committed.
