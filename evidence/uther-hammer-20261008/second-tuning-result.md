# Uther second tuning result

The second tuning is `a8711af9`, published at
`e4fa813953fedb41e7193d995875f252282584ac`.

`bun wisp farm balance --ref e4fa813953fedb41e7193d995875f252282584ac --wait`
ran [37660886012](https://github.com/tompassarelli/smashcraft/actions/runs/37660886012).
The original field completed 31,200 matches in 5 minutes 51 seconds.

Uther won **3571/4800 = 74.3958%**. Every other fighter passed 40–60%.
Holy Radiance fell from 35% to 16% of Uther's starts; down tilt was 20%,
forward tilt 12%, neutral special 9% and forward smash 9%. Damage per hit
was 10.63 and mana spent per stock was 197. The unchanged farm report is
`field-r3.md`.

Seven focused Bun checks and 23 emitted-Lua32 contracts pass, including
all-four-special CPU coverage. Type-check and source-shape push checks pass.

This is the second failed balance adjustment. Further tuning stops under
AGENTS.md's two-failed-fixes rule. The recommendation sent to the lead agent
is a Uther-only 15% damage reduction across attacks and specials, preserving
motion, hit geometry and the stronger impact feedback, followed by the same
original field; estimated 15 minutes. No such reduction is implemented in
this trial.

The readable-impact check waits on #211's white-body material correction.
Tom's fun verdict is also outstanding.
