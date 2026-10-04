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

| Supplied input sequence | Original observed result | Production rule |
| --- | --- | --- |
| Existing input age 10, three frozen input frames, one unfrozen frame | Age 11, 12, 13, then 14 | Current press age advances on every input frame, including hitlag |
| Press on first of three frozen frames, hold through release | First prior-press interval 255, then 0; ineligible on release | Repeated accumulated frozen presses update the prior age; this press is ineligible after release |
| Press on last frozen frame, then hold on unfrozen frame | Age 0 then 1, prior interval 255; eligible, with 19 remaining contact frames | The derived contact window is 19 on release |
| Press on first unfrozen frame | Age 0, prior interval 255; eligible | The derived contact window is 20 |
| Press, release, second press 40 input ticks later | Stored prior age 39; ineligible | The derived window is 0 |
| Press, release, second press 41 input ticks later | Stored prior age 40; eligible | The derived window is 20 |

The scalar gate's common-data minimum is 40, but it reads the previous age
before resetting the counter. Consequently the minimum elapsed input-tick gap
between these digital presses is 41. A common-value match alone does not prove
that a countdown uses the correct frame convention.

Production stores the current press age, the prior press interval recorded on a
new edge, and whether a press edge is accumulated during hitlag. It advances
this input state after decrementing hitlag and before fighter-state early
returns. The contact window is derived from the current age and prior interval,
rather than a countdown paused by hitlag. Reset, stock loss, replay copy, replay
comparison, and replay checksum include the exact state.

Production checks: `SimulationTests` passed 203/203 and `ReplayStateTests`
passed 11/11 on the combined four-player source tree. These deterministic tests
verify the recorded boundaries and replay state. They do not establish a
complete original match trajectory or native Warcraft callback behavior.

Original executable and extracted common-data files, including the runner's
original-containing ELF, remain private outside repositories. The public record
contains authored tooling, numerical inputs/results, hashes and limitations.
