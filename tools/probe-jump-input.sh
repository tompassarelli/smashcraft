#!/usr/bin/env bash
set -euo pipefail
if ! command -v ydotool >/dev/null; then
    exec nix shell nixpkgs#ydotool --command bash "$0" "$@"
fi
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
case "${1:-I}" in
    I) jump_key=23 ;;
    9) jump_key=10 ;;
    *) echo 'Usage: probe-jump-input.sh I|9 (from character selection)' >&2; exit 2 ;;
esac
run_dir="$project_dir/build/animation-probe/jump-input-${1:-I}"
mkdir -p "$run_dir"
trace_file='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/wc3-melee-input-trace.txt'
export YDOTOOL_SOCKET="$run_dir/input.sock"
ydotoold -p "$YDOTOOL_SOCKET" > "$run_dir/input.log" 2>&1 &
input_pid=$!
cleanup() {
    ydotool key "$jump_key:0" 49:0 65:0 2>/dev/null || true
    kill "$input_pid" 2>/dev/null || true
    wait "$input_pid" 2>/dev/null || true
}
trap cleanup EXIT
sleep 0.6
require_focus() { [[ $(niri msg --json focused-window | jq -r .title) == 'Warcraft III' ]]; }
press() { require_focus; ydotool key "$1:1"; sleep 0.08; ydotool key "$1:0"; sleep 0.18; }
touch "$run_dir/started"
press 49
press 49
press 65
require_focus
ydotool key "$jump_key:1"
sleep 0.18
ydotool key "$jump_key:0"
sleep 0.12
ydotool key "$jump_key:1"
sleep 0.15
ydotool key "$jump_key:0"
sleep 5
[[ "$trace_file" -nt "$run_dir/started" ]]
cp "$trace_file" "$run_dir/trace.txt"
rg -q 'jump [0-9]+ double 0 ' "$run_dir/trace.txt"
rg -q 'jump [0-9]+ double 1 ' "$run_dir/trace.txt"
printf 'Observed ground jump and double-jump from %s in the client.\n' "${1:-I}"
