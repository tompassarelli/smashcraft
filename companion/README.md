# Warcraft controller core

UI-less Rust companion targeting Linux, Windows and macOS. SDL3 owns discovery,
normalization and adapter protocols; enigo delivers key transitions. The default
is **observation only**: no keyboard injection, window creation, or focus changes.

## Build and observe

From the checkout's `wc3-melee:companion` directory, use Rust 1.96.1 (pinned in
`wc3-melee:companion/rust-toolchain.toml`), a C/C++ compiler and CMake. Linux also
needs the libudev and libxkbcommon development libraries. Dependencies, including
SDL 3.4.16 built statically through sdl3 0.20.0, are locked in
`wc3-melee:companion/Cargo.lock`. Build output stays in
`wc3-melee:companion/target`.

```sh
cd ~/code/wc3-melee/worktrees/controller-core-20261003/companion
cargo test --locked --jobs 2
cargo build --locked --jobs 2
cargo run --locked -- --list
cargo run --locked -- --watch-seconds 20
# When several controllers are present, select an ID printed by --list:
cargo run --locked -- --watch-seconds 20 --gamepad 1
```

For this NixOS workstation, the observed build environment is:

```sh
nix-shell -p bun stdenv.cc cmake pkg-config libxkbcommon udev
export PATH="$HOME/.rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin:$PATH"
bun ~/.codex/skills/machine-capacity-distilled/scripts/machine-capacity.mjs run \
  --class moderate --owner codex:controller-build --timeout-seconds 900 -- \
  cargo build --locked --jobs 2
```

SDL runs on the main thread with background gamepad acquisition enabled. Logs
include SDL event timestamps, monotonic observation times, device identity and
mapping, normalized samples, and action transitions. Normalized axes are not
original USB packet bytes. Neither these timestamps nor the 4 ms polling sleep
measure physical input latency. Device enumeration may still fail for missing
permissions or an unsupported adapter mode; no driver or permission changes are
performed. Unplugging clears actions. Reconnecting creates a new SDL instance ID;
select it in a fresh run rather than silently switching to another controller.

## Xbox mapping

| Control | Action / logical key |
| --- | --- |
| A / X | Attack N / special U |
| B or Y | Jump I |
| RB / LB | Grab O / walk P |
| LT or RT | Shield Q |
| Start | Y |
| Left stick left / right / down | W / R / E |
| Left stick up | Space and I, held until below threshold |
| Right stick up / right / down / left | J / M / H / B |

Thresholds are provisional SDL units: left stick 7000, right stick 11000,
triggers 4000. Active means strictly beyond the threshold. These are the existing
digital baseline, not Melee calibration. Shared sources are unioned before
emission: releasing LT while RT is held retains shield; B, Y and stick-up share
one held jump action. Hold duration remains available to the game's jump logic.
The Xbox preset is not a claim that GameCube letter labels have the same meaning.

Startup, loss of game eligibility and disconnect require all mapped controls to
return to neutral while eligible before rearming. Only keys this output backend
pressed are released; there is no blanket keyboard reset. Physical keyboard and
controller use of the same key still requires native testing.

## Explicit Linux output

The **Niri plus X11/XWayland** eligibility adapter uses a selected
live Warcraft PID, its exact X11 focus window/display, and its Niri window ID.
The PID's command line must identify Warcraft III.exe; its process start time
must remain unchanged. `_NET_WM_PID`, actual X11 input focus, and Niri's focused
window ID/PID must all agree. Niri overview must be closed. Missing/failed replies
are ineligible, and no old successful observation is reused. If Niri reports a
proxy PID, the exact game/window relationship is not established and output is
refused. A title or process-existing check alone never grants eligibility.

After selecting the actual IDs in a controlled Niri game session, with one
mapper responsible for delivery, replace the example values:

```sh
cargo run --locked -- --watch-seconds 30 --gamepad 1 --emit \
  --display :0 --x11-window 123456 --pid 12345 --niri-window 678
```

`NIRI_SOCKET` must refer to that same desktop. The tool never focuses Warcraft.
Keyboard output uses logical lowercase keys through enigo, with explicit press
and release; verify the game's keyboard layout/preset. Ctrl-C, the bounded
watch duration, focus loss and disconnect release owned keys. Output errors stop
the run and attempt owned-key cleanup; process crashes or forced termination
cannot guarantee cleanup. Global input delivery has an unavoidable focus-change
race between a foreground check and OS submission. Niri IPC has a 50 ms timeout;
X11/enigo operations rely on their library's connection behavior.

The companion cannot identify map gameplay versus chat or a modal within the
same game window. Keep live trials in the intended map gameplay and stop mapping
before chat/menus that consume these keys. Native focus-away/overview/lock,
physical keyboard overlap, layout and game-consumption checks remain required.

For the owner's isolated labwc test desktops, the alternative
`--private-wlr-app-id steam_app_3516115571` replaces `--niri-window`. A direct
Wayland foreign-toplevel subscription requires exactly one window with that
app ID and title `Warcraft III`, marked activated. It runs a compositor sync
barrier each observation, rather than invoking an external command. The exact
X11 focus window/PID/display and process birth checks still apply. The protocol
has no PID, so this adapter is scoped to the explicitly selected private test
namespace with its unique app ID, not advertised as a general compositor
identity guarantee. `XDG_RUNTIME_DIR` and `WAYLAND_DISPLAY` must select that
desktop. X11 and Wayland connection operations rely on their libraries' blocking
behavior; a hung display server is not a bounded-release guarantee.

Use `--check-focus` instead of `--emit --watch-seconds N` with those target
arguments to perform a read-only eligibility check without initializing enigo.
Other compositor/session combinations remain unverified. Windows/macOS use
the common acquisition/mapping and enigo abstraction but **refuse `--emit`**
until their native foreground identity adapters exist. No native Windows/macOS
build or runtime acceptance is claimed. No GameCube adapter or Steam Deck has
been physically tested; SDL handles those protocols without a custom decoder.
Continuous analog delivery into Warcraft, Tauri and packaging remain separate.

## Observed evidence

Linux x86_64: `cargo test` passed all five tests covering the requested bindings,
overlapping triggers/jump sources, focus/disconnect release and neutral rearm.
`cargo build --locked --jobs 2` succeeded. Read-only `--list` using SDL 3.4.16
found one **Xbox One S Controller**, VID 045e/PID 02ea, at `/dev/input/event1`,
with SDL's Linux mapping and live normalized stick/trigger values. A two-second
observation run armed after the neutral sample. No physical button manipulation
was performed during those observations. Read-only `--check-focus` returned true
for the parent's selected A and B Warcraft windows in their separate labwc
sessions, with the exact supplied PID/XID/display and unique app IDs. This proves
foreground identity acquisition in those sessions, not gameplay eligibility:
the games were at login screens. Focus-away and key-delivery trials remain
unperformed. No keyboard injection or live Warcraft acceptance was run
while implementing this core. Third-party code is consumed as dependencies;
no Blizzard Controller Support, W3Champions, Dolphin or Slippi source was copied
or translated. SDL is zlib-licensed; sdl3 and enigo are MIT-licensed. Any future
distribution must retain dependency notices and satisfy transitive licenses.
