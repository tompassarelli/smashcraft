# Language-model playtest through the text match

[Docs index](../README.md)

`bun wisp headless text-match` ([headless](../commands/headless.md)) plays one seeded match in the pure simulation and prints it as text: fighter A is driven by input lines, fighter B by a computer at a chosen level. This page records what a language model playing through it is good for, what it costs, and the decision on running it every night (#407).

## What the trial showed

- A model reading the text view can play: it reads positions, percents, states, ledge distance and the active hitboxes in reach, and writes `FRAME WORD...` input lines. Because the whole input is read before the match starts, a turn is a re-run of the match with the file grown by the latest lines; determinism makes the earlier frames identical.
- The four-frame input delay and the one-line-per-frame view make reaction play (shield a move seen at frame F with an input stated at F-4) possible but slow: each reaction is a separate run and a few thousand tokens of output.
- The findings that were concrete and reproducible came from structured experiments written as small input files and scripts over the same text (an idle fighter against every computer fighter, a shield held against every computer fighter, one move spammed on a period), not from the model's reading of individual frames. Reading frames was needed to explain a finding, such as seeing that a fighter in shield state took damage on the next frame.
- The view hides some state a player would need: shield release lag reads as `idle`, and a tech and a missed tech both read as `down` until the same frame. A model that plays from the text cannot tell why an input was dropped.

## Cost

A match costs about 2.5 s of wall time (nearly all of it process start-up and the one-second match) whether it runs 1,800 or 14,400 frames. The text is about 105 bytes a frame: a 3,500-frame match is about 370 KB per frame (roughly 100k tokens) and about 60 KB at one line in six (roughly 17k tokens). The model's own cost is the cost that matters: playing one match turn by turn, with a window of 100 to 300 frames per turn at one line in three, took about 20k tokens a match, and the scripted experiments cost nothing in tokens once written. The measured numbers are in the issue.

## Decision

Drop the nightly language-model playtest; keep the command and keep the experiments that found things.

- A nightly run would spend tens of thousands of tokens per match to rediscover what the scripted experiments reproduce for nothing, and a model reading the text found fewer defects per token than a fixed script over the same text.
- The experiments are deterministic, so they belong with the computer-opponent checks the farm already runs: an idle fighter against every computer fighter (a stuck or passive state shows as a long run of one state with no damage), a shield held against every computer fighter (damage taken while the shield is up), and one move repeated on a fixed period (a computer that re-enters the same hitbox).
- A model playtest stays worth running by hand when a new fighter or a computer change needs a fresh read, with the output thinned to one line in six and a window around the moment under study.
- Revisit this if the view gains the missing state (release lag, tech) and a model's own play starts finding defects the scripts do not.
