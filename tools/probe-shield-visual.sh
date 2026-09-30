#!/usr/bin/env bash
set -euo pipefail
if ! command -v ydotool >/dev/null; then
    exec nix shell nixpkgs#ydotool --command bash "$0" "$@"
fi
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
mkdir -p build/animation-probe
export YDOTOOL_SOCKET="$PWD/build/shield-visual.sock"
ydotoold -p "$YDOTOOL_SOCKET" > build/animation-probe/shield-input.log 2>&1 &
input_pid=$!
record_pid=
cleanup() {
    ydotool key 30:0 49:0 28:0 31:0 33:0 2>/dev/null || true
    if [[ -n "$record_pid" ]]; then kill -TERM "$record_pid" 2>/dev/null || true; wait "$record_pid" 2>/dev/null || true; fi
    kill "$input_pid" 2>/dev/null || true
    wait "$input_pid" 2>/dev/null || true
}
trap cleanup EXIT
sleep 0.6
focus() { [[ $(niri msg --json focused-window | jq -r .title) == 'Warcraft III' ]]; }
press() { focus; ydotool key "$1:1"; sleep 0.08; ydotool key "$1:0"; }
press 33
sleep 0.25
press 31
sleep 0.25
press 28
sleep 0.1
focus
wf-recorder -o eDP-1 -r 60 -F scale=1440:960 -c libx264 -p threads=2 -p preset=ultrafast -f build/animation-probe/shield-visual.mp4 > build/animation-probe/shield-record.log 2>&1 &
record_pid=$!
ydotool key 30:1
sleep 0.6
focus
grim -s 1 build/animation-probe/shield-raised.png
sleep 1.5
focus
grim -s 1 build/animation-probe/shield-low.png
sleep 2.5
focus
ydotool key 30:0
sleep 0.8
grim -s 1 build/animation-probe/shield-released.png
kill -INT "$record_pid"
wait "$record_pid"
record_pid=
