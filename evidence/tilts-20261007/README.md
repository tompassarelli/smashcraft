# Ground normals before the tilt and dash-attack pass (7 Oct 2026)

`audit-before.tsv` is the production jab, forward tilt (plain, up `^`, down
`v`), up tilt, down tilt, neutral and forward air and dash attack of every
fighter on main fcf7a9e7. It was read from the production timing and hit-region
functions (`attackStartupFrames`, `characterAttackActiveFrames`,
`attackDurationFramesForGrounding`, `authoredHitRegion`) at charge 0.

Columns:
- fighter and move;
- first and last active frames (1-based), first active frame, active frames,
  total and ending lag;
- forward reach and vertical extent in H (131.8 units);
- the strongest region's damage, launch angle and growth/base.

Rows with frame 0 are moves the fighter does not have; the original
fighters' dashing jab is a jab.
