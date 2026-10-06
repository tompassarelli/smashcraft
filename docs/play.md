# Play current Smashcraft

From ~/code/smashcraft/main/ts, run `bun wisp play`. It builds current main,
starts the matching controller helper, and hosts a match on Tom's main display
against a computer. It reuses the signed-in Battle.net launcher and never signs
in, logs out or switches accounts.

Maps/00-Smashcraft holds `Smashcraft latest <sha>`, the two previous playable
versions, older/, and tests/. The file and in-game title use the same source
revision. Experimental builds use `wisp fresh`, captures or `wisp accept` and
install under tests/; they do not change what `play` launches.

The private inputs are declared in
~/.local/share/smashcraft-build-inputs/play-inputs.json: base map, container,
assets and summon clips. Map builds check every imported file against the
script and archive. Build outputs and proprietary assets stay outside source
trees; dependency installation and compilation happen in a dedicated worktree.
The controller helper is cached by its companion source tree, so gameplay edits
do not recompile an unchanged helper. A new source revision builds a new map;
repeated runs reuse its map and helper.
