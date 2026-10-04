# Playable Linux controller checkpoint: Smashcraft 0.0.41

This checkpoint uses the persistent Linux controller helper for fighter/stage
selection, gameplay, pause, results and rematch. It follows playable 0.0.40.
The former numbered 41–59 experiments remain archived by their diagnostic build
IDs; they were not player releases. Future diagnostics use separate names.

## Files and startup

Map:
~/.local/share/smashcraft-build-inputs/playable-integration-20261005/build/Smashcraft 0.0.41.w3x

Current matching executable (controller reconnect repair):
~/.local/share/smashcraft-build-inputs/playable-integration-20261005/build/wc3-journal-0.0.41-reconnect

The map is installed in both retained clients' `Maps/00-Smashcraft` folders.
Open a fresh match and start one helper per human player **at the initial fighter
selection screen**, before selecting/start. Use the matching Warcraft data
directory, controller device, player slot, game PID and focused window. The
helper stays running through results and rematches. After reconnecting the same
controller, release its controls to neutral before playing again. The helper
requires a unique matching device identity; using a different USB port may
change that identity. After leaving/reloading the map, stop it and start a fresh
helper at initial selection; automatic map-reload recovery is not delivered yet.

For the existing private-desktop setup:

```sh
~/.local/share/smashcraft-build-inputs/playable-integration-20261005/build/wc3-journal-0.0.41-reconnect \
  --follow-matches --build playable-0041 --slot 0 \
  --device /dev/input/eventN --out '/absolute/Warcraft III/CustomMapData' \
  --editbox-display :N --x11-window DECIMAL_XID --pid GAME_PID \
  --private-wlr-app-id GAME_APP_ID
```

The normal Niri desktop uses `--niri-window WINDOW_ID` instead of the private
app-ID argument. Supply its actual display and game identity. Do not run the
old keyboard mapper alongside this helper. Player 1 uses slot 0, Player 2 uses
slot 1, and so on; use the actual player slot, not its position among humans.
Focus the game and release held controls to
rearm after a menu change, pause or focus switch. No manual capture timestamp is
needed. Discovery/launcher automation and other operating systems remain #18 work.

## Controls

| Place | Controls |
| --- | --- |
| Fighter selection | Stick: choose; A: select; X: recall; Start: continue when everyone has selected |
| Stage selection | Stick: choose; X: back; A or Start: begin |
| Fight | Stick: move; A: attack; X: special; B/Y or stick-up: jump; RB: grab; LB: walk; either trigger: shield |
| Pause / results | Start: pause/resume; A or Start at results: confirm rematch |

## Evidence and limits

The gameplay/helper implementation passed two native controller-menu lifecycles
and two native combat/rematch sequences with virtual Linux pads. The combat
sequence included attacks, specials, three jump sources, grab initiation,
overlapping shield triggers, a damaging exchange and controller pause/resume.
Both clients agreed on recorded combat outcomes and final states. The scope and
raw data are in wc3-melee:docs/controller-combat-native-20261005/README.md.

The release changes version/build identity and stage help from that tested
implementation. Source `d12a2bf`; Wurst/Lua compiler
`6b129956f6e7cf9582510f26b99d305526bf3ded`, stdlib `e3714f629113`.
Build configuration: journal input, editbox ingress, shadow-d0-r24,
pool-predicted, normal scenario, response-service probe enabled, build
`playable-0041`. Full compilation passed.

The **installed release bytes and frozen matching helper also passed** the
existing two-client combat/rematch check: 52 matching combat records per match,
final frame 914/checksum `933725:107908` and frame 918/checksum `10392:907822`,
confirmed shield overlap and no extra rematch attack. Exact release evidence:
wc3-melee:docs/playable-0041-native-20261005/README.md.

Map SHA256: `25493bacd040fc08b380df0589f31631055f9032fd84671c0c5d9f639200a533`.
Original helper SHA256: `14440ca6999a2f805f50aa2e0ef835189fcceec0075ead786cc82d3c78fe7d6c`.
That executable remains preserved as `wc3-journal-0.0.41` in the same private
build directory.

The current helper adds reconnect recovery (`007b5b8`), SHA256
`b5ff04432803aaba596dae08b1ffa108dbae8541cfdba68fab1c4b947786c20a`.
With the unchanged 0.0.41 map, both clients passed a two-match disconnect/reconnect
journey: shield released, a different pad was ignored, held-on-return input
stayed suppressed, and fresh 5 ms taps applied once at their original frame.
Exact result and the repaired slow-discovery failure:
wc3-melee:docs/controller-reconnect-native-20261005/README.md.

This is a usable Linux checkpoint, not completed physical-latency, cross-machine
clock/fairness, Windows/macOS, physical reconnect/chat, in-range grab/throw or ten-human-match
acceptance. The exact older 0.0.40 keyboard-map artifact remains privately preserved.
Current claims are owned by #25 (frames), #26 (retention), #27 (response), #17
(integrated play) and #18 (controllers/platforms); see wc3-melee:docs/netplay-status.md.
