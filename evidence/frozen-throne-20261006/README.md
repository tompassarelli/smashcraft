# Frozen Throne stage trial — 6 October 2026

The stage is selectable as stage 2: a 1,200-unit main deck, two side platforms
at Battlefield's 27.2 height and one top platform at 54.4, heights scaled by
6 world units per Melee unit. The authored snow and stage-selection tile are
packaged; sky and Icecrown scenery reference classic Warcraft models by path.
No extracted game assets belong to this checkout.

The player-view checks passed the selectable winter match's scene, all four
decks, scenery and snow behind the fighting volume, and fog starting beyond
it in all 225 declared 16:9 camera framings. `bun wisp headless frozen-throne`
ran 600 frames in two clients with equal checksums, no desync, no error report,
clean scene reports and a successful mid-match hot reload. The full logic
suite and all 718 emitted Lua32 tests passed; their raw outputs are alongside
this record.

The 200-match winter soak exercised 176,021 frames (50.2 game minutes), all
ordered fighter pairs with fuzzed, computer and absent-helper policies:
no desync, runtime error or player-view finding. It reported three catch-up
findings in two matches; this is not a passing soak. Both executable repros
and their replay outputs are retained here. Match 46's identical saved inputs
also produced its two findings on existing Sky Deck, at the exact same frames
1221 and 1260 with 104 frames queued. That comparison changed only the stage
name in a private copy of the saved input file; checksums naturally differ.
These findings belong to the existing lag-recovery work (#48), rather than
winter scenery or platform collision. No detector or gate was weakened.

Private build:
`~/.local/share/smashcraft-build-inputs/northrend-stage-20261006/Smashcraft diagnostic frozen-throne.w3x`.
The build verified 307 archive entries against their sources. Load using
`bun wisp fresh MAP --no-quick` from smashcraft:ts/, then type
`-dev quick frozen-throne` on the host. Regular `-dev quick` starts Sky Deck.
The numbered playable artifact and native capture remain with the parent.

Replay either original finding from smashcraft:ts/:
`bun wisp soak --repro ../evidence/frozen-throne-20261006/match-46.json`
(or match-87.json). The sky's pixel check and subjective snow visibility need
the native capture; headless reach bounds do not measure those pixels.
