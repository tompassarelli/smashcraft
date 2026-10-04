# Retail tech input timing

Numerical observations: smashcraft:docs/smash-melee-reference/retail-tech-input-driver.json
and smashcraft:docs/smash-melee-reference/retail-tech-hitlag-input.json.
Authored loaders: smashcraft:tools/physics-probe/observe-tech-input-driver.mjs
and smashcraft:tools/physics-probe/observe-tech-hitlag.mjs.

The revision-identified NTSC 1.02 input driver at 0x8006AD10 and tech gate at
0x800986B0 execute under QEMU PPC750 with synthetic fighter state and controller
buttons. Input-age, prior-press-age and edge-accumulation instructions execute
unchanged. CPU/game-mode queries and unrelated post-input callbacks return
zero; the exact stub addresses are retained in the numerical record. Frozen
flags and initial counters are supplied. Hitlag flag transitions, collision
and recovery action entry are outside that input-only observation.

The second runner additionally executes original Fighter_procHitlag at
0x8006A1BC before original Fighter_procInput, matching their registered callback
priorities 0 and 3. Starting from four hitlag frames, original code produces
remaining counts 3, 2, 1, 0 and clears the frozen flag on the zero frame.
Twenty observed input ticks across five sequences match those phases. These
freeze flags are produced by original code rather than supplied each tick.
Unrelated mushroom/shield timer helpers return zero; linked fighters and
per-fighter callbacks are absent. Full animation, collision and recovery action
execution remain outside this observation.

| Supplied input sequence | Original observed result | Current production discrepancy |
| --- | --- | --- |
| Existing input age 10, three frozen input frames, one unfrozen frame | Age 11, 12, 13, then 14 | Production pauses the window during frozen frames |
| Press on first of three frozen frames, hold through release | First prior-press interval 255, then 0; ineligible on release | Production gives the early press one post-freeze opportunity |
| Press on last frozen frame, then hold on unfrozen frame | Age 0 then 1, prior interval 255; eligible, with 19 remaining contact frames | Production gives this early-countdown press only one post-freeze opportunity |
| Press on first unfrozen frame | Age 0, prior interval 255; eligible | Normal fresh-press window remains 20 contact frames |
| Press, release, second press 40 input ticks later | Stored prior age 39; ineligible | Production currently accepts this second press |
| Press, release, second press 41 input ticks later | Stored prior age 40; eligible | Required repeat-press boundary |

The scalar gate's common-data minimum is 40, but it reads the previous age
before resetting the counter. Consequently the minimum elapsed input-tick gap
between these digital presses is 41. A common-value match alone does not prove
that a countdown uses the correct frame convention.

These results identify production corrections still required after the shared
input/physics-tree integration. They do not establish a complete original
match trajectory or native Warcraft timing. Existing implementation tests that
assert paused aging or the 40-tick repeat convention must be replaced with the
observed behavior as part of the owning correction; passing them cannot certify
retail parity.

Original executable and extracted common-data files, including the runner's
original-containing ELF, remain private outside repositories. The public record
contains authored tooling, numerical inputs/results, hashes and limitations.
