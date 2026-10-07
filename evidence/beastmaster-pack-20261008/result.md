# Beastmaster pack: issue 215

All four current issue checks pass. Bear readability is checked automatically
below.

The design landed first in `8423ac38`. The pack implementation is `fa500819`,
and `777b659f` records companion CPU activity and pauses Quilbeast's automatic
shot while commanded or stunned. Bear, Quilbeast and Hawk have separate
positions, health, lifetimes and attack phases. They coexist using stock
Warcraft models. Normals retain the accepted numeric tuning and 25° down throw.

## Gameplay and presentation

- Bun and emitted 32-bit Lua: 13 Beastmaster gameplay/CPU contracts pass,
  covering every special, all three companions and every summon/command form.
- Replay and gameplay subset: 17/17 pass, including all pack state restoration.
- `bun wisp headless`: two clients, 600 frames, identical checksums, no desync;
  reload passed.
- `bun wisp pad test/native/pads/215/pack.pad --headless --helper <wc3-journal>`:
  eight special/form checks, six model-in-view checks, 50 input edges,
  zero off-frame or late writes. This uses the real input helper and headless
  scene; no native client or display was touched during Tom's playtest hold.
- [CPU coverage](coverage.json) at `777b659f`: eight matches, specials
  44 neutral / 36 side / 13 up / 41 down. Bear was active for 3,068 frames,
  Quilbeast 4,158 and Hawk 1,616. Missing requirements: none.

## Original seeded field

Both runs used `bun wisp farm balance --wait`: Wren expert, 400 matches per
pair, 78 pairs, 31,200 matches, with the original stage/spawn/seed settings.

| Revision | Beastmaster wins | Losses | Ties | Timeouts | Win rate | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `8cccdcc9` | 2,890 | 1,910 | 0 | 0 | 60.2083% | Above 60% ceiling |
| `777b659f` | 2,618 | 2,182 | 0 | 0 | 54.5417% | Beastmaster passes 40–60% |

The second run includes the Quilbeast shot correction and the independently
landed Uther rework, so it is not an isolated estimate of the correction's
balance effect. The whole-field command fails only for Uther (89.875%); its
worker owns that tuning. Beastmaster's issue requires his own field result.

- First run: [37655978417](https://github.com/tompassarelli/smashcraft/actions/runs/37655978417), [field report](field-r1.md).
- Final run: [37657370014](https://github.com/tompassarelli/smashcraft/actions/runs/37657370014), [field report](field-r2.md).

The whole Bun suite reached pre-existing numeric expectation failures before
its 300-second stop. The accepted-number cleanup subsequently landed as `267eb68c`; all
new Beastmaster contracts above pass.

## Bear readability follow-up

Design `9dc18f3e` precedes the feedback implementation. Every command rears Bear
48.7 degrees, enlarges its windup silhouette by 25%, shows the stock Battle Roar
crest and plays BattleRoar once. A marker over Bear reads FOLLOWING, CHARGING,
ATTACKING or RESTING. The attack starts from its contact pose and completes
one swipe; connected bites play MetalHeavySliceFlesh and a short impact burst.
No simulation values changed after the passing field.

- Bun and Lua32: two feedback contracts pass, measuring 10 charging / 4 attacking
  / 30 resting frames, three roars in three commands, and two hit cues for two
  connected bites. Repeated confirmed frames emit no duplicate cue.
- Renderer contract: the rear-up exceeds 0.8 radians and 20% scale increase;
  all four labels sit above Bear, one roar and one connected-hit sound play,
  and the expired animal and marker hide. The match/rematch check also passes
  with zero repeated updates of parked effects.
- Updated real-helper script: eight form expectations, seven model checks
  including the roar crest, 50 input edges and zero off-frame or late writes.
  Its first input moved from frame 60 to 180 after one busy-machine run began
  observing at frame 76; all action intervals and expectations are preserved.
- BattleRoar and MetalHeavySliceFlesh are present in the stock sound tables;
  their `.ogg` files were extracted successfully into private storage.
