# Play current Smashcraft

`bun wisp play --standalone` opens Smashcraft in the Wisp browser player,
with Illidan against a Wren Expert Rifleman over the normal three stocks and
seven-minute clock. Keyboard controls and the browser's gamepad controls enter
the playable map's keyboard sampling. The browser draws the map's models,
camera, effects and HUD from the headless client and plays its sound cues.

`bun wisp play --standalone --script test/native/pads/cpu-expert.pad --headless
--frames 1070 --out build/standalone-cpu --capture-frames 200,600,1000` runs
the existing native pad driver and saves each frame's checksum plus captures.
`cpu-expert.pad` is the original `cpu-level-9.pad`: commit `c0424f66` renamed
it, and `775bf730` changed its setup to `-dev quick cpu wren expert`. Every
authored pad input and its frame through 1070 stayed the same; `c2ad9697`
updated the expected damage after the CPU changes. This is the CPU fixture for
standalone/native comparisons. Map assets are read from the existing private
inputs, with stock assets cached outside the repository.

`bun wisp play --standalone --four-fighters --frames 7200 --out DIR` is
wisp#48's frame-rate measurement. It runs one game copy, as live play does:
Illidan on the bot beat's keys against computer Rifleman, Illidan and Warden,
99 stocks and a two-minute clock, so four fighters stay on stage. It prints
the frame timing summary (the target is a p95 frame time of at most 16.7 ms);
`DIR/standalone.json` keeps every frame's timing. Add `--headless` to run it
without a window. Run it under an exclusive capacity lease.

Add `--presentation native|pool-confirmed|pool-predicted` to select the map's
fighter presentation. Live play defaults to `pool-predicted`; scripted play
defaults to `native` and keeps the same authored pad driver in every profile.
Capture requests name logical match frames. Scene JSON also records the raw
headless callback frame, which includes the 30 startup callbacks.

From ~/code/smashcraft/main/ts, run `bun wisp play`. It builds current main,
points the always-on controller service at the matching helper, and hosts a match on Tom's main display
against a computer. The match plays on the keyboard; a pad the service finds
presses the same keys, and without one play says "keyboard" and goes on. It reuses the signed-in Battle.net launcher and never signs
in, logs out or switches accounts.

Maps/00-Smashcraft holds the newest version, `Smashcraft 0.0.N`, the two
versions before it, older/, and tests/. Each new build of main takes the next
number after every version already built or in the folder; rebuilding the same
commit keeps its number. The file and in-game title carry the same name; a build installed by
`bun wisp play --install-green` adds its short commit, `Smashcraft 0.0.N abc1234`
(smashcraft:docs/commands/play.md). A
one-off build is named after the version it tests, `Smashcraft 0.0.N test K`,
and lives in tests/. Experimental builds use `wisp fresh`, captures or `wisp accept` and
install under tests/; they do not change what `play` launches.

Main's smashcraft:build-inputs/ names the private inputs: base map,
container, assets and summon clips, each by the hash of its contents in the
store (smashcraft:docs/build-inputs.md). Map builds check every input against
its hash and every imported file against the script and archive. Build outputs
and proprietary assets stay outside source trees; dependency installation and
compilation happen in the revision's own worktree, under the revision's lock,
so plays started together build one map and share it. The controller helper is
optional and cached by its controller source tree (smashcraft:controller); a failed helper build leaves
the keyboard and never blocks the map. A new source revision builds a new map;
repeated runs reuse its map and helper.

Helper compilation uses one Cargo target directory at
`~/.local/share/smashcraft-build-inputs/play-helper-target`, shared across
temporary play-build worktrees. Cargo locks its build output; the play launcher
also holds a lock through copying the finished binaries into the controller
source tree's `play-helpers/` directory, so concurrent revisions deliver their
own helper. On 8 October 2026 the old fresh-worktree build took 4m46s;
the first shared-cache fill took 4m32s and a second worktree reused it in
0.15s of Cargo time (2.147s including Nix and capacity setup).

## The desktop client

Players use [smashcraft-client](https://github.com/tompassarelli/smashcraft-client):
its release bundles the controller service, and its Play launches the current
map in Maps/00-Smashcraft ([client interface](client-interface.md)). It needs no
checkout of this repository.

## Controller without play

The controller service ([wc3-controller](https://github.com/tompassarelli/wc3-controller)
with Smashcraft's plug-in, smashcraft:controller/README.md) runs from Tom's
login as the systemd user unit wc3-controller.service, declared in
nixos-config. It runs the launcher ~/.local/share/wc3-controller/bin/wc3-controller
`--service --plugin` ~/.local/share/smashcraft-build-inputs/controller/wc3-journal;
both are links to the pinned service and the plug-in built together under
play-helpers/. It finds Warcraft III on :0 by itself, follows any
Smashcraft session (one Tom opens from Custom Games included, and a reopened
map) and survives Warcraft restarts and pad replugs. `play` and
`bun wisp controller` point the links at main's build and restart the unit
when it changed; without the unit, `bun wisp controller` runs the service in
the foreground. Its state is in ~/.local/state/wc3-controller/service.txt;
its log is `journalctl --user -u wc3-controller`.

Controller layouts: `bun wisp controller layout melee|z-jump|tom`. melee (the default) is Melee's buttons by function: A attack, B special, X and Y jump, RB grab, no tilt or short-hop button; z-jump makes RB jump and X grab; tom is Tom's own (RT tilt, L3 short hop, LB jump). Both triggers shield by default. The client Controller page also chooses the layout, tap jump and full or light shield for each trigger. These choices stay in the controller service settings across restarts. A running service changes immediately; a stopped service reads the saved choice at its next start.
