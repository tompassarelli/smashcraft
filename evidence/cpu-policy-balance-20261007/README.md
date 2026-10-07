# CPU policy comparison, 7 October 2026

Observed fields: [0484f7f6](https://github.com/tompassarelli/smashcraft/actions/runs/37574176060) passed all 13 fighters; [bdcf238c](https://github.com/tompassarelli/smashcraft/actions/runs/37583258069) failed Archer 34.56%, Rifleman 75.02%, Mountain King 21.75%, Warden 36.50%, Dreadlord 73.08%. Both played 31,200 matches, 400 per pair at level 9. The comparison aggregates each fighter’s starts and hits from those saved artifacts; the intervening changes include both kit-choice repair 6d84979c and delayed perception bdcf238c.

Rifleman’s neutral-special starts rose from 134,006 to 176,198. Mountain King’s down-tilt starts fell from 52,019 to 33,944; hits per 100 move starts fell from 49.8 to 45.0. Archer’s hits per 100 starts fell from 58.6 to 51.9. These aggregates identify policy changes to investigate; they do not isolate one cause of the full field result.

A separate direct counterexample isolates stale projectile defense: a shot last seen at x=500 with velocity -36, aged 12 frames, should be predicted at x=68. The old chooser declines all ten shot serials at the stale position but answers nine at x=68. The repair advances only the delayed visible shot’s position and lifetime; it reads no newer opponent sample. Two regression contracts compare that forecast with a current-position reference and reject expired/passed shots.

The original difficulty report [37583334078](https://github.com/tompassarelli/smashcraft/actions/runs/37583334078) played 20 matches per level pair and 100 for level 9 vs 1: tier ordering failed at L7 77% versus L8 76%; L9 vs L1 passed 100/100. No fighter damage, level thresholds or reaction-delay gates changed in this repair.
