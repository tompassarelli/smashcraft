# Forsaken Uther field result, 8 October 2026

**Uther passes: 2,797 wins / 4,895 decisive matches = 57.1399387%.**
There are 2,098 losses, one tie and no timeouts across 4,896 Uther matches.
The unchanged issue gate is 40–60% against the original seeded field.

Source: abcf45a4f6db2c636dc66372bc8c7a80b27bd974.
Run: https://github.com/tompassarelli/smashcraft/actions/runs/37675071322 .
Command: `bun wisp farm balance --ref abcf45a4f6db2c636dc66372bc8c7a80b27bd974 --wait`.

The original 13 fighters ran Wren Expert, 100 seeds and the existing spawn
variants, requesting at least 400 matches per pair. The unchanged sampler
produced 408 per pair: 78 pairs and 31,824 matches. The final artifact is
`balance-field`; its field.json and field.md are retained locally in
ts/build/uther216-forsaken-field. The run took 27 minutes 13 seconds through
the verdict, including the hosted runner queue.

The complete-field workflow reports failure because Archer is just below
its boundary: 1,958 / 4,896 = 39.9918301%. All other fighters pass. That
separate roster result does not change Uther's stated 40–60% check; it was
reported to the parent and balance owner without changing another fighter.

## Whole-kit use in the field

| Special | Starts |
| --- | ---: |
| Cleansing Hammer | 25,800 |
| Righteous Fury | 70,491 |
| Ascension | 15,518 |
| Consecration | 7,906 |

No special presses were refused for mana. Exact Uther counts, matchup
results and move-use data are in field-result.json.

The old Human Paladin result, 47.6875%, remains historical. This new result
measures the revised Forsaken kit. Later replay identity, documentation,
pad and model-family changes do not alter its gameplay values or regions.
