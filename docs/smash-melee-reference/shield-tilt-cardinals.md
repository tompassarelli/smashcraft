# Shield tilt cardinal reference

Smashcraft uses Mario's four primary cardinal shield-centre displacements from
the existing NTSC 1.02 numerical reference, scaled by each authored shield's
radius. The pinned [Mario measurements](https://github.com/technospider-ssbm/melee-shield-tilt/blob/e8c05c2a0ed3419c1f461d0a5cb11728d01aa3b1/data/Mr.csv)
give neutral centre (1.375, 7.168952), radius 6.799376, and primary full-stick
offsets up 4.400041, down −3.6297448, forward 2.75 and backward −3.3000001.
These are numerical facts; no source code, animation or model data was copied.
The reference has no established source-code license, as recorded in
ntsc-common-shield-values.json.

Melee derives character-specific movement from its Guard animation, using
stick angle and magnitude in [ftCo_80091BC4 and ftCo_80091E78](https://github.com/doldecomp/melee/blob/0296f009f32f710495979d30772d8332af2d411a/src/melee/ft/kinds/ftCommon/ftCo_Guard.c).
Smashcraft independently applies the measured cardinal displacements to its
existing bubble; it shares that centre between drawing and melee, projectile
and special contact. Forward and backward reach follow facing.

Tilt while shielding caps each effective axis at 0.6500. Melee's spot-dodge and
roll thresholds are 0.7 at common +0x314/+0x31C (ftCo_Escape.c), and tap jump is
0.6625 (ftCo_800DF910). The existing modifier's full cardinal push therefore
gives the largest permitted tilt without a stick escape. Without the modifier,
full directional pushes retain those escapes. Button jumps remain independent.
