# Play current Smashcraft

From ~/code/smashcraft/main/ts, run `bun wisp play`. It builds current main,
points the always-on controller service at the matching helper, and hosts a match on Tom's main display
against a computer. It reuses the signed-in Battle.net launcher and never signs
in, logs out or switches accounts.

Maps/00-Smashcraft holds the newest version, `Smashcraft 0.0.N`, the two
versions before it, older/, and tests/. Each new build of main takes the next
number after every version already built or in the folder; rebuilding the same
commit keeps its number. The file and in-game title carry the same name. A
one-off build is named after the version it tests, `Smashcraft 0.0.N test K`,
and lives in tests/. Experimental builds use `wisp fresh`, captures or `wisp accept` and
install under tests/; they do not change what `play` launches.

The private inputs are declared in
~/.local/share/smashcraft-build-inputs/play-inputs.json: base map, container,
assets and summon clips. Map builds check every imported file against the
script and archive. Build outputs and proprietary assets stay outside source
trees; dependency installation and compilation happen in a dedicated worktree.
The controller helper is cached by its companion source tree, so gameplay edits
do not recompile an unchanged helper. A new source revision builds a new map;
repeated runs reuse its map and helper.

## Controller without play

The controller service (`wc3-journal --service`, smashcraft:companion/README.md)
runs from Tom's login as the systemd user unit smashcraft-controller.service,
declared in nixos-config. It runs the launcher
~/.local/share/smashcraft-build-inputs/controller/wc3-journal, a link to a
helper under play-helpers/. It finds Warcraft III on :0 by itself, follows any
Smashcraft session (one Tom opens from Custom Games included, and a reopened
map) and survives Warcraft restarts and pad replugs. `play` and
`bun wisp controller` point the link at main's helper and restart the unit
when it changed; without the unit, `bun wisp controller` runs the service in
the foreground. Its state is in ~/.local/state/smashcraft/controller-service.txt;
its log is `journalctl --user -u smashcraft-controller`.
