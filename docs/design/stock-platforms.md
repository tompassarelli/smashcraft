# Stock-built platforms

How far Warcraft's own models and textures go for a stage's raised platforms,
so a stage gets a platform that fits its place without a custom model or a
large import (#290, feeding #276; map size: [map-size](map-size.md)).
Platform collision never changes: a platform's walking line, ends and
pass-through rule stay the deck's own (smashcraft:ts/src/game/sim/stage.ts).
Only the drawn models change.

## How a stage uses it

smashcraft:ts/src/game/presentation/stockPlatforms.ts lists, per raised deck,
the stock models drawn for it: each with an offset from the deck's centre on
its walking line, a per-axis scale in the model's own axes, and a yaw in
degrees. The first part stands in for the palette slab, so the scene still
counts one deck piece per platform; the rest are dressing parts that the
shell creates, fades and clears with the decks
(smashcraft:ts/src/platform/shell/view.ts). A stage with no list keeps its
palette slab. The parts' models are declared as "stage deck" in
smashcraft:ts/scripts/wisp/playerView.ts and need model facts like any other
model (smashcraft:docs/player-view.md).
smashcraft:ts/test/stock-platforms.test.ts checks every deck of every stage,
slabs included, from each model's bounds and scale in every graphics mode:
the drawn walking piece's top within 3 units of its collision top and its
ends within 4 units of the deck's ends; no drawn part above its walking line;
and no part hanging deeper than the palette slab's body (17 units) into the
space a reference fighter (132 units) stands in above another deck (#322).

Frozen Throne is the first stage built this way (Icecrown ice over saronite,
[stage-art](stage-art.md) rule 10): each platform is an alpha-cut Northrend
ice floe, its top on the walking line, over Icecrown rock and saronite rubble
hung upside down beneath it. All three use North_IceFloe3 at yaw 0 or 180,
the only floe and turn that spans the deck in both classic and HD, squashed
to 0.19 of its height; the dressing differs per platform. Under the side
decks everything stays within 25 units of the walking line, above a standing
fighter's head. Imports: none.

## Techniques

Measured on 8 Oct 2026 with headless renders of Frozen Throne at the near
(frame 160) and far (frame 260) camera extremes, the method of
smashcraft:evidence/stages191-20261008/result.md; raw record in
smashcraft:evidence/platforms290-20261008/result.md. Byte costs are the
classic model files in Warcraft 3.0.1's CASC storage; Reforged and
Definitive sizes are their `_hd.w3mod` / `_de.w3mod` files, which the
extractor returned with identical bytes for every model below.

| Technique | Render (private) | Map bytes | Limits | Suits |
| --- | --- | --- | --- | --- |
| Scale and rotate one stock model | `final`, `t2` | 0 | Matrix scale is per model axis before the yaw, so a quarter turn swaps which scale is the width. Classic models are low-poly; stretching one more than about 1.5x across shows texture stretch. | Any platform whose stock analogue exists: floes, bridges, slabs of rock |
| Combine stock doodads into one platform | `final`, `t3` | 0 | Each part is a separate effect (3 per Frozen Throne platform); moving platforms would need every part moved each frame, which the shell does only for the walking piece today, so it is limited to fixed platforms until that is added. | Fixed platforms (Frozen Throne, Nordrassil, Gryphon Aerie's fixed decks, Hellfire) |
| Negative height scale: hang rock under a platform | `final`, `t2` | 0 | Flips the model upside down, a cheap underside mass like Battlefield's; the renderer and, by the scene report, the scene check accept it. Native face culling under a mirrored matrix is unmeasured; box 3's captures judge it. | Every floating platform's underside |
| Alpha-tested stock textures to cut the outline | `final` (floe edges), `t2` (bridge walkway) | 0 | Only shapes stock models already cut: the Northrend floes (FilterMode Transparent) and the bridges' walkway planes. A new outline needs an authored quad (a few hundred bytes) on a stock alpha texture. | Ice and broken-stone platforms |
| Replaceable-texture swap on a stock model | `t3` (top platform) | 4,840 B (RoughCliffDoodadCollapse0 copied with its cliff slot pointed at `TerrainArt\Icecrown\Ice_Cliff1`) | A special effect can't set a model's replaceable texture, and destructables, which can, stand on the ground, not at arena height. So the swap is a copied classic model with the texture path changed: a few KB, but it draws the classic file in every mode (no HD materials) and the renderer can't show replaceable-texture slot 11 on an unmodified model. | Stone or cliff-bodied decks: Blackrock basalt, Qiraji sandstone, Scourge stone (each tileset's `*_Cliff0/1`) |
| Cliff and terrain pieces | `t3` | 4,840 B (same copy) | Cliff doodads are one-sided: they show only from their front, so the yaw must face the camera (270 here, 90 drew nothing). Unmodified they take the map's cliff texture through slot 11. | Thick-bodied platforms and ledges |
| Stock materials matched to the theme | `final` | 0 | Picking from what exists: Icecrown has ice (Ice_Natural01, NorthrendNatural03) and saronite-dark structure textures (Ice_Strucures); a theme with no stock material needs a swap above. | Every stage: [stage-art](stage-art.md) rule 10's themes |
| A stock bridge as a platform | `t2` (left) | 0 | IceBridge (18,916 B classic, 1,052,218 B HD) turned a quarter and scaled 0.3: its railings and dark end faces make it read as a box from the arena camera; rejected for Frozen Throne. | A stage that wants a walkway with rails (Stratholme, Durotar's timber) |

## Classic, Reforged and Definitive

- Stock paths resolve per mode: Classic draws the classic file, Reforged and
  Definitive the HD file at the same path, with diffuse, normal and ORM
  textures (Ice_Rock0: 3,460 B classic, 113,210 B HD). These cost the map
  nothing in any mode.
- HD geometry can differ a lot. Ice_Rock0's HD top is z 121 against classic
  107, Icecrown_Rubble0's 82 against 79. The HD floes are lumpy icebergs, not
  flat floes: North_IceFloe3 is z -76 to 61 in HD against -22 to 31 classic,
  and North_IceFloe2's HD long axis is y, not x (x -115 to 29). At its #290
  scale the HD floe stood 22 units above the walking line and hung 90 below,
  into the fighters' space under the side decks (#322). Their files carry a
  camera chunk the `war3-model` decoder can't read, so the test keeps their
  MODL extents, read straight from the `_hd.w3mod` files, beside the
  classic model facts.
- A copied (swapped) model draws its classic geometry and classic texture in
  every mode, so it looks flatter beside HD stock parts.
- The headless renderer draws classic models only.

## Choosing for a stage

Start from the stage's material set in [stage-art](stage-art.md) rule 10
(and its board in stage-boards.md once #272 lands): pick a stock walking
piece whose top is flat and nearly as wide as the deck at a scale of 0.8–1.5,
hang one or two stock masses of the body material under it, and vary yaw and
dressing per platform. Use a swapped copy only when no stock model carries the
theme's material, and keep each under 50 KB.
