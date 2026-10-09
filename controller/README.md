# Smashcraft controller plug-in

Smashcraft's controller support is [wc3-controller](https://github.com/tompassarelli/wc3-controller)
(the always-on service, the fighter layout, Any map, the status model) plus this
plug-in: `wc3-journal`, built from this folder, which reports Smashcraft
sessions to the service (`wc3-journal --plugin`) and is the journal helper that
serves them. The pinned wc3-controller version is the `tag` in
`smashcraft:controller/Cargo.toml` (and the client's `wc3-controller-model`
dependency); move both together.

## Build and run

Rust 1.96.1 (`smashcraft:controller/rust-toolchain.toml`), a C/C++ compiler,
CMake, libudev and libxkbcommon. On this workstation:

```sh
cd controller
nix-shell -p stdenv.cc cmake pkg-config libxkbcommon udev --run 'cargo test --locked --jobs 2'
```

`bun wisp controller` (smashcraft:docs/commands/controller.md) builds both
pieces and restarts the login unit `wc3-controller.service`, which runs

```sh
~/.local/share/wc3-controller/bin/wc3-controller --service \
  --plugin ~/.local/share/smashcraft-build-inputs/controller/wc3-journal
```

`smashcraft:controller/tests/service.rs` runs wc3-controller's service with
this plug-in program over its real protocol: a virtual pad, a fake session
through a new map session and a game restart.

## Smashcraft sessions

The plug-in (smashcraft:controller/src/profile.rs) reads the newest menu
publication in CustomMapData for the build, slot and current epoch, and names
one `--follow-matches` helper for them (`--epoch` passes the map's current
epoch, so a helper started mid-session drives that menu). A newer menu
publication starts a new map session (a lower epoch, or another build or
slot), so the service replaces the helper. Publications older than the game's
start are ignored. The client's Automatic profile runs Smashcraft while this
game has published a Smashcraft menu since it started, and Any map otherwise.

A build that reads keyboard input (the playable build, #166)
publishes menu phases too: its ready file `CustomMapData/wc3-melee-ready.txt` names
the build and `INPUT keyboard-d2-r24` (the development build uses `INPUT callback`). Newer than the game's start and any different build's menu,
it is a Smashcraft session on keys (`session=BUILD/keys/N`): the service
runs no helper, uses the pointer in fighter, stage and results menus, and presses the pad's keys during matches through the same mapper as
`wc3-controller --emit` (the default melee layout: A n, B u, X/Y i, RB o, LT q, RT v; tom: A n, B o, X u, Y i, LB z, RB x (meter), LT q, RT v;
Start y, left stick w/r/e/space, right stick b/m/j/h), into the game's window
while niri focuses it. Focus loss releases them, and nothing presses again
until the pad is neutral. The status reads `state=serving` once that output runs.

In the map's fighter, opponent settings, stage and results menus, the controller service makes
the left stick a pointer, as the hand cursor is in Smash: it moves the desktop
pointer over the game (the compositor's virtual pointer), A left-clicks to
choose a tile, chip or button, B right-clicks, and Start still sends Y (stage
selection, start). The pointer rests inside 0.12 of full deflection, speeds up
with deflection to the power 1.7, and at full tilt crosses the game window
in one second. It runs only while the map keeps publishing an open menu
(CHARACTER, CPU, STAGE or RESULT, refreshed every 250 ms) and the helper reports no
match, and stops within 100 ms of the map publishing BLOCKED for play, where
the fighter layout applies unchanged (wc3-controller:src/service/any_map.rs,
`MenuCurve`; model::menu_pointer_bindings).

The assigned offline client's menu check uses
`cargo test --locked --test service a_private_pad_script -- --ignored --nocapture`.
Set `WC3_MENU_DISPLAY`, `WC3_MENU_XID`, `WC3_MENU_PID`, `WC3_MENU_APP_ID`,
`WC3_MENU_DATA` (CustomMapData), `WC3_MENU_WIDTH` (logical pixels), and
`WC3_MENU_SCRIPT`, alongside that private desktop's `XDG_RUNTIME_DIR`,
`WAYLAND_DISPLAY` and `XAUTHORITY`. The script's rows are milliseconds,
left-stick X and Y (-32768..32767), A (0/1), and Start (0/1); `#` lines are
comments. Start with a neutral row. Menu changes use the same driver as the
service and match phases return to the standard fighter keys. The native
executor checks the selected fighter and match receipt after the script.

## Journal helper

`wc3-journal` is a separate Linux evdev acquisition executable. It uses kernel
CLOCK_MONOTONIC event timestamps rather than SDL's clock conversion, retains
per-frame edges/analog state, and atomically publishes immutable I4 preload
files for the production journal input source. Build it with the same pinned
environment above using `cargo build --locked --jobs 2 --bin wc3-journal`.

For the editbox map, start one helper **in character selection** and
leave it running through results and rematches:

```sh
controller/target/debug/wc3-journal \
  --follow-matches --build BUILD --slot 0 \
  --device /dev/input/eventN --out '/absolute/Warcraft III/CustomMapData' \
  --editbox-display :N --x11-window DECIMAL_ID --pid PID \
  --niri-window WINDOW_ID --trace
```

Select the exact device, build, slot and focus target. The Linux Xbox axis set
is required. The helper opens the device and tracks its physical state before
announcing readiness. It accepts only new complete readiness publications after
it starts (or the preceding match ends), and only increasing within-map epochs.
Old map-session receipts are not adopted. In character selection, left-stick
left/right cycles the character, A selects the current character, X recalls
your selection, and Start opens stage selection once everyone has selected.
In stage selection, left/right changes the stage, X returns to characters,
and A or Start begins the match. At results, A or Start confirms your rematch.
Up/down visits fighter cards and CPU Opponent settings. In that panel,
left/right changes the focused value, up/down visits Opponent, Difficulty and
Done, A advances or chooses Done, X goes back, and Start closes without starting
a match. One stick deflection or button press produces one menu action; release before
the next action. The controller service starts the helper with `--menu-keys
start`: then only Start reaches the outer menus, and the service's menu pointer
does the rest, including in the CPU opponent settings panel. Held controls require neutral after startup, a menu phase
change, focus loss, and entering gameplay.

The map publishes `smashcraft-journal-menu-BUILD-sSLOT.txt`, containing
`SMASHCRAFT JOURNAL MENU v=1 build=BUILD epoch=EPOCH slot=SLOT phase=PHASE` in
a complete native preload file. PHASE is CHARACTER, CPU, STAGE, RESULT or BLOCKED.
Eligible menus refresh every 15 map ticks (normally 250 ms); the helper requires
a matching publication newer than its startup/previous match and no older than
one second. Initial character selection uses epoch 0. Results become eligible
only after all helpers have stopped and the text box has closed. BLOCKED,
missing, partial or stale receipts suppress menu actions.

Each accepted menu action uses the existing exact-window Enigo text boundary
to send a finite W/R/Space/E/N/U/Y press-release pair. It holds no menu keys, rechecks
map permission and game focus per tap, and never activates a window. The map's
journal menus give those keys fixed menu meanings independent of combat key
rebindings and mouse position. This covers ordinary fighter/stage/result menus;
mouse-only slot modes, settings, chat and other Warcraft screens are outside it.

Every human helper announces readiness through the ordered text ingress. The
map synchronizes those announcements before publishing local START. Capture
uses that complete file's stable modification timestamp, converted to the local
monotonic clock with measured uncertainty, just as resume does. START/END files
older than the accepted readiness publication are ignored. A delayed or partial
START read retains original input events; the helper never substitutes its read
time for the publication boundary. This defines a **local publication grid**;
it does not align clocks between machines or remove their inter-client offset.

At results, the map publishes END. The helper stops generating capture rows,
discards unfinished terminal rows, drains already queued old-epoch records, and
sends an ordered final marker. The map consumes those terminal records without
combat and flushes the final marker receipt. The helper observes that receipt
and publishes its fixed local quiescence acknowledgment; only then does the map
close the editbox. The helper clears an earlier acknowledgment before announcing
readiness, so it cannot satisfy a new match. Results controls unlock after every human helper has stopped. The same process
then follows the next fresh epoch with neutral rearming and empty match queues.
This supports within-map rematches; automatic map reload remains unsupported.
Logs identify `waiting_for_match`, `match_ready`, `match_start`, `match_end`, and
`match_quiescent`, with the epoch and startup timestamp uncertainty.

On controller removal, the journal retains earlier captured input and emits a
neutral release at the first unassigned frame at detection. It continues neutral
rows while disconnected. Reconnect discovery reads kernel identity files and
opens only a unique match for the selected Linux input ID, name, physical path
and unique name, then rechecks the opened device. At least one physical/unique
discriminator is required; missing or ambiguous identity never selects another
pad. Changing USB ports can change the physical path. Controls held on return
must become neutral before new gameplay, menu or pause inputs are accepted.
`controller_disconnected` records detection; `controller_release frame=N`
records its assigned release; `controller_reconnected source=...` identifies
the recovered event path. Bounded native recovery is recorded in
smashcraft:evidence/controller-reconnect-native-20261005/README.md.

Each record the helper types is an envelope of about 30 characters around
its payload, and it types at most 16 records past what the map's receipt says
it consumed. Warcraft takes typed text into the edit box at a cost that grows
with how much it takes at once: in 0.0.48's native bot session, the 16 records
(608 characters) typed after a 2 s stop held the client about 180 ms, and its
input stayed 15–25 frames late for 5 s
(smashcraft:evidence/bot-session-0048-native-20261006/). So the helper types
at most 160 characters past the record the receipt says arrived. While a
row packet waits untyped, consecutive packets from the same epoch combine
using the existing `I5` message encoding, up to 64 frames and only while the
whole envelope stays within those 160 characters. Holds keep buttons, axes
and triggers; every press, release and other edge retains its original frame.
Already typed packets and control records stay separate. The native #86
capture's 28 neutral frames used 155 characters as joined `I4` packets;
the same frames use 37 characters in one `I5` envelope.
The map writes a dirty text receipt every two ticks (at most 30 per client
per second), so the smaller window can drain promptly. The typing cost
model bounds 160 characters at 12.8 ms; native receipt-write cost remains
a separate check.

For Wisp's headless clients, `--text-out FILE` replaces `--editbox-display`
and the focus arguments: every text the helper would type into the game's
window (journal envelopes and menu keys) is appended to FILE as one line, and
`--out` names the folder the headless client writes its files to. There is
no window, so focus never suspends output; chat's Return key needs a game
window and stops the helper. `bun wisp integrity headless` starts it this way
(smashcraft:docs/typescript.md).

The explicit `--ready-file PATH --epoch-monotonic-ns NS` mode remains for native
diagnostic drivers. `--first-frame N` (default 1) and `--stop-frame N` belong to
that mode; it also accepts explicit build/epoch/slot/delay arguments. Its supplied
clock is a diagnostic assumption, never a cross-machine timing guarantee. A
diagnostic producer's first I4 row may announce readiness to the map.

Pause prepares each helper's input frontier, synchronizes the highest frontier
across humans, and commits the shared stop frame. Resume opens a new local
capture segment at the stable publication timestamp, retaining original tags.
Enter in the active controller receiver requests that same shared pause before
opening native chat. The helper drains all retained records through their
consumed receipts, then publishes its chat quiescence symbol. Only then does
the map hide and release the receiver and the helper press Return. Controller
actions remain suppressed until native chat closes and the map restores its
receiver. Closing chat leaves the match paused; neutral controls and a fresh
Start press resume it. No player can resume while another player is typing.

At match admission, the helper removes that epoch and slot's old end and chat
acknowledgements before announcing readiness. A new game reuses epoch and chat
request numbers, so these files must not satisfy a new handshake or collide
with its immutable publication. Other builds, epochs and slots are preserved.

The existing text receipt exposes `chat` (a within-epoch request number),
`chatState` (0 receiver restored, 1 draining, 2 focus released, 3 native chat
observed visible), and `chatFrame` (whether `ChatEditBar` was found). State 0
with the same nonzero request number follows observed native closure and
receiver restoration. Helper logs report `chat_state`, `chat_quiescent`, and
`chat_return`. Native acceptance must establish editbox Enter delivery,
`ChatEditBar` visibility, and the injected Return opening actual chat; source
tests alone do not establish those engine behaviors.

The helper waits for the native writer's closing line before parsing controls.
Native timing and graphical acceptance are distinct from the focused source
tests. This path remains Linux-only and separate from the digital keyboard mapper.
On kernel SYN_DROPPED or an event for an already-published frame, acquisition
stops with a diagnostic instead of inventing input or moving its original frame.

Current evidence and remaining acceptance are in
`roadmap #16`. The Linux journal path passed bounded tap/stall,
focus and pause/resume trials. Automatic start/results/rematch with the same
helpers passed two native match lifecycles; keyboard confirmed the menus.
See `smashcraft:evidence/match-lifecycle-native-20261005/README.md` for exact builds,
failed attempts and limits. Physical controller-to-screen timing, cross-machine
clock agreement, chat, physical reconnect and other-platform acceptance remain open.

### Journal keyboard focus boundary

Keyboard ingress (`--editbox-display` or `--mailbox-display`) additionally
requires `--x11-window DECIMAL_ID`, `--pid PID`, and exactly one foreground
adapter: `--niri-window ID` or `--private-wlr-app-id ID`. The latter uses the
selected private desktop's `XDG_RUNTIME_DIR` and `WAYLAND_DISPLAY`. These are
the same process/window/compositor checks used by the mapper, implemented in
wc3-controller:src/focus.rs and wc3-controller:src/wlr.rs. Missing or
failed target identity is an error; ordinary focus loss suspends keyboard output.

Focus loss leaves assigned rows and queued I4/ACK1/JP1 records in order. A logical
neutral release is assigned after any already-assigned open row; subsequent
unfocused input is explicitly suppressed. The 60 Hz capture segment continues,
so neutral rows retain the elapsed original frame numbers. Focus away for less
than 200 ms is a blip: input stays armed and held, and only typing waits for
focus. Focus checks have reported such blips of a few milliseconds during
play; each loss logs `focus_away` with what held focus instead (the Niri focused
window's id, app ID and PID, or the X11 active, focus and pointer windows), and
`focus_back` with its duration. A loss of 200 ms or more releases as above. On return, queued
records resume without retargeting, while fresh gameplay requires all mapped
controls (including Start) to become neutral. A held-through-return stick or
button cannot reactivate by itself. Start remains usable during game pause after
focus rearming; gameplay separately requires neutral after pause.

The queue permits at most 120 records and 2048 bytes including delimiters,
roughly four seconds of ordinary two-frame records (less for larger records or
control traffic). Exceeding either bound stops with an explicit error; records
are not overwritten. This is bounded focus recovery, not indefinite background
capture. Trace output distinguishes `game-eligible`, `focus_release`,
`input_armed`, `gameplay_armed`, suppressed kernel events and actual emissions.

Eligibility is sampled before queue capture and each keyboard API emission;
it is not an atomic compositor/keyboard transaction or a history of OS focus at
every kernel event timestamp. Already assigned rows are retained; unassigned
items observed while ineligible or before the recovery boundary are suppressed
and logged. Map-internal chat/editbox focus is a separate acceptance boundary.
No game activation or focus change is performed by the helper. The editbox path
uses Enigo's X11 `text_to_window`, including directed modifier events, so a
focus switch cannot route its text to another application's window. This does
not guarantee Warcraft consumes those events: the native focus trial retained
zero sink events but exposed a missing-frame gap on return. Native acknowledgment
and replay remain required before claiming focus-safe delivery; see
smashcraft:evidence/native-focus-20261005/README.md.

The editbox path holds no global transport keys; the legacy mailbox retains its existing signal state
until eligible and gates its cleanup too, so unfocused teardown does not emit
key releases to a different application.
