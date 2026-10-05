# Smashcraft 0.0.42: Linux controller startup

Install the map in each player's Warcraft `Maps/00-Smashcraft` folder:
~/.local/share/smashcraft-build-inputs/input-integrity-delivery-20261005/build/Smashcraft 0.0.42.w3x

Use the matching helper:
~/.local/share/smashcraft-build-inputs/input-integrity-delivery-20261005/build/wc3-journal-0.0.42

Open Warcraft through **Play** in the signed-in Battle.net launcher. Join the
same online Custom Game and stop at Smashcraft's initial fighter selection.
Start one helper per human before selecting fighters. Player 1 uses `--slot 0`,
Player 2 uses `--slot 1`; use the actual player slot when there are empty slots.

## Find the controller and game

Run `cat /proc/bus/input/devices`. In the Xbox controller's block, take the
`eventN` entry from `Handlers` and use `/dev/input/eventN` as the device.

In a terminal on the game's desktop, obtain its X11 window and process ID:

```sh
nix shell nixpkgs#xdotool --command xdotool search --name '^Warcraft III$'
nix shell nixpkgs#xdotool --command xdotool getwindowpid DECIMAL_XID
```

For the normal Niri desktop, run `niri msg --json windows` and take the `id`
of the Warcraft window. Start the helper from that desktop's terminal:

```sh
~/.local/share/smashcraft-build-inputs/input-integrity-delivery-20261005/build/wc3-journal-0.0.42 \
  --follow-matches --build playable-0042 --slot 0 \
  --device /dev/input/eventN --out '/absolute/Warcraft III/CustomMapData' \
  --editbox-display "$DISPLAY" --x11-window DECIMAL_XID --pid GAME_PID \
  --niri-window WINDOW_ID
```

The data directory is the `CustomMapData` folder belonging to that client's
Warcraft installation. For Tom's Steam client A it is
~/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData.
Client B uses
~/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData.

For an engineering private desktop, use its launcher's reported run directory.
Read `display`, `xauthority` and `wayland-display` from that directory; apply
them to the discovery commands above as well as the helper. Replace
`--niri-window WINDOW_ID` with `--private-wlr-app-id GAME_APP_ID`:

```sh
private_run=/absolute/private-desktop-run
private_display=$(cat "$private_run/display")
private_xauthority=$(cat "$private_run/xauthority")
private_wayland=$(cat "$private_run/wayland-display")
env XDG_RUNTIME_DIR="$private_run/runtime" WAYLAND_DISPLAY="$private_wayland" \
  DISPLAY="$private_display" XAUTHORITY="$private_xauthority" \
  ~/.local/share/smashcraft-build-inputs/input-integrity-delivery-20261005/build/wc3-journal-0.0.42 \
  --follow-matches --build playable-0042 --slot 0 \
  --device /dev/input/eventN --out '/absolute/Warcraft III/CustomMapData' \
  --editbox-display "$private_display" --x11-window DECIMAL_XID --pid GAME_PID \
  --private-wlr-app-id GAME_APP_ID
```

Keep the helper running through results and rematches. Focus Warcraft and release
held controls to neutral after a focus change, pause or controller reconnect.
After leaving and reloading the map, stop the helper with Ctrl+C and start it
again at initial fighter selection. Do not run a keyboard mapper alongside it.

## Controls

| Place | Controls |
|---|---|
| Fighter selection | Stick: choose; A: select; X: recall; Start: continue |
| Stage selection | Stick: choose; X: back; A or Start: begin |
| Fight | Stick: move; A: attack; X: special; B/Y or stick-up: jump; RB: grab; LB: walk; either trigger: shield |
| Pause / results | Start: pause/resume; A or Start at results: rematch |

Stick and trigger input is digital. The current measured acceptance results
belong to GitHub issues #26, #17 and #18.
