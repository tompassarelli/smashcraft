# Hurt volumes over drawn poses, 6 Oct 2026

Command, from smashcraft:ts/ on the lane based at a3b9fc91 plus the authored poses
committed with this record:

    bun wisp view hurtboxes --assets ~/.local/share/smashcraft-build-inputs/stage-model-20261006/assets \
      --out ~/.local/share/smashcraft-build-inputs/hurtbox-captures-20261006

Models: the 0.0.49 build inputs (ArcherFighter, RiflemanFighter,
DemonHunterFighter). The 21 PNG sheets stay with the private inputs because
they trace proprietary models; coverage.txt holds every frame's numbers: 489
frames over Archer, Rifleman and Illidan's stand/crouch bodies and jab, down
tilt, forward smash, forward air and down air, facing right, plus each move's
first active frame facing left.

Result: the volumes cover 49-98% of the drawn body on active frames (standing:
82%, 81%, 71%); the uncovered remainder is held weapons and loose cloth. The
mirrored sheets place every volume and strike on the facing side.
