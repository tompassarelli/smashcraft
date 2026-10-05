# Smashcraft 0.0.43: Linux start guide

This is a private candidate. The preserved 0.0.41 and 0.0.42 maps remain separate.
Use this map and its matching helper together:

- Map: ~/.local/share/smashcraft-build-inputs/native-delivery-20261005/playable-0043/Smashcraft 0.0.43.w3x
- Helper: ~/.local/share/smashcraft-build-inputs/native-delivery-20261005/playable-0043/wc3-journal-0.0.43

Put the map in each player's Warcraft III `Maps/00-Smashcraft` folder. Join the
same custom game and start it. At fighter selection, start one helper for each
human player with that player's controller, Warcraft window and data folder.
Keep it running through the match, results and rematches. After leaving or
reloading the map, stop the helper and start it again at fighter selection.

For a private desktop, the helper command is:

```sh
~/.local/share/smashcraft-build-inputs/native-delivery-20261005/playable-0043/wc3-journal-0.0.43 \
  --follow-matches --build playable-0043 --slot 0 \
  --device /dev/input/eventN --out '/absolute/Warcraft III/CustomMapData' \
  --editbox-display :N --x11-window DECIMAL_XID --pid GAME_PID \
  --private-wlr-app-id GAME_APP_ID
```

Use the actual values from the running client and its controller. Player 1 is
slot 0; Player 2 is slot 1. For the normal desktop, use `--niri-window WINDOW_ID`
instead of `--private-wlr-app-id`. Stop any older keyboard mapper first. Focus
Warcraft and release all controls before playing, after changing menus, and
after reconnecting a controller. Reconnecting the same controller is supported;
a different device or USB identity needs a fresh helper.

| Screen | Controls |
| --- | --- |
| Fighter selection | Stick: choose; A: select; X: recall; Start: continue |
| Stage selection | Stick: choose; X: back; A or Start: begin |
| Fight | Stick: move; A: attack; X: special; B/Y or stick-up: jump; RB: grab; LB: walk; either trigger: shield |
| Pause/results | Start: pause/resume; A or Start at results: rematch |

Developer build command: `bun wisp build --profile playable` with the normal
private map inputs. This profile uses the same combat and controller path as
the native four-fighter acceptance map, with build ID `playable-0043` and the
developer display and response recording disabled. Rebuilding uses
`bun wisp rebuild /absolute/candidate.w3x --profile playable`.
