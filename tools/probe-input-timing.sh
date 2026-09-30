#!/usr/bin/env bash
set -euo pipefail
if ! command -v ydotool >/dev/null; then
    exec nix shell nixpkgs#ydotool --command bash "$0" "$@"
fi
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
mkdir -p "$project_dir/build/animation-probe"
export YDOTOOL_SOCKET="$PWD/build/animation-probe/input-timing.sock"
ydotoold -p "$YDOTOOL_SOCKET" > build/animation-probe/input-timing-daemon.log 2>&1 &
input_pid=$!
trap 'ydotool key 49:0 57:0 29:0 20:0 28:0 31:0 33:0 2>/dev/null || true; kill "$input_pid" 2>/dev/null || true; wait "$input_pid" 2>/dev/null || true' EXIT
sleep 0.6
window_id=$(niri msg --json windows | jq -er '.[]|select(.title=="Warcraft III")|.id')
check_focus() { [[ $(niri msg --json focused-window | jq -r .id) == "$window_id" ]] || exit 1; }
press() { check_focus; ydotool key "$1:1"; sleep 0.08; ydotool key "$1:0"; sleep 0.2; }
trace() { check_focus; ydotool key 29:1 20:1 20:0 29:0; }
check_focus
press 33
press 31
press 28
trace
for timing in short short short short short short short short long long long long; do
    check_focus
    date +%s.%N
    echo "$timing down"
    ydotool key 57:1
    if [[ "$timing" == short ]]; then sleep 0.07; else sleep 0.23; fi
    date +%s.%N
    echo "$timing up"
    ydotool key 57:0
    if [[ "$timing" == short ]]; then sleep 0.06; else sleep 0.19; fi
done
