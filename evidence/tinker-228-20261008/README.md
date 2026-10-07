# Tinker candidate gameplay and computer trial

Candidate source: `d3d6c751`, based on main `267eb68c`; Tinker remains
`complete: false` until its shared private clip pool and assembled map pass.

The production `fighterCoverage` ran its unchanged eight seeded Wren Expert
matches, 1,800 frames each, with Tinker appended to an explicit candidate
roster. `coverage.json` is its unedited result: 32 neutral, 17 side, 5 up and
51 down special starts; 87 attacks, 8,134 moving frames, no mana refusals and
no missing coverage. Both recovery decision probes returned the fighter
inward. The every-special assertions are part of the existing roster AI
contract when the fighter becomes selectable.

A cold isolated Bun test timed out at the existing 5-second limit (12.215 s
with default JSC settings, 6.492 s with the repository's test-worker settings).
The direct helper then completed with the same eight-match workload and
reported all four special counts. No timeout or match count was changed.

The 25 initial gameplay contracts passed in Bun and emitted 32-bit Lua;
a further one-hit Robo-Goblin armor contract passed in Bun. All 17 normal
attacks and four throws resolve actual contacts in both facings; specials
exercise mana, projectile spawning, factory recall, recovery and saved state.
The armor trial takes damage without flinching on the first light hit, then
is interrupted by the second hit. Six shared special-cue checks pass.

Private art: 23 preserved classic sequences plus 75 authored actions, 98
sequences total. The robot is shown on frames 8–23 of down special; nine
pain poses and four victim throw directions are distinct. Tinker's measured
walk/run stride is 142.838 units/second. The final upward claw silhouette
was inspected in both facings. Proprietary model and images remain in
`~/.local/share/smashcraft-build-inputs/tinker228-art/authored/`.

The original full seeded balance field and Tom's fun verdict are still
pending. This trial is not a balance-field result.
