# Tomb of Sargeras waterfall placement (#193)

Headless renders (`bun wisp headless --journey ... --render`) of stage 7 with
`-dev view near` (frame 160) and `-dev view far` (frame 260), before and after.

- Before (main 15f530d4): the waterfall (x -2200, y 4800, z -900, scale 4)
  sat behind the left ledge and left side platform at the near extreme, and
  its flat-cut pool floated below the deck at the far extreme (checklist B,
  rule 5).
- After (x -1500, y 5600, z -450, scale 3.5): at both extremes it stands
  between the left ledge and centre, clear of the side platform's end, with
  its pool hidden behind the deck body; fighters in front of it stay readable.
- Tests: stageScenery + stagePalette game tests 5/5, player-view 22/22,
  home-stages 1/1, stage-render 2/2.
- The headless renderer draws no sky or fog, so checklist A and fog softening
  (D) are left to the native stage batch. The Temple of Tides (y 6400) is not
  drawn at either extreme: it lies beyond the far clip.

Renders are retained privately under
`~/.local/share/smashcraft-build-inputs/water193-20261008/`, not committed
(stock Warcraft art).
