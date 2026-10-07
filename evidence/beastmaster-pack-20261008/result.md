# Beastmaster pack: issue 215

Four of five issue checks pass. Tom's fun verdict remains pending.

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
its 300-second stop. The accepted-number cleanup has a separate owner; all
new Beastmaster contracts above pass. Tom still needs to play Beastmaster and
judge whether commanding this pack is fun.
