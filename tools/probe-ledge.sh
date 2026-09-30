#!/usr/bin/env bash
set -euo pipefail
if ! command -v ydotool >/dev/null; then
    exec nix shell nixpkgs#ydotool --command bash "$0" "$@"
fi
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
mode=${1:-climb}
case "$mode" in
    climb) key=57; phase=2 ;;
    jump) key=23; phase=0 ;;
    roll) key=30; phase=3 ;;
    attack) key=49; phase=4 ;;
    drop) key=32; phase=0 ;;
    *) echo 'Use climb, jump, roll, attack or drop from default character selection in the ledge scenario.' >&2; exit 2 ;;
esac
run_dir="$project_dir/build/animation-probe/ledge-$mode"
mkdir -p "$run_dir"
trace_file='/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/wc3-melee-input-trace.txt'
export YDOTOOL_SOCKET="$project_dir/build/ledge-probe.sock"
ydotoold -p "$YDOTOOL_SOCKET" > "$run_dir/input.log" 2>&1 &
input_pid=$!
cleanup() {
    ydotool key "$key:0" 49:0 29:0 20:0 28:0 31:0 33:0 2>/dev/null || true
    kill "$input_pid" 2>/dev/null || true
    wait "$input_pid" 2>/dev/null || true
}
trap cleanup EXIT
sleep 0.6
focus() { [[ $(niri msg --json focused-window | jq -r .title) == 'Warcraft III' ]]; }
press() { focus; ydotool key "$1:1"; sleep 0.08; ydotool key "$1:0"; sleep 0.12; }
trace() { focus; ydotool key 29:1 20:1 20:0 29:0; }
touch "$run_dir/started"
press 33
press 31
trace
press 28
sleep 0.5
focus
grim -s 1 "$run_dir/hang.png"
press "$key"
sleep 1
focus
grim -s 1 "$run_dir/option.png"
sleep 10
[[ "$trace_file" -nt "$run_dir/started" ]]
cp "$trace_file" "$run_dir/trace.txt"
rg -q 'ledge 1 x' "$run_dir/trace.txt"
rg -q "ledge $phase x" "$run_dir/trace.txt"
rg 'ledge |jump ' "$run_dir/trace.txt"
