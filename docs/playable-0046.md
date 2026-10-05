# Smashcraft 0.0.46: Linux start guide

This is a private candidate. The preserved 0.0.41 and 0.0.42 maps remain separate.
Use this map and its matching helper together:

- Map: ~/.local/share/smashcraft-build-inputs/playable-0046/Smashcraft 0.0.46.w3x
- Helper: ~/.local/share/smashcraft-build-inputs/playable-0046/wc3-journal-0.0.46

Put the map in each player's Warcraft III `Maps/00-Smashcraft` folder. Join the
same custom game and start it. At fighter selection, start one helper for each
human player with that player's controller, Warcraft window and data folder.
Keep it running through the match, results and rematches. After leaving or
reloading the map, stop the helper and start it again at fighter selection.

For a private desktop, the helper command is:

```sh
~/.local/share/smashcraft-build-inputs/playable-0046/wc3-journal-0.0.46 \
  --follow-matches --build playable-0046 --slot 0 \
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

The stage screen's stock and time settings use the mouse.

## Developer build

The profile shares the native four-fighter acceptance map's combat and
controller path, with build ID `playable-0046`. The `-dev` chat commands,
hot reload, response recording and the developer status line are off; players
see no build names or developer text. The helper is the unchanged 0.0.43
binary, renamed; copying it also creates the candidate's folder, which the
map build needs. Built from ts/ with the private inputs:

```sh
install -D -m 700 ~/.local/share/smashcraft-build-inputs/playable-0045/wc3-journal-0.0.45 \
  ~/.local/share/smashcraft-build-inputs/playable-0046/wc3-journal-0.0.46
bun wisp build --profile playable --base ~/.local/share/smashcraft-build-inputs/physics-base.w3m \
  --container ~/.local/share/smashcraft-build-inputs/native-delivery-20261005/'Smashcraft diagnostic four-fighters.w3x' \
  --assets ~/.local/share/smashcraft-build-inputs/build-port-20261005 \
  --summon ~/.local/share/smashcraft-build-inputs/build-port-20261005/summon-original-clips \
  --name "Smashcraft 0.0.46" --out ~/.local/share/smashcraft-build-inputs/playable-0046/'Smashcraft 0.0.46.w3x'
```

`--build` names the map's build.

To check a candidate on the two engineering clients, run
`bun wisp fresh MAP.w3x --no-quick` to stop at fighter selection, then
`bun wisp playable capture --helper HELPER --build playable-0046 --out DIR --app-id a=APP_ID --app-id b=APP_ID`
and `bun wisp playable result DIR`.

The result gate takes each match's winner from the end receipts both clients
write (`smashcraft-journal-end-BUILD-eN-sS.txt`, `winner=P1` to `P4` or
`none`, from 0.0.46). It also reads each client's result announcement on its
own; a screen that names another player fails the gate, a screen the reader
cannot make out does not. The reader's "|", "l" or "I" in "Player 1 wins!"
counts as 1. A capture whose receipts name no winner, such as 0.0.45's, takes
the winner from the screens, which must both name it.
