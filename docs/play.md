# Play current Smashcraft

From ~/code/smashcraft/main/ts, run `bun wisp play`. It builds current main,
points the always-on controller service at the matching helper, and hosts a match on Tom's main display
against a computer. The match plays on the keyboard; a pad the service finds
presses the same keys, and without one play says "keyboard" and goes on. It reuses the signed-in Battle.net launcher and never signs
in, logs out or switches accounts.

Maps/00-Smashcraft holds the newest version, `Smashcraft 0.0.N`, the two
versions before it, older/, and tests/. Each new build of main takes the next
number after every version already built or in the folder; rebuilding the same
commit keeps its number. The file and in-game title carry the same name. A
one-off build is named after the version it tests, `Smashcraft 0.0.N test K`,
and lives in tests/. Experimental builds use `wisp fresh`, captures or `wisp accept` and
install under tests/; they do not change what `play` launches.

Main's smashcraft:build-inputs.json names the private inputs: base map,
container, assets and summon clips, each by the hash of its contents in the
store (smashcraft:docs/build-inputs.md). Map builds check every input against
its hash and every imported file against the script and archive. Build outputs
and proprietary assets stay outside source trees; dependency installation and
compilation happen in the revision's own worktree, under the revision's lock,
so plays started together build one map and share it. The controller helper is
optional and cached by its companion source tree; a failed helper build leaves
the keyboard and never blocks the map. A new source revision builds a new map;
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
